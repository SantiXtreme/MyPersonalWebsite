// Shared, framework-agnostic 3D grand piano used by the site's Recital
// section instead of a flat clickable-key widget. Built from procedural
// Three.js geometry (no external 3D model / no external textures), styled
// as a generic glossy concert grand — deliberately not reproducing any real
// manufacturer's wordmark/logo (that's trademarked branding; the shape and
// lacquer-finish material quality do the work of reading as "premium
// concert grand" without it). Modeled against design-reference/GRANDPIANO.jpeg
// (a detailed studio render: glossy black lacquer, brass lid trim, tapered
// legs on brass cup casters, twin pedals, a tufted-leather bench) for the
// fidelity target — everything in that reference except the wordmark is
// reproduced here (bench included, see below).
//
// Usage:
//   import { createGrandPiano3D, CAMERA_PRESETS } from './shared/piano3d.js';
//   const piano = createGrandPiano3D(containerEl, { cameraPreset: 'hero' });
//   piano.pressKey(60, { velocity: 0.9, sustain: 1.4 });   // middle C, by MIDI number
//   piano.dispose();                                        // on section teardown

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import gsap from 'gsap';

const WHITE_KEY_LEN = 0.15; // meters, visible length of a white key
const WHITE_KEY_WIDTH = 0.0235;
const WHITE_KEY_GAP = 0.001;
const BLACK_KEY_LEN = 0.095;
const BLACK_KEY_WIDTH = 0.012;
const BLACK_KEY_HEIGHT = 0.018;
const WHITE_KEY_HEIGHT = 0.014;

const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_LETTERS = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);
const START_MIDI = 21; // A0
const END_MIDI = 108; // C8, full 88-key range

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Two named camera anchors shared by every concept's choreography (dolly-in,
// camera-fly, etc.) so tuning the shot only ever happens in one place instead
// of being copy-pasted per concept.
//
// 'hero' and 'stage' are deliberately wide, concert-hall-distance shots —
// user feedback on an earlier close-up framing was that the piano's
// procedural geometry reads as visually confusing up close ("the keys and
// the black part are in the wrong order"); pulled back to a small piano on
// a lit stage (see buildBackdrop() below), that same geometry just reads as
// "a shiny grand piano," which is all a background element needs to do.
// 'keys' stays closer for when a song is actually playing.
export const CAMERA_PRESETS = {
  hero: { pos: [10.5, 5.2, -5.4], look: [0.8, 0.7, 1.4] },
  keys: { pos: [2.6, 1.85, -0.8], look: [0.78, 0.74, 0.05] },
  stage: { pos: [16, 7.4, -8.2], look: [0.8, 0.7, 1.5] },
};

function buildBodyShape() {
  // A stylized concert-grand silhouette (top-down), roughly to real scale
  // in meters. Origin sits at the keyboard's front-left corner; +Z runs
  // away from the player toward the tail, +X runs left-to-right (bass to
  // treble — the camera's default "hero" angle looks in from the treble/+X
  // side, per CAMERA_PRESETS above).
  // Note: Y here is negated distance-from-player-away-from-keyboard — the
  // body/rim/lid all get rotateX(-90deg), which maps shape-Y to world -Z,
  // so authoring with negative Y gives the intended positive world Z
  // (matching the leg/light/camera coordinates below, which use positive Z
  // for "toward the tail").
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, -0.6);
  s.bezierCurveTo(0, -1.0, -0.36, -1.1, -0.36, -1.62);
  s.bezierCurveTo(-0.36, -2.24, 0.03, -2.48, 0.56, -2.7);
  s.bezierCurveTo(0.98, -2.86, 1.3, -2.9, 1.62, -2.86);
  s.bezierCurveTo(2.05, -2.81, 2.16, -2.44, 2.08, -2.0);
  s.bezierCurveTo(1.99, -1.5, 1.78, -1.12, 1.64, -0.74);
  s.bezierCurveTo(1.55, -0.44, 1.52, -0.2, 1.52, 0);
  s.lineTo(0, 0);
  return s;
}

