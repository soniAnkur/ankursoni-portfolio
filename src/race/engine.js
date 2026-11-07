// "Night-drive" intro engine — a short, stylized arcade street-racer, now
// upgraded from primitive-only geometry to a real glTF car model + HDRI
// environment reflections + PBR road textures (see car.js/track.js). Single
// entry point consumed by src/main.js; see that file's header comment for
// the exact contract. Everything here is defensive: a WebGL failure degrades
// to an immediate onReady() with a no-op handle rather than throwing, and
// every newly-added asset load (model/HDRI/textures) falls back gracefully
// on its own if it fails.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { createCar } from "./car.js";
import { createTrack } from "./track.js";
import { createQuestTracker } from "./quest-state.js";
import { createKioskOverlay } from "./kiosk-overlay.js";
import { getKioskContent } from "./stage-data.js";

const SKY_COLOR = 0x05030c;
const FOG_COLOR = 0x0a0618;

// Resolved against this module's own URL so the path is correct whether
// engine.js loads via the real site's dynamic-import chain or directly from
// src/race/test.html.
const HDRI_URL = new URL("./assets/rooftop_night_1k.hdr", import.meta.url).href;

const MAX_SPEED = 42; // world units / second
const ACCEL = 26;
const BRAKE_DECEL = 46;
const FRICTION = 16;
// rad/sec at full speed/full lock. Tuned against the loop's 55-unit turn
// radius (track.js) so holding the steer key fully through a turn traces
// it at roughly the turn's actual curvature instead of spinning a much
// tighter circle inside it — see track.js's header comment on the heading
// convention this shares with the road.
const TURN_RATE = 0.85;
// Approximate horizontal radius of the car for kiosk-collision resolution
// (half the fallback car's 1.8-unit width, plus a small margin).
const CAR_COLLISION_RADIUS = 1.3;
// World-units/sec -> HUD km/h. Tuned so holding full throttle reads as a
// believable arcade top speed (~189 km/h) instead of a near-300 km/h number
// for what is visually a gentle cruise.
const SPEED_TO_KMH = 4.5;

function createEngineAudio() {
  let ctx = null;
  let osc = null;
  let osc2 = null;
  let filter = null;
  let gain = null;
  let started = false;

  return {
    start() {
      if (started) return;
      started = true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ctx = new Ctx();
        osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc2 = ctx.createOscillator();
        osc2.type = "square";
        filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 300;
        gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.frequency.value = 55;
        osc2.frequency.value = 55.5;
        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc2.start();
      } catch {
        started = false;
      }
    },
    update(speedFraction) {
      if (!ctx || ctx.state === "closed") return;
      const f = Math.max(0, Math.min(1, speedFraction));
      const now = ctx.currentTime;
      try {
        osc.frequency.setTargetAtTime(55 + f * 180, now, 0.05);
        osc2.frequency.setTargetAtTime(55.5 + f * 181, now, 0.05);
        filter.frequency.setTargetAtTime(280 + f * 2600, now, 0.08);
        gain.gain.setTargetAtTime(0.022 + f * 0.05, now, 0.1);
      } catch {
        /* ignore scheduling errors from a context mid-teardown */
      }
    },
    dispose() {
      try {
        osc?.stop();
        osc2?.stop();
      } catch {
        /* already stopped */
      }
      try {
        ctx?.close();
      } catch {
        /* already closed */
      }
      ctx = null;
      osc = null;
      osc2 = null;
      filter = null;
      gain = null;
    },
  };
}

