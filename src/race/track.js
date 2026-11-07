// Night street-racing track: a closed "stadium" loop (two straights joined
// by two semicircular turns) instead of the old single straight road, so
// the visitor can freely drive around and revisit any stage in any order.
// Built from primitive geometry + InstancedMesh for anything repeated
// (skyline, lane dashes) to keep draw calls low. The road surface carries a
// real PBR asphalt texture set (see loadAsphaltTextures below); the neon
// edge strips stay procedural.
//
// Geometry model: the centerline is parameterized by arc-length `s` in
// [0, TOTAL_LENGTH) via centerAt(s) -> {x, z, heading}. `heading` follows
// the same convention engine.js's car controller uses (0 = facing -Z),
// which makes the per-sample "right" vector (cos(heading), sin(heading))
// double as both the road's lateral axis and the car's steering frame —
// the same formula drives the road ribbon, the edge glow strips, lane
// dashes, kiosk placement, and the engine's stay-on-the-road clamp.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { STAGES } from "./stage-data.js";

export const ROAD_WIDTH = 10;

const RADIUS = 55; // turn radius, measured to the centerline
const STRAIGHT = 170; // length of each straight
const TURN_LENGTH = Math.PI * RADIUS;

export const TOTAL_LENGTH = 2 * STRAIGHT + 2 * TURN_LENGTH;

// Segment boundaries, walking the loop: straight A -> far turn B -> straight
// C -> near turn D -> back to A.
const SEG_A_END = STRAIGHT;
const SEG_B_END = SEG_A_END + TURN_LENGTH;
const SEG_C_END = SEG_B_END + STRAIGHT;
// SEG_D_END === TOTAL_LENGTH (implicit, loop wraps)

const SPAWN_S = 6; // a few units into segment A, clear of the s=0 seam

// Stage zone placement around the loop (arc-length positions). About/Skills
// sit early on the front straight; the 6 project kiosks run in a row down
// the back straight ("the longer stretch"); Contact lands late on the near
// turn, right before the lap closes — the natural "quest complete" stop.
const ABOUT_S = 26;
const SKILLS_S = STRAIGHT - 52;
const PROJECTS_COUNT = 6;
const PROJECTS_SPACING = 24;
const PROJECTS_START_S = SEG_B_END + 24;
const CONTACT_S = SEG_C_END + TURN_LENGTH * 0.72;

// How far off the centerline a kiosk's monument sits (toward the outside of
// the loop, away from the infield) — just past the road's edge glow strip,
// close enough that a straight drive-by alone reliably counts as "explored"
// (see quest-state.js INNER_RADIUS) without requiring the player to steer
// precisely onto the pull-off apron every time.
const KIOSK_LATERAL = ROAD_WIDTH / 2 + 1.5;
// The drivable-lane soft clamp normally keeps the car within this of the
// centerline; it widens automatically near each kiosk (see maxOffsetAt) so
// there's room to actually pull off toward one.
const BASE_MAX_OFFSET = ROAD_WIDTH / 2 - 0.6;
const WIDEN_RANGE = 10; // arc-length distance over which the widening ramps in
const WIDEN_AMOUNT = 3.2;

// Car collision against kiosk monuments (see resolveCollisions) backs the
// soft lane clamp up with a real geometric check so the car can get close
// to a kiosk without ever visually clipping through its pillar.
const CAR_COLLISION_MARGIN = 0.5;

const NEON_CYAN = 0x00d9ff;
const NEON_PINK = 0xff3d8f;

// Resolved against this module's own URL so the path is correct whether
// track.js loads via the real site's dynamic-import chain or directly from
// src/race/test.html.
const ASPHALT_DIR = new URL("./assets/asphalt021/", import.meta.url).href;

const ASPHALT_REPEAT_X = 3;
const ASPHALT_REPEAT_Y = Math.round(TOTAL_LENGTH * 0.16);

const SEGMENTS = 460; // ribbon resolution around the whole loop (~1.5 units/segment)

