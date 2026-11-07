// Chase-cam sports car. Loads a real glTF model (CC0, Quaternius/Poly Pizza)
// and upgrades its shipped materials to a clear-coat PBR look so it catches
// specular highlights + HDRI reflections instead of reading flat.
//
// Robustness contract: createCar() always returns a usable rig synchronously
// (a primitive-built fallback car, visually close to the old look) so the
// controller in engine.js never has to special-case "model not loaded yet".
// If the glTF loads successfully, the fallback is torn down and replaced;
// if it fails for any reason, we log a warning and just keep driving the
// fallback car — initRace's "never throw synchronously" contract extends
// to this async swap too.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CYAN = 0x00d9ff;
const PINK = 0xff3d8f;
const PURPLE = 0xa855f7;

// Resolved against this module's own URL (not document.baseURI) so the path
// is correct whether car.js is loaded from the real site's src/main.js
// dynamic-import chain or directly from src/race/test.html.
const CAR_MODEL_URL = new URL("./assets/sports_car_variant2.glb", import.meta.url).href;

// Ballpark footprint of the old primitive car / the existing 10-unit-wide
// road, used to scale whichever model variant we load.
const TARGET_LENGTH = 4.0;

// --- Fallback primitive car (used immediately, and kept if the glTF load fails) ---
function buildFallback(group) {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b3568,
    metalness: 0.5,
    roughness: 0.3,
    emissive: new THREE.Color(PURPLE),
    emissiveIntensity: 0.22,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: CYAN,
    emissive: CYAN,
    emissiveIntensity: 1.0,
    metalness: 0.2,
    roughness: 0.3,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x05050a,
    metalness: 0.3,
    roughness: 0.15,
    transparent: true,
    opacity: 0.88,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x5a5a68, roughness: 0.5, metalness: 0.4 });
  const hubMat = new THREE.MeshStandardMaterial({ color: PURPLE, emissive: PURPLE, emissiveIntensity: 1.6 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
  const tailMatBase = new THREE.MeshStandardMaterial({ color: PINK, emissive: PINK, emissiveIntensity: 0.9 });

  const root = new THREE.Group();
  root.name = "car-fallback";
  const disposables = [];
  const track = (mesh) => {
    root.add(mesh);
    disposables.push(mesh);
    return mesh;
  };

  track(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 3.6), bodyMat)).position.y = 0.42;
  track(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.7), bodyMat)).position.set(0, 0.32, -1.9);
  track(new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.07, 3.7), trimMat)).position.y = 0.2;
  track(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 1.6), cabinMat)).position.set(0, 0.86, -0.15);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.55, 16);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.42, 10);
  const wheelPositions = [
    [1.18, 0.38, -1.15],
    [-1.18, 0.38, -1.15],
    [1.18, 0.38, 1.15],
    [-1.18, 0.38, 1.15],
  ];
  const wheels = wheelPositions.map(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    root.add(wheel);
    disposables.push(wheel, hub);
    return wheel;
  });

  const headlightGeo = new THREE.SphereGeometry(0.11, 10, 10);
  [[0.62, 0.45, -1.78], [-0.62, 0.45, -1.78]].forEach(([x, y, z]) => {
    track(new THREE.Mesh(headlightGeo, headlightMat)).position.set(x, y, z);
  });

  const headlightSpots = [];
  [[0.62, 0.45, -1.78], [-0.62, 0.45, -1.78]].forEach(([x, y, z]) => {
    const spot = new THREE.SpotLight(0xdfefff, 9, 45, Math.PI / 7, 0.45, 1.3);
    spot.position.set(x, y, z);
    const target = new THREE.Object3D();
    target.position.set(x * 0.4, -0.3, z - 24);
    root.add(target);
    spot.target = target;
    root.add(spot);
    headlightSpots.push(spot);
  });

  const tailGeo = new THREE.BoxGeometry(0.4, 0.17, 0.08);
  const tailMaterials = [];
  [[0.65, 0.48, 1.82], [-0.65, 0.48, 1.82]].forEach(([x, y, z]) => {
    const mat = tailMatBase.clone();
    track(new THREE.Mesh(tailGeo, mat)).position.set(x, y, z);
    tailMaterials.push(mat);
  });

  group.add(root);

  return {
    root,
    disposables,
    rig: { wheels, headlightSpots, headlightMeshes: [], tailMaterials, bodyMat, trimMat },
  };
}