function buildLidShape() {
  // Slightly inset copy of the body shape's back 2/3 (the lid doesn't
  // cover the keyboard end).
  const s = new THREE.Shape();
  s.moveTo(0.08, -0.54);
  s.bezierCurveTo(0.08, -0.9, -0.29, -1.02, -0.29, -1.6);
  s.bezierCurveTo(-0.29, -2.2, 0.09, -2.4, 0.58, -2.6);
  s.bezierCurveTo(0.98, -2.75, 1.28, -2.79, 1.58, -2.75);
  s.bezierCurveTo(1.98, -2.7, 2.07, -2.38, 2.0, -1.98);
  s.bezierCurveTo(1.92, -1.55, 1.74, -1.2, 1.6, -0.82);
  s.bezierCurveTo(1.52, -0.6, 1.5, -0.52, 1.5, -0.52);
  s.lineTo(0.08, -0.54);
  return s;
}

// Thin brass piping that traces the lid's outer curve (GRANDPIANO.jpeg
// reference has a bright trim line running the length of the raised lid
// edge). Sampling the same buildLidShape() curve keeps it perfectly matched
// to the lid silhouette instead of an independently-guessed path. Points are
// mapped with the same (x, y) -> (x, -y) swap that lidGeo's rotateX(-90deg)
// bakes in, so this tube sits in the same local space as `lid` and can be
// parented/positioned identically.
function buildLidTrimGeometry() {
  const pts2d = buildLidShape().getPoints(90);
  const pts3d = pts2d.map((p) => new THREE.Vector3(p.x, 0, -p.y));
  const curve = new THREE.CatmullRomCurve3(pts3d, true);
  return new THREE.TubeGeometry(curve, 240, 0.0055, 8, true);
}

function buildPlateShape() {
  // The cast-iron plate: an inset copy of the lid footprint (sits inside
  // the rim with a visible gap at the perimeter) with three oval hand-hole
  // cutouts, matching the reference photo of the real instrument's open lid.
  const s = new THREE.Shape();
  s.moveTo(0.22, -0.62);
  s.bezierCurveTo(0.22, -0.94, -0.06, -1.04, -0.06, -1.56);
  s.bezierCurveTo(-0.06, -2.1, 0.26, -2.28, 0.66, -2.46);
  s.bezierCurveTo(1.0, -2.6, 1.24, -2.64, 1.48, -2.6);
  s.bezierCurveTo(1.8, -2.55, 1.87, -2.28, 1.8, -1.94);
  s.bezierCurveTo(1.72, -1.55, 1.56, -1.22, 1.44, -0.88);
  s.bezierCurveTo(1.37, -0.68, 1.35, -0.6, 1.35, -0.6);
  s.lineTo(0.22, -0.62);

  [
    { cx: 0.55, cy: -1.15, rx: 0.16, ry: 0.22 },
    { cx: 0.95, cy: -1.75, rx: 0.19, ry: 0.26 },
    { cx: 1.25, cy: -2.15, rx: 0.14, ry: 0.2 },
  ].forEach(({ cx, cy, rx, ry }) => {
    const hole = new THREE.Path();
    hole.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
    s.holes.push(hole);
  });
  return s;
}

// A small custom "studio" environment: mostly dark, with a handful of
// bright rectangular panels at deliberate angles. Three.js's stock
// RoomEnvironment (three/addons/environments/RoomEnvironment.js) lights an
// enclosed room from ~6 directions with several intensity-17-100 panels —
// excellent for varied product shots, but on a clearcoat=1 near-black
// lacquer it means there's bright light coming from almost everywhere at
// once, which averages out across the surface's curvature into a flat grey
// wash instead of "black with crisp highlights." Keeping most directions
// dark and using only a few strong sources produces the sharp, streaky
// highlight sweeps a real glossy piano photograph has.
function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x030303);

  function panel(w, h, x, y, z, ry, color, intensity) {
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
    mat.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    envScene.add(mesh);
  }
  panel(9, 2.4, 2, 6, -6, 0, 0xfff3d6, 5); // main overhead sweep down the lid/lacquer
  panel(6, 10, -9, 2, 1, Math.PI / 2, 0xcfe0ff, 1.4); // cool side fill
  panel(4, 7, 8, 3, 4, -Math.PI / 2, 0xffdfae, 2.2); // warm rim kicker
  panel(7, 1, 0, -1, 7, Math.PI, 0xffe9c8, 1.1); // low warm bounce behind the tail

  const envMap = pmrem.fromScene(envScene, 0.035).texture;
  envScene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  pmrem.dispose();
  return envMap;
}