function loadAsphaltTextures(manager) {
  let loader;
  try {
    loader = new THREE.TextureLoader(manager);
  } catch (err) {
    console.warn("race: could not create TextureLoader for road surface, using flat color", err);
    return {};
  }
  const configure = (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ASPHALT_REPEAT_X, ASPHALT_REPEAT_Y);
    tex.anisotropy = 4;
  };
  const safeLoad = (file, isColor) => {
    try {
      const tex = loader.load(
        ASPHALT_DIR + file,
        configure,
        undefined,
        (err) => console.warn(`race: road texture "${file}" failed to load`, err)
      );
      configure(tex);
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    } catch (err) {
      console.warn(`race: TextureLoader threw loading "${file}", skipping it`, err);
      return null;
    }
  };
  return {
    map: safeLoad("Asphalt021_1K-JPG_Color.jpg", true),
    normalMap: safeLoad("Asphalt021_1K-JPG_NormalGL.jpg", false),
    roughnessMap: safeLoad("Asphalt021_1K-JPG_Roughness.jpg", false),
    aoMap: safeLoad("Asphalt021_1K-JPG_AmbientOcclusion.jpg", false),
  };
}

/** Centerline position + heading at arc-length `s` (wraps around the loop). */
function centerAt(sRaw) {
  const s = ((sRaw % TOTAL_LENGTH) + TOTAL_LENGTH) % TOTAL_LENGTH;
  if (s < SEG_A_END) {
    return { x: -RADIUS, z: -s, heading: 0 };
  }
  if (s < SEG_B_END) {
    const angle = (s - SEG_A_END) / RADIUS;
    return {
      x: -RADIUS * Math.cos(angle),
      z: -STRAIGHT - RADIUS * Math.sin(angle),
      heading: angle,
    };
  }
  if (s < SEG_C_END) {
    const u = s - SEG_B_END;
    return { x: RADIUS, z: -STRAIGHT + u, heading: Math.PI };
  }
  const angle2 = (s - SEG_C_END) / RADIUS;
  return {
    x: RADIUS * Math.cos(angle2),
    z: RADIUS * Math.sin(angle2),
    heading: Math.PI + angle2,
  };
}

// Dense precomputed samples for nearest-point lookups (stay-on-road clamp +
// widening near kiosks). Computed once at module load — the geometry is
// fixed, so every createTrack() call can share it.
const SAMPLE_STEP = 1.5;
const SAMPLE_COUNT = Math.ceil(TOTAL_LENGTH / SAMPLE_STEP);
const SAMPLES = [];
for (let i = 0; i < SAMPLE_COUNT; i++) {
  const s = (i / SAMPLE_COUNT) * TOTAL_LENGTH;
  SAMPLES.push({ s, ...centerAt(s) });
}

function nearestSample(x, z) {
  let best = SAMPLES[0];
  let bestD = Infinity;
  for (let i = 0; i < SAMPLES.length; i++) {
    const sm = SAMPLES[i];
    const dx = x - sm.x;
    const dz = z - sm.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = sm;
    }
  }
  return best;
}

function circularDist(a, b) {
  const d = Math.abs(a - b) % TOTAL_LENGTH;
  return Math.min(d, TOTAL_LENGTH - d);
}

function maxOffsetAt(s, kiosks) {
  let widen = 0;
  for (let i = 0; i < kiosks.length; i++) {
    const d = circularDist(s, kiosks[i].s);
    if (d < WIDEN_RANGE) {
      const factor = 1 - d / WIDEN_RANGE;
      if (factor * WIDEN_AMOUNT > widen) widen = factor * WIDEN_AMOUNT;
    }
  }
  return BASE_MAX_OFFSET + widen;
}

const collisionPoint = new THREE.Vector3();
function resolveCollisions(colliders, pos, carRadius) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const dx0 = pos.x - c.x;
    const dz0 = pos.z - c.z;
    const maxReach = carRadius + c.radius + 2;
    if (dx0 * dx0 + dz0 * dz0 > maxReach * maxReach) continue;
    collisionPoint.set(pos.x, Math.min(Math.max(c.height * 0.3, 0.6), c.height), pos.z);
    const hit = c.bvh.closestPointToPoint(collisionPoint, {}, 0, carRadius);
    if (hit && hit.distance < carRadius) {
      const dx = pos.x - hit.point.x;
      const dz = pos.z - hit.point.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 0.0001;
      const push = (carRadius - hit.distance) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
  return pos;
}

function buildGround(group) {
  const span = STRAIGHT + 2 * RADIUS + 160;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -STRAIGHT / 2);
  group.add(ground);
}