function disposeFallback(fallback) {
  if (!fallback) return;
  try {
    fallback.root.parent?.remove(fallback.root);
    fallback.disposables.forEach((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m?.dispose?.());
    });
  } catch {
    /* best-effort teardown of the primitive placeholder */
  }
}

// --- Loaded glTF model handling ---

// obj2gltf-exported wheel nodes bake the wheel's world-ish offset directly
// into the geometry (the node transform itself is identity), so spinning a
// node's rotation.x as-is would orbit it around the origin instead of
// turning in place. Re-center each wheel node's geometry onto its own hub
// and move that offset onto the node's position instead, so later frame
// updates (engine.js does `wheel.rotation.x -= wheelSpin`) spin it correctly.
function recenterWheelNode(node) {
  const box = new THREE.Box3();
  let has = false;
  node.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox) {
        box.union(child.geometry.boundingBox);
        has = true;
      }
    }
  });
  if (!has) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  node.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.translate(-center.x, -center.y, -center.z);
    }
  });
  node.position.add(center);
}

// Collect the outermost node(s) whose name marks them as a wheel, without
// descending into their children (each wheel is exported as one node, but
// multi-primitive nodes become a small Group of Mesh children underneath).
function collectWheelNodes(root) {
  const found = [];
  function walk(obj) {
    if (/wheel/i.test(obj.name)) {
      found.push(obj);
      return;
    }
    obj.children.forEach(walk);
  }
  root.children.forEach(walk);
  return found;
}

function upgradeMaterials(model) {
  let bodyMat = null;
  const tailMaterials = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      if (!m || !m.isMeshStandardMaterial) return;
      if (/headlight/i.test(m.name)) {
        m.emissive = new THREE.Color(0xffffff);
        m.emissiveIntensity = 2.0;
        m.toneMapped = false;
        // Left at the export's default metalness(0)/envMapIntensity(1) this
        // lamp housing picks up its own HDRI/moonlight glint on top of its
        // emissive glow — same clamp as the body panels below.
        m.envMapIntensity = 0.3;
      } else if (/taillight/i.test(m.name)) {
        m.emissive = new THREE.Color(PINK);
        m.emissiveIntensity = 0.9;
        m.envMapIntensity = 0.3;
        if (!tailMaterials.includes(m)) tailMaterials.push(m);
      } else {
        // Body panels / trim / glass: push toward a clear-coat PBR look so
        // they actually catch specular highlights + HDRI reflections
        // instead of the flat/matte look the source export ships with
        // (metalness 0, roughness ~0.9 on every material).
        //
        // metalness/envMapIntensity both kept well below the 0.82/1.3 this
        // first shipped with. At the chase cam's 7.6-unit follow distance,
        // a near-fully-metallic body sweeps a tight, intense specular lobe
        // (from both the HDRI's one bright patch *and* the scene's direct
        // lights, e.g. the camera-following point light — only the former
        // is gated by envMapIntensity, which is why tuning that alone
        // wasn't enough) across the camera as the car's heading changes —
        // i.e. during any turn, and for however long the resulting heading
        // then sits in that range afterward. That highlight blooms into a
        // screen-filling white halo that makes a correctly-rendered REAR
        // view misread as the car's bright headlight cluster facing the
        // camera. This was mistaken for a model/heading rotation desync —
        // it is not one (verified live: the model's composed world
        // rotation tracks `heading` exactly, every frame, with no drift,
        // through and after turns in both directions) — it is this
        // specular hot-spot blooming unchecked. Confirmed by isolation
        // (zeroing scene.environment, and separately zeroing metalness,
        // each independently killed the flare): low metalness is what
        // actually tames it; a low but nonzero envMapIntensity then keeps
        // a faint clear-coat glint without letting it flare past the
        // headlight/taillight emissive materials in brightness.
        m.metalness = /window/i.test(m.name) ? 0.2 : 0.15;
        m.roughness = /window/i.test(m.name) ? 0.35 : 0.45;
        m.envMapIntensity = 0.3;
        if (!bodyMat && /orange|white|dark|grey|gray/i.test(m.name)) bodyMat = m;
      }
    });
  });
  return { bodyMat, tailMaterials };
}