// Warm wood-paneled concert-hall backdrop — visible geometry (not just
// environment lighting) so the now-much-wider default camera framing (see
// CAMERA_PRESETS) has an actual stage around the piano instead of void.
// Flat panels only, no external textures: a back wall, an angled "ceiling"
// sweeping down toward it, a few horizontal band accents for paneling, and
// two angled wings for a soft proscenium.
function buildBackdrop() {
  const group = new THREE.Group();

  // The piano's own light rig (below) is tuned for close-range illumination
  // of the instrument, not a 20+-unit-wide hall — so these carry their own
  // `emissive` glow rather than depending on scene lights to reach them.
  // Keeps them reading as "warm lit wood" without needing to re-tune the
  // whole rig's falloff distances around the (already-dialed-in) piano.
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a24,
    roughness: 0.85,
    side: THREE.DoubleSide,
    emissive: 0x5a3a24,
    emissiveIntensity: 0.5,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 11), wallMat);
  wall.position.set(2, 5, 10.5);
  wall.receiveShadow = true;
  group.add(wall);

  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x6d4a2e,
    roughness: 0.8,
    side: THREE.DoubleSide,
    emissive: 0x6d4a2e,
    emissiveIntensity: 0.68,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), ceilMat);
  ceiling.position.set(2, 9.8, 2);
  ceiling.rotation.x = THREE.MathUtils.degToRad(58);
  group.add(ceiling);

  [0x63412a, 0x4d3220, 0x6d4930, 0x563723].forEach((c, i) => {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 0.5),
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.75,
        side: THREE.DoubleSide,
        emissive: c,
        emissiveIntensity: 0.5,
      })
    );
    band.position.set(2, 1.4 + i * 2.2, 10.4);
    group.add(band);
  });

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x261c15,
    roughness: 0.9,
    side: THREE.DoubleSide,
    emissive: 0x261c15,
    emissiveIntensity: 0.3,
  });
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), wingMat);
  wingL.position.set(-7.5, 5, 4);
  wingL.rotation.y = THREE.MathUtils.degToRad(35);
  group.add(wingL);
  const wingR = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), wingMat.clone());
  wingR.position.set(11.5, 5, 4);
  wingR.rotation.y = THREE.MathUtils.degToRad(-35);
  group.add(wingR);

  return group;
}