function buildRibbon(halfWidth, yOffset, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const s = (i / segments) * TOTAL_LENGTH;
    const { x: cx, z: cz, heading } = centerAt(s);
    const rx = Math.cos(heading);
    const rz = Math.sin(heading);
    positions.push(cx - rx * halfWidth, yOffset, cz - rz * halfWidth, cx + rx * halfWidth, yOffset, cz + rz * halfWidth);
    const t = i / segments;
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = i * 2;
    const b = i * 2 + 1;
    const c = next * 2;
    const d = next * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildEdgeStrip(sign, segments) {
  const halfWidth = ROAD_WIDTH / 2;
  const stripHalf = 0.09;
  const positions = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const s = (i / segments) * TOTAL_LENGTH;
    const { x: cx, z: cz, heading } = centerAt(s);
    const rx = Math.cos(heading);
    const rz = Math.sin(heading);
    const ox = cx + sign * halfWidth * rx;
    const oz = cz + sign * halfWidth * rz;
    positions.push(ox - stripHalf * rx, 0.05, oz - stripHalf * rz, ox + stripHalf * rx, 0.05, oz + stripHalf * rz);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = i * 2;
    const b = i * 2 + 1;
    const c = next * 2;
    const d = next * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoadSurface(group, manager) {
  const asphalt = loadAsphaltTextures(manager);
  const roadMat = new THREE.MeshStandardMaterial({
    color: asphalt.map ? 0xffffff : 0x14121c,
    roughness: 0.92,
    metalness: 0.06,
    side: THREE.DoubleSide,
    map: asphalt.map || null,
    normalMap: asphalt.normalMap || null,
    roughnessMap: asphalt.roughnessMap || null,
    aoMap: asphalt.aoMap || null,
  });
  const roadGeo = buildRibbon(ROAD_WIDTH / 2, 0, SEGMENTS);
  if (asphalt.aoMap) {
    roadGeo.setAttribute("uv2", roadGeo.getAttribute("uv"));
  }
  group.add(new THREE.Mesh(roadGeo, roadMat));

  const leftMat = new THREE.MeshStandardMaterial({
    color: NEON_CYAN,
    emissive: NEON_CYAN,
    emissiveIntensity: 0.65,
    side: THREE.DoubleSide,
  });
  const rightMat = new THREE.MeshStandardMaterial({
    color: NEON_PINK,
    emissive: NEON_PINK,
    emissiveIntensity: 0.65,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(buildEdgeStrip(-1, SEGMENTS), leftMat));
  group.add(new THREE.Mesh(buildEdgeStrip(1, SEGMENTS), rightMat));
}

function buildLaneDashes(group) {
  const dashGeo = new THREE.BoxGeometry(0.3, 0.02, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x7f93ab });
  const spacing = 14;
  const count = Math.floor(TOTAL_LENGTH / spacing);
  const inst = new THREE.InstancedMesh(dashGeo, dashMat, count);
  const m = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const s = i * spacing;
    const { x, z, heading } = centerAt(s);
    quat.setFromAxisAngle(axisY, -heading);
    m.compose(new THREE.Vector3(x, 0.02, z), quat, scale);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
}

function buildSkyline(group) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x171c38,
    roughness: 1,
    emissive: 0x2a2358,
    emissiveIntensity: 0.9,
  });
  const count = 70;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const s = (i / count) * TOTAL_LENGTH + Math.random() * 10;
    const { x: cx, z: cz, heading } = centerAt(s);
    const ox = -Math.cos(heading);
    const oz = -Math.sin(heading);
    const dist = 34 + Math.random() * 46;
    const x = cx + ox * dist;
    const z = cz + oz * dist;
    const w = 8 + Math.random() * 10;
    const h = 16 + Math.random() * 55;
    const d = 8 + Math.random() * 10;
    m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  // Scattered lit-window glow dots. toneMapped = false keeps these small
  // accents punchy under ACES filmic tone mapping instead of being crushed
  // down to near-invisible dots.
  const winGeo = new THREE.PlaneGeometry(1.6, 2.2);
  const winCount = 90;
  const buildWindowField = (color) => {
    const mat2 = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false });
    const winInst = new THREE.InstancedMesh(winGeo, mat2, winCount);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < winCount; i++) {
      const s = Math.random() * TOTAL_LENGTH;
      const { x: cx, z: cz, heading } = centerAt(s);
      const ox = -Math.cos(heading);
      const oz = -Math.sin(heading);
      const dist = 34 + Math.random() * 46;
      const x = cx + ox * dist;
      const z = cz + oz * dist;
      const y = 6 + Math.random() * 48;
      mm.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      winInst.setMatrixAt(i, mm);
    }
    winInst.instanceMatrix.needsUpdate = true;
    group.add(winInst);
  };
  buildWindowField(NEON_CYAN);
  buildWindowField(0xffb366);
}