function buildHeadlights(root, box) {
  const halfW = (box.max.x - box.min.x) / 2;
  const y = box.min.y + (box.max.y - box.min.y) * 0.32;
  const frontZ = box.min.z + 0.1; // front, after the 180deg flip, is -Z (min)
  const headlightSpots = [];
  [-1, 1].forEach((side) => {
    const x = side * halfW * 0.55;
    const spot = new THREE.SpotLight(0xdfefff, 9, 45, Math.PI / 7, 0.45, 1.3);
    spot.position.set(x, y, frontZ);
    const target = new THREE.Object3D();
    target.position.set(x * 0.4, y - 0.3, frontZ - 24);
    root.add(target);
    spot.target = target;
    root.add(spot);
    headlightSpots.push(spot);
  });
  return headlightSpots;
}

function applyModel(gltf, group) {
  const model = gltf.scene;

  const wheelNodes = collectWheelNodes(model);
  wheelNodes.forEach(recenterWheelNode);

  // Model is not yet parented to anything, so updateMatrixWorld here is
  // purely local — safe to measure regardless of where `group` has driven
  // to by the time this (async) load finishes.
  model.updateMatrixWorld(true);
  const rawSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const scaleFactor = TARGET_LENGTH / Math.max(rawSize.z, 0.001);
  model.scale.setScalar(scaleFactor);

  // Both shipped variants export with headlights/front wheels toward +Z;
  // this scene's controller treats -Z as "forward", so flip 180 degrees.
  model.rotation.y = Math.PI;

  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y; // rest the wheels on the ground plane

  model.updateMatrixWorld(true);
  const { bodyMat, tailMaterials } = upgradeMaterials(model);

  const finalBox = new THREE.Box3().setFromObject(model);
  const headlightSpots = buildHeadlights(group, finalBox);

  group.add(model);

  return {
    wheels: wheelNodes,
    headlightSpots,
    headlightMeshes: [],
    tailMaterials,
    bodyMat,
    trimMat: null,
  };
}

export function createCar({ manager } = {}) {
  const group = new THREE.Group();
  group.name = "car";

  const fallback = buildFallback(group);
  const rig = fallback.rig;
  rig.group = group;

  try {
    const loader = new GLTFLoader(manager);
    loader.load(
      CAR_MODEL_URL,
      (gltf) => {
        try {
          const loaded = applyModel(gltf, group);
          disposeFallback(fallback);
          rig.wheels = loaded.wheels;
          rig.headlightSpots = loaded.headlightSpots;
          rig.headlightMeshes = loaded.headlightMeshes;
          rig.tailMaterials = loaded.tailMaterials;
          rig.bodyMat = loaded.bodyMat;
          rig.trimMat = loaded.trimMat;
        } catch (err) {
          console.warn("race: failed to apply loaded car model, keeping fallback car", err);
        }
      },
      undefined,
      (err) => {
        console.warn("race: sports_car.glb failed to load, using fallback primitive car", err);
      }
    );
  } catch (err) {
    console.warn("race: GLTFLoader threw while starting car model load, using fallback primitive car", err);
  }

  return rig;
}