export function createGrandPiano3D(container, options = {}) {
  const {
    cameraPreset = 'hero', // 'hero' | 'keys' | 'stage'
    exposure = 1.05,
    floor = true,
    floorColor = 0x0b0b0e,
    accentColor = 0xc9a86a,
    bodyColor = 0x07070a,
  } = options;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  const preset = CAMERA_PRESETS[cameraPreset] || CAMERA_PRESETS.hero;
  camera.position.set(...preset.pos);
  camera.lookAt(...preset.look);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const envMap = makeEnvironment(renderer);
  scene.environment = envMap;

  scene.add(buildBackdrop());

  // ---- materials ----
  // DoubleSide on the extruded-shape materials: the extrude's winding
  // direction is easy to get backwards by hand (see the coordinate-sign
  // comment on buildBodyShape) and a single-sided material would render
  // large chunks of the case invisible/inside-out if it's ever off.
  const lacquer = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.06,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
  });
  const lacquerInner = new THREE.MeshPhysicalMaterial({
    color: 0x040404,
    metalness: 0.05,
    roughness: 0.24,
    clearcoat: 0.5,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  const goldHardware = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.92,
    roughness: 0.25,
    envMapIntensity: 1.3,
  });
  const plateGold = new THREE.MeshStandardMaterial({
    color: 0xb8935a,
    metalness: 0.75,
    roughness: 0.4,
    envMapIntensity: 1.0,
  });
  const soundboardMat = new THREE.MeshStandardMaterial({
    color: 0x7a4a26,
    roughness: 0.7,
    envMapIntensity: 0.4,
  });
  const stringMat = new THREE.MeshStandardMaterial({
    color: 0xe7e2d6,
    metalness: 0.85,
    roughness: 0.3,
    envMapIntensity: 1.1,
  });
  const whiteKeyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf6f2e7,
    roughness: 0.35,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.6,
  });
  const blackKeyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0c,
    roughness: 0.26,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.85,
  });
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x6b1620, roughness: 0.95 });
  // Matching bench's tufted-leather top (GRANDPIANO.jpeg reference).
  const benchLeather = new THREE.MeshPhysicalMaterial({
    color: 0x0e0b0a,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.7,
  });

  // ---- group root (so the whole instrument can be scaled/positioned by the host) ----
  const root = new THREE.Group();
  scene.add(root);

  // ---- body ----
  const bodyShape = buildBodyShape();
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 32,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.translate(0, 0.32, 0); // sits on legs
  const body = new THREE.Mesh(bodyGeo, lacquer);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  // body top cap sits at world y = 0.32 + 0.42 = 0.74 — the interior
  // detail below is layered just above it.

  // ---- open-lid interior: soundboard, gold plate, strings ----
  // (Modeled directly on the user's Steinway reference photo — this is
  // what used to be a single flat grey "rim" slab.)
  const soundboardGeo = new THREE.ShapeGeometry(buildLidShape(), 32);
  soundboardGeo.rotateX(-Math.PI / 2);
  soundboardGeo.translate(0, 0.741, 0);
  const soundboard = new THREE.Mesh(soundboardGeo, soundboardMat);
  soundboard.receiveShadow = true;
  root.add(soundboard);

  const plateGeo = new THREE.ExtrudeGeometry(buildPlateShape(), {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 24,
  });
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(0, 0.75, 0);
  const plate = new THREE.Mesh(plateGeo, plateGold);
  plate.receiveShadow = true;
  root.add(plate);

  const STRING_COUNT = 40;
  const stringsGroup = new THREE.Group();
  for (let i = 0; i < STRING_COUNT; i++) {
    const t = i / (STRING_COUNT - 1); // 0 = bass (long, thick), 1 = treble (short, thin)
    const x = lerp(0.08, 1.86, t);
    const len = lerp(2.3, 0.68, t);
    const zStart = lerp(0.6, 0.66, t);
    const radius = lerp(0.0017, 0.0008, t);
    const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
    const mesh = new THREE.Mesh(geo, stringMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, 0.768, zStart + len / 2);
    stringsGroup.add(mesh);
  }
  root.add(stringsGroup);

  // ---- lid (propped open) ----
  const lidShape = buildLidShape();
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 32,
  });
  lidGeo.rotateX(-Math.PI / 2);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.735, 0.5);
  const lid = new THREE.Mesh(lidGeo, lacquer);
  lid.position.set(0, 0, -0.5);
  lid.castShadow = true;
  lidPivot.add(lid);

  // brass piping along the lid's outer edge — same reference detail that
  // makes GRANDPIANO.jpeg's lid read as fitted furniture, not a bare panel.
  const lidTrim = new THREE.Mesh(buildLidTrimGeometry(), goldHardware);
  lidTrim.position.set(0, 0.0015, -0.5);
  lidPivot.add(lidTrim);

  lidPivot.rotation.z = THREE.MathUtils.degToRad(44); // propped open (lifts the +X/treble side)
  root.add(lidPivot);

  // lid prop stick
  const propGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 8);
  const prop = new THREE.Mesh(propGeo, lacquer);
  prop.position.set(1.3, 1.02, 1.5);
  prop.rotation.z = THREE.MathUtils.degToRad(8);
  prop.rotation.x = THREE.MathUtils.degToRad(-4);
  root.add(prop);

  // ---- legs ----
  // legRadiusTop/Bottom let the (smaller, lighter) bench legs below reuse
  // this same builder instead of a second hand-tuned copy.
  function makeLeg(x, z, legRadiusTop = 0.05, legRadiusBottom = 0.035, legHeight = 0.72) {
    const g = new THREE.Group();
    const legGeo = new THREE.CylinderGeometry(legRadiusTop, legRadiusBottom, legHeight, 12);
    const leg = new THREE.Mesh(legGeo, lacquer);
    leg.position.y = legHeight / 2;
    leg.castShadow = true;
    g.add(leg);
    // brass cup collar just above the caster ball — reads as furniture-grade
    // hardware rather than a bare sphere (matches GRANDPIANO.jpeg reference).
    const cupGeo = new THREE.CylinderGeometry(legRadiusBottom * 1.15, legRadiusBottom * 0.92, 0.026, 14);
    const cup = new THREE.Mesh(cupGeo, goldHardware);
    cup.position.y = 0.013;
    g.add(cup);
    const casterGeo = new THREE.SphereGeometry(legRadiusBottom * 0.75, 10, 10);
    const caster = new THREE.Mesh(casterGeo, goldHardware);
    caster.position.y = 0.004;
    g.add(caster);
    g.position.set(x, 0, z);
    return g;
  }
  root.add(makeLeg(0.12, 0.15));
  root.add(makeLeg(1.42, 0.15));
  root.add(makeLeg(0.62, 2.55));

  // ---- bench (tufted-leather top, matching GRANDPIANO.jpeg's companion
  // bench) — sits in front of the keyboard, on the player's side. ----
  const benchGroup = new THREE.Group();
  const BENCH_W = 0.5;
  const BENCH_D = 0.3;
  const BENCH_LEG_H = 0.42;
  const BENCH_TOP_H = 0.06;
  [
    [-BENCH_W / 2 + 0.05, -BENCH_D / 2 + 0.04],
    [BENCH_W / 2 - 0.05, -BENCH_D / 2 + 0.04],
    [-BENCH_W / 2 + 0.05, BENCH_D / 2 - 0.04],
    [BENCH_W / 2 - 0.05, BENCH_D / 2 - 0.04],
  ].forEach(([lx, lz]) => {
    const leg = makeLeg(lx, lz, 0.022, 0.016, BENCH_LEG_H);
    benchGroup.add(leg);
  });
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(BENCH_W, BENCH_TOP_H, BENCH_D), benchLeather);
  benchTop.position.y = BENCH_LEG_H + BENCH_TOP_H / 2;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  benchGroup.add(benchTop);
  // a subtle button-tuft grid on the cushion top — small dark dimples via
  // tiny spheres rather than a texture (keeping the "no external textures"
  // rule from the file header).
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.8 });
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), tuftMat);
      tuft.position.set(ix * (BENCH_W / 4), BENCH_LEG_H + BENCH_TOP_H, iz * (BENCH_D / 4));
      benchGroup.add(tuft);
    }
  }
  benchGroup.position.set(0.68, 0, -0.62);
  root.add(benchGroup);

  // ---- keybed + keys ----
  const keyboardGroup = new THREE.Group();
  keyboardGroup.position.set(0.14, 0.7, -0.08);
  root.add(keyboardGroup);

  const keybedGeo = new THREE.BoxGeometry(1.22, 0.02, WHITE_KEY_LEN + 0.02);
  const keybed = new THREE.Mesh(keybedGeo, lacquerInner);
  keybed.position.set(0.61, -0.011, WHITE_KEY_LEN / 2);
  keyboardGroup.add(keybed);

  // fallboard (decorative bar behind the keys, where the maker's name would go —
  // left plain on purpose, see file header)
  const fallGeo = new THREE.BoxGeometry(1.24, 0.05, 0.02);
  const fallboard = new THREE.Mesh(fallGeo, lacquer);
  fallboard.position.set(0.61, 0.03, -0.02);
  keyboardGroup.add(fallboard);
  const feltStrip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.006, 0.01), feltMat);
  feltStrip.position.set(0.61, 0.005, 0.005);
  keyboardGroup.add(feltStrip);

  const whiteKeyGeo = new THREE.BoxGeometry(WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, WHITE_KEY_LEN);
  whiteKeyGeo.translate(0, -WHITE_KEY_HEIGHT / 2, WHITE_KEY_LEN / 2); // pivot at back-top edge
  const blackKeyGeo = new THREE.BoxGeometry(BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, BLACK_KEY_LEN);
  blackKeyGeo.translate(0, -BLACK_KEY_HEIGHT / 2, BLACK_KEY_LEN / 2);

  const keyMeshes = new Map(); // midi -> mesh
  const whites = [];
  const blacks = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const letter = NOTE_ORDER[midi % 12];
    if (BLACK_LETTERS.has(letter)) blacks.push({ midi, afterWhiteIndex: whites.length - 1 });
    else whites.push({ midi });
  }
  const wCount = whites.length;
  const totalWidth = wCount * (WHITE_KEY_WIDTH + WHITE_KEY_GAP);
  const startX = 0.61 - totalWidth / 2;

  whites.forEach((w, i) => {
    const mesh = new THREE.Mesh(whiteKeyGeo, whiteKeyMat);
    mesh.position.set(startX + i * (WHITE_KEY_WIDTH + WHITE_KEY_GAP), WHITE_KEY_HEIGHT, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    keyboardGroup.add(mesh);
    keyMeshes.set(w.midi, mesh);
  });
  blacks.forEach((b) => {
    const x = startX + (b.afterWhiteIndex + 1) * (WHITE_KEY_WIDTH + WHITE_KEY_GAP);
    const mesh = new THREE.Mesh(blackKeyGeo, blackKeyMat);
    mesh.position.set(x, WHITE_KEY_HEIGHT + 0.004, -0.018);
    mesh.castShadow = true;
    keyboardGroup.add(mesh);
    keyMeshes.set(b.midi, mesh);
  });

  // music desk
  const deskGeo = new THREE.BoxGeometry(1.0, 0.28, 0.02);
  const desk = new THREE.Mesh(deskGeo, lacquer);
  desk.position.set(0.61, 1.02, 0.08);
  desk.rotation.x = THREE.MathUtils.degToRad(-18);
  root.add(desk);

  // pedals, hanging below the keybed's front-center on a simple lyre post
  const lyrePost = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), lacquer);
  lyrePost.position.set(0.77, 0.36, -0.05);
  root.add(lyrePost);
  [0.62, 0.77, 0.92].forEach((x) => {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.1), goldHardware);
    pedal.position.set(x, 0.07, -0.05);
    pedal.rotation.x = THREE.MathUtils.degToRad(-8);
    root.add(pedal);
  });

  // ---- floor: real-time mirror reflection + a shadow-only overlay ----
  // (a plain Reflector can't receive shadows, so a transparent
  // ShadowMaterial plane sits a hair above it to catch the piano's contact
  // shadow without breaking the mirror.)
  let reflector = null;
  let shadowCatcher = null;
  if (floor) {
    // Radius grown to match the much wider default camera framing (see
    // CAMERA_PRESETS) — at the old close-up distance 4.5 filled the frame
    // fine, but the new wide stage shot showed its edge.
    const floorGeo = new THREE.CircleGeometry(11, 64);
    reflector = new Reflector(floorGeo, {
      textureWidth: 768,
      textureHeight: 768,
      color: floorColor,
      clipBias: 0.0008,
      multisample: 2,
    });
    reflector.rotation.x = -Math.PI / 2;
    scene.add(reflector);

    shadowCatcher = new THREE.Mesh(floorGeo, new THREE.ShadowMaterial({ opacity: 0.5 }));
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.002;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);
  }

  // ---- lighting ----
  // Direct lights stay comparatively modest — the custom studio environment
  // (above) supplies the crisp highlight streaks; these mainly carve out
  // shadow/form and make the gold hardware pop.
  const key = new THREE.SpotLight(0xfff2d9, 42, 12, Math.PI / 6, 0.35, 1.3);
  key.position.set(2.4, 3.4, 1.6);
  key.target.position.set(0.7, 0.6, 1.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x9fb6d8, 1.1);
  fill.position.set(-2.5, 1.6, -1.5);
  scene.add(fill);

  const rimLight = new THREE.DirectionalLight(0xffe6bf, 1.6);
  rimLight.position.set(-1.2, 1.8, 3.4);
  scene.add(rimLight);

  const hemi = new THREE.HemisphereLight(0x445066, 0x0a0a0c, 0.4);
  scene.add(hemi);

  // A colored spotlight from directly above, off by default — driven by
  // setMood() below, one color per recital piece (see main.js).
  const moodLight = new THREE.SpotLight(0xb98cff, 0, 15, Math.PI / 5, 0.4, 1.2);
  moodLight.position.set(0.8, 9, 1.4);
  moodLight.target.position.set(0.8, 0.62, 1.4);
  scene.add(moodLight, moodLight.target);

  // ---- resize handling ----
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---- render loop ----
  let running = true;
  function loop() {
    if (!running) return;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // ---- key press animation ----
  function pressKey(midi, { velocity = 0.9, sustain = 1 } = {}) {
    const mesh = keyMeshes.get(Math.round(midi));
    if (!mesh) return;
    const black = mesh.geometry === blackKeyGeo;
    const angle = (black ? 4.2 : 3.2) * clamp(velocity, 0.3, 1);
    // sustain (from the active recital piece's performance profile, see
    // shared/recital.js) stretches how long the key visually stays down —
    // a cheap but effective way for each piece to *feel* different, not
    // just sound different.
    const holdTime = 0.32 * clamp(sustain, 0.6, 2.4);
    gsap.killTweensOf(mesh.rotation);
    gsap.timeline()
      .to(mesh.rotation, { x: THREE.MathUtils.degToRad(angle), duration: 0.05, ease: 'power1.out' })
      .to(mesh.rotation, { x: 0, duration: holdTime, ease: 'power2.out' });
  }

  // Overhead colored spotlight, one hue per recital piece (see main.js) —
  // fades out, swaps color, fades back in, so the change reads as a
  // theater lighting cue rather than a hard color-pop mid-transition.
  function setMood(hexColor, targetIntensity = 34, duration = 1.4) {
    gsap.killTweensOf(moodLight);
    if (hexColor == null) {
      gsap.to(moodLight, { intensity: 0, duration: duration * 0.6, ease: 'power2.in' });
      return;
    }
    gsap
      .timeline()
      .to(moodLight, { intensity: 0, duration: duration * 0.35, ease: 'power2.in' })
      .call(() => moodLight.color.set(hexColor))
      .to(moodLight, { intensity: targetIntensity, duration: duration * 0.65, ease: 'power2.out' });
  }

  function flyTo(presetName, duration = 1.6) {
    const p = CAMERA_PRESETS[presetName];
    if (!p) return;
    gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration, ease: 'power2.inOut' });
    // animate lookAt by tweening a dummy target vector each frame
    const from = { x: preset.look[0], y: preset.look[1], z: preset.look[2] };
    gsap.to(from, {
      x: p.look[0],
      y: p.look[1],
      z: p.look[2],
      duration,
      ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(from.x, from.y, from.z),
    });
  }

  function dispose() {
    running = false;
    ro.disconnect();
    reflector?.dispose();
    renderer.dispose();
    envMap.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  }

  return { pressKey, flyTo, setMood, resize, dispose, scene, camera, renderer, root };
}