/** A glowing kiosk/monument landmark (pillar + base ring + inward-facing panel). */
function buildKioskMonument({ x, z, heading, color, big }) {
  const group = new THREE.Group();
  const pillarHeight = big ? 5.2 : 4.2;
  const pillarRadius = 0.32;

  const pillarMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    metalness: 0.3,
    roughness: 0.35,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(pillarRadius, pillarRadius * 1.3, pillarHeight, 12), pillarMat);
  pillar.position.set(x, pillarHeight / 2, z);
  group.add(pillar);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.3, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x14121c, roughness: 0.8, metalness: 0.1 })
  );
  base.position.set(x, 0.15, z);
  group.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.12, 8, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.32, z);
  group.add(ring);

  // Inward-facing glow panel so the landmark reads clearly as the driver
  // approaches, independent of the DOM content card.
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.05),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
  );
  panel.position.set(x, pillarHeight * 0.62, z);
  panel.rotation.y = heading + Math.PI / 2;
  group.add(panel);

  const glow = new THREE.PointLight(color, 5, 16, 2);
  glow.position.set(x, pillarHeight * 0.55, z);
  group.add(glow);

  const colliderRadius = pillarRadius + CAR_COLLISION_MARGIN;
  const colliderGeo = new THREE.CylinderGeometry(colliderRadius, colliderRadius, pillarHeight, 10);
  colliderGeo.translate(x, pillarHeight / 2, z);

  return { group, colliderGeo, colliderRadius, height: pillarHeight };
}

function kioskPosition(s, lateral) {
  const { x: cx, z: cz, heading } = centerAt(s);
  const ox = -Math.cos(heading);
  const oz = -Math.sin(heading);
  return { x: cx + ox * lateral, z: cz + oz * lateral, heading };
}

function buildKiosks(group) {
  const kiosks = [];
  const colliders = [];

  const add = (stageId, subIndex, s, color, big) => {
    const { x, z, heading } = kioskPosition(s, KIOSK_LATERAL);
    const monument = buildKioskMonument({ x, z, heading, color, big });
    group.add(monument.group);

    let bvh = null;
    try {
      bvh = new MeshBVH(monument.colliderGeo);
    } catch (err) {
      console.warn("race: failed to build collision BVH for a kiosk, it will be walk-through only", err);
    }
    if (bvh) colliders.push({ x, z, bvh, radius: monument.colliderRadius, height: monument.height });

    kiosks.push({
      key: subIndex == null ? stageId : `${stageId}-${subIndex}`,
      stageId,
      subIndex,
      s,
      x,
      z,
    });
  };

  add("about", null, ABOUT_S, STAGES.about.color, true);
  add("skills", null, SKILLS_S, STAGES.skills.color, true);
  for (let i = 0; i < PROJECTS_COUNT; i++) {
    add("projects", i, PROJECTS_START_S + i * PROJECTS_SPACING, STAGES.projects.color, false);
  }
  add("contact", null, CONTACT_S, STAGES.contact.color, true);

  return { kiosks, colliders };
}

export function createTrack({ manager } = {}) {
  const group = new THREE.Group();
  group.name = "track";

  buildGround(group);
  buildRoadSurface(group, manager);
  buildLaneDashes(group);
  buildSkyline(group);
  const { kiosks, colliders } = buildKiosks(group);

  return {
    group,
    kiosks,
    roadHalfWidth: ROAD_WIDTH / 2,
    totalLength: TOTAL_LENGTH,
    start: centerAt(SPAWN_S),
    nearestSample,
    maxOffsetAt: (s) => maxOffsetAt(s, kiosks),
    resolveCollisions: (pos, carRadius) => resolveCollisions(colliders, pos, carRadius),
  };
}