export default function initRace({ mount, onProgress, onCheckpoint, onReady } = {}) {
  const noop = () => {};
  const progressCb = typeof onProgress === "function" ? onProgress : noop;
  const checkpointCb = typeof onCheckpoint === "function" ? onCheckpoint : noop;
  const readyCb = typeof onReady === "function" ? onReady : noop;

  let disposed = false;
  let rafId = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let composer = null;
  let bloomPass = null;
  let track = null;
  let carRig = null;
  let hud = null;
  let kioskOverlay = null;
  let questTracker = null;
  let cameraFill = null;
  let pmremGenerator = null;
  let envMap = null;
  const audio = createEngineAudio();
  const keys = Object.create(null);
  let lastFrameTime = 0;
  let elapsedTime = 0;
  let projectsAnnounced = false;

  const state = {
    speed: 0,
    heading: 0,
    x: 0,
    z: 0,
    fov: 55,
    braking: false,
  };

  // Fires once per stage (not once per project sub-kiosk — the 6 project
  // kiosks share a single "projects" checkpoint, per the contract).
  function handleFirstExplored(kiosk) {
    try {
      if (kiosk.stageId === "projects") {
        if (!projectsAnnounced) {
          projectsAnnounced = true;
          checkpointCb("projects");
        }
      } else {
        checkpointCb(kiosk.stageId);
      }
    } catch {
      /* caller's handler is not our problem */
    }
  }

  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
    audio.start();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function onResize() {
    if (disposed || !renderer || !camera || !composer) return;
    const w = mount?.clientWidth || window.innerWidth;
    const h = mount?.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }

  function disposeMaterial(material) {
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    mats.forEach((m) => {
      m.map?.dispose?.();
      m.emissiveMap?.dispose?.();
      m.dispose?.();
    });
  }

  function teardownScene() {
    try {
      scene?.traverse((obj) => {
        obj.geometry?.dispose?.();
        disposeMaterial(obj.material);
      });
    } catch {
      /* best effort */
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    try {
      audio.dispose();
    } catch {
      /* ignore */
    }
    teardownScene();
    try {
      envMap?.dispose?.();
    } catch {
      /* ignore */
    }
    try {
      pmremGenerator?.dispose?.();
    } catch {
      /* ignore */
    }
    try {
      composer?.dispose?.();
    } catch {
      /* ignore */
    }
    try {
      renderer?.dispose();
    } catch {
      /* ignore */
    }
    try {
      if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch {
      /* ignore */
    }
    try {
      hud?.remove();
    } catch {
      /* ignore */
    }
    try {
      kioskOverlay?.dispose();
    } catch {
      /* ignore */
    }
  }

  function buildHud() {
    hud = document.createElement("div");
    hud.className = "race-hud";
    hud.innerHTML =
      '<div class="race-hud-speed"><span class="race-hud-speed-value">0</span>' +
      '<span class="race-hud-speed-unit">KM/H</span></div>' +
      '<div class="race-hud-hint">WASD / ARROWS — DRIVE TO EXPLORE</div>';
    mount.appendChild(hud);
  }

  function updateHud() {
    if (!hud) return;
    const el = hud.querySelector(".race-hud-speed-value");
    if (el) el.textContent = String(Math.round(Math.abs(state.speed) * SPEED_TO_KMH));
  }

  function updateCar(dt) {
    const accelerating = keys.arrowup || keys.w;
    const braking = keys.arrowdown || keys.s;
    const left = keys.arrowleft || keys.a;
    const right = keys.arrowright || keys.d;

    if (accelerating) {
      state.speed += ACCEL * dt;
    } else if (braking) {
      state.speed -= BRAKE_DECEL * dt;
    } else if (state.speed !== 0) {
      const sign = Math.sign(state.speed);
      state.speed -= sign * FRICTION * dt;
      if (Math.sign(state.speed) !== sign) state.speed = 0;
    }
    state.speed = THREE.MathUtils.clamp(state.speed, -MAX_SPEED * 0.35, MAX_SPEED);
    state.braking = !!braking && state.speed > 0.5;

    const speedFrac = Math.abs(state.speed) / MAX_SPEED;

    let steerInput = 0;
    if (left) steerInput += 1;
    if (right) steerInput -= 1;
    state.heading += steerInput * TURN_RATE * dt * (0.35 + 0.65 * speedFrac);

    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += -Math.cos(state.heading) * state.speed * dt;

    // Soft clamp back toward the lane so the car can corner freely around
    // the loop but never strays into the void; widens automatically near
    // each kiosk's pull-off apron (track.maxOffsetAt) so there's room to
    // actually pull up next to one without the clamp fighting the player.
    const sample = track.nearestSample(state.x, state.z);
    const rx = Math.cos(sample.heading);
    const rz = Math.sin(sample.heading);
    const lateral = (state.x - sample.x) * rx + (state.z - sample.z) * rz;
    const maxOffset = track.maxOffsetAt(sample.s);
    if (lateral > maxOffset) {
      const excess = (lateral - maxOffset) * Math.min(1, dt * 6);
      state.x -= rx * excess;
      state.z -= rz * excess;
    } else if (lateral < -maxOffset) {
      const excess = (lateral + maxOffset) * Math.min(1, dt * 6);
      state.x -= rx * excess;
      state.z -= rz * excess;
    }

    // Real collision against kiosk monuments (three-mesh-bvh closest-point
    // query) so the car can't visually clip through one.
    try {
      track.resolveCollisions(state, CAR_COLLISION_RADIUS);
    } catch {
      /* collision is a nice-to-have, never let it break driving */
    }

    carRig.group.position.set(state.x, 0, state.z);
    carRig.group.rotation.y = -state.heading;

    const wheelSpin = state.speed * dt * 2.4;
    carRig.wheels.forEach((w) => {
      w.rotation.x -= wheelSpin;
    });

    const tailIntensity = state.braking ? 2.6 : 0.9;
    carRig.tailMaterials.forEach((m) => {
      m.emissiveIntensity = tailIntensity;
    });

    audio.update(speedFrac);

    return speedFrac;
  }

  // Drives the in-scene "quest" payoff: proximity -> Yuka FSM state ->
  // content-card overlay + progress indicator. Entirely best-effort — a
  // failure here degrades to "no kiosk cards" but never stops the car.
  function updateQuest() {
    if (!questTracker || !kioskOverlay) return;
    try {
      questTracker.update(state.x, state.z);
      const activeKiosk = questTracker.getActiveCardKiosk();
      if (activeKiosk) {
        kioskOverlay.showCard(activeKiosk.key, getKioskContent(activeKiosk));
      } else {
        kioskOverlay.hideCard();
      }
      kioskOverlay.updateProgress(questTracker.getProgress());
    } catch {
      /* kiosk overlay/progress is cosmetic — never let it break driving */
    }
  }

  function updateCamera(speedFrac, dt, elapsed) {
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
    const behind = carRig.group.position.clone().addScaledVector(forward, -7.6);
    behind.y = 3.1;

    const shake = speedFrac * 0.05;
    behind.x += Math.sin(elapsed * 14) * shake;
    behind.y += Math.cos(elapsed * 17) * shake * 0.5;

    // Frame-rate-independent exponential smoothing (not a plain dt*k lerp,
    // which under-converges on frame hitches / faster turns and leaves a
    // lingering lateral lag during and right after a turn — enough for the
    // camera to sit off-axis instead of dead behind). A dead-behind camera
    // keeps the car's own body consistently occluding its front-mounted
    // specular highlights/glints (see car.js's envMapIntensity note); an
    // off-axis one lets them peek around the side and bloom.
    camera.position.lerp(behind, 1 - Math.exp(-dt * 30));
    cameraFill?.position.copy(camera.position);

    const lookTarget = carRig.group.position.clone().addScaledVector(forward, 10);
    lookTarget.y += 1.0;
    camera.lookAt(lookTarget);

    const targetFov = 55 + speedFrac * 12;
    state.fov += (targetFov - state.fov) * Math.min(1, dt * 3);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    if (disposed) return;
    const dt = Math.min((now - lastFrameTime) / 1000 || 0, 0.1);
    lastFrameTime = now;
    elapsedTime += dt;
    const speedFrac = updateCar(dt);
    updateQuest();
    updateCamera(speedFrac, dt, elapsedTime);
    bloomPass.strength = 0.32 + speedFrac * 0.18;
    updateHud();
    composer.render();
    rafId = requestAnimationFrame(tick);
  }

  try {
    if (!mount) throw new Error("race: no mount element provided");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.012);

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(55, width / Math.max(height, 1), 0.1, 500);
    camera.position.set(0, 3.1, 7.6);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Pulled down from the primitive-only build's 1.1: real PBR materials +
    // an HDRI environment add their own brightness/contrast on top of the
    // scene lights, so the old exposure now reads blown-out.
    renderer.toneMappingExposure = 0.95;
    renderer.domElement.className = "race-canvas";
    mount.appendChild(renderer.domElement);

    progressCb(0.15);

    // Shared across every loader below (HDRI, car model, road textures) so
    // onProgress reflects real asset-load progress, not just fixed stage
    // jumps, now that there's real asset weight to load.
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      const frac = total > 0 ? loaded / total : 1;
      progressCb(0.3 + frac * 0.55);
    };
    manager.onError = (url) => {
      console.warn(`race: asset failed to load via LoadingManager: ${url}`);
    };

    const hemi = new THREE.HemisphereLight(0x3a4f7a, 0x05030a, 0.85);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0x6688ff, 0.45);
    moon.position.set(-30, 60, -20);
    scene.add(moon);
    // Soft fill that travels with the camera so the car body reads clearly
    // against the dark scene instead of silhouetting into the neon glow.
    // Intensity tuned well above a "natural" point-light falloff value —
    // three.js's physically-correct falloff makes low numbers read as
    // almost no light at the ~8 unit chase-camera distance. Pulled down
    // from the primitive-only build's 7.5 now that the car's own PBR
    // envMap reflections add brightness the flat emissive materials didn't.
    cameraFill = new THREE.PointLight(0xaaccff, 5.5, 20, 2);
    scene.add(cameraFill);

    // HDRI -> PMREM env map, purely for PBR reflections on the car body and
    // road (scene.environment), not as the visible backdrop — the existing
    // procedural neon skyline/fog stays as scene.background per the brief.
    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      new RGBELoader(manager).load(
        HDRI_URL,
        (hdrTexture) => {
          try {
            envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
            scene.environment = envMap;
            hdrTexture.dispose();
          } catch (err) {
            console.warn("race: failed to build env map from HDRI, continuing without it", err);
          }
        },
        undefined,
        (err) => {
          console.warn("race: rooftop_night_1k.hdr failed to load, continuing without env reflections", err);
        }
      );
    } catch (err) {
      console.warn("race: HDRI/PMREM setup threw, continuing without env reflections", err);
    }

    progressCb(0.3);

    track = createTrack({ manager });
    scene.add(track.group);
    state.x = track.start.x;
    state.z = track.start.z;
    state.heading = track.start.heading;

    progressCb(0.55);

    carRig = createCar({ manager });
    scene.add(carRig.group);

    progressCb(0.75);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Strength/radius kept modest and threshold raised so only true
    // highlights (headlights, checkpoint ring, lit windows) bloom broadly;
    // the thin road-edge strips stay crisp lines instead of blown-out beams.
    // Strength trimmed from the primitive-only build's 0.4 — PBR specular
    // highlights on the car body now bloom on their own, so the old value
    // doubled up and washed the car out.
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.32, 0.78);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    progressCb(0.9);

    buildHud();

    try {
      kioskOverlay = createKioskOverlay(mount);
      questTracker = createQuestTracker(track.kiosks, handleFirstExplored);
    } catch (err) {
      console.warn("race: kiosk overlay/quest tracker failed to initialize, continuing without stage content", err);
      kioskOverlay = null;
      questTracker = null;
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    progressCb(1);

    // Render one frame synchronously so the caller never sees a blank
    // canvas between onReady() and the first animation frame.
    composer.render();
    readyCb();
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
  } catch (err) {
    // Defense in depth: WebGL context creation (or anything else here) can
    // fail even though the caller already checked WebGL2 support. Degrade
    // to a no-op scene instead of ever throwing out of this module.
    try {
      readyCb();
    } catch {
      /* not our problem */
    }
    return { dispose };
  }

  return { dispose };
}
