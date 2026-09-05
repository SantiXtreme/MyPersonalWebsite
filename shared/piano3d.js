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
// reproduced here (bench included, see below). A second pass went further
// into interior mechanical detail using Steinway-Sons-Grand-Piano-Hamburg-
// scaled.jpg (a real interior photo, referenced for material/lighting/
// geometry only — its wordmark stamp is the one detail deliberately never
// reproduced): strings now bend over an actual bridge rail instead of
// running as one straight cylinder, with distinct tuning pins at the
// wrestplank end, hitch pins at the tail, and a duplex/capo bar tracing
// the tuning-pin row. Legs and the pedal lyre post use a turned-baluster
// lathe profile instead of a linear taper, and each pedal has a visible
// rod running up to the keybed instead of hanging unattached.
//
// Usage:
//   import { createGrandPiano3D, CAMERA_PRESETS } from './shared/piano3d.js';
//   const piano = createGrandPiano3D(containerEl, { cameraPreset: 'hero' });
//   piano.pressKey(60, { velocity: 0.9, sustain: 1.4 });   // middle C, by MIDI number
//   piano.dispose();                                        // on section teardown

import * as THREE from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
// A wide "concert hall" framing was tried and rejected (see the removed
// buildBackdrop() note above) — these are back to a medium 3/4 shot that
// shows the whole instrument clearly without the extreme close-up that
// used to expose every geometry seam, or the extreme wide shot that needed
// a backdrop this project doesn't have a good one for yet.
export const CAMERA_PRESETS = {
  hero: { pos: [5.2, 3.4, -1.2], look: [0.78, 0.7, 1.3] },
  keys: { pos: [3.6, 2.3, -1.1], look: [0.78, 0.73, 0.15] },
  stage: { pos: [7.5, 4.5, -2.8], look: [0.78, 0.7, 1.3] },
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

// A literal wood-panel-wall backdrop was tried here (flat emissive planes
// behind/beside the piano for the wide "concert hall" framing) and the
// user's verdict was blunt: they read as "simple color bricks," not walls.
// Removed entirely — the piano now sits against the page's own ambient
// particle field/gradient atmosphere (same as every other section), no
// literal room geometry. If a backdrop is wanted again, it needs an actual
// design pass (real paneling detail, proper lighting reach), not another
// quick flat-plane attempt.

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

  // antialias:false + a lower pixel-ratio cap (was true / 2, uncapped on
  // most 2x-DPI laptops) — measured this scene at ~3x the frame cost of
  // every other section on the page (recital averaged ~670ms/frame vs.
  // ~200-260ms elsewhere in the same sandbox, a real, isolated outlier, not
  // just "software rendering is slow everywhere"). MSAA is a well-known
  // expensive feature on top of an already-heavy PBR+shadow scene; the
  // persistent field's own renderer already made this exact antialias:false
  // + capped-pixel-ratio tradeoff for the same reason (see scene3d.js).
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  // BasicShadowMap (hard-edged, single-sample) instead of PCFShadowMap
  // (multi-tap filtered) — measured PCF costing a real, if modest, slice of
  // this scene's frame time on top of the antialias/pixel-ratio fix above.
  // The shadow here is mostly a soft ambient "grounding" contact shadow
  // under the piano (the Reflector mirror was already removed in an
  // earlier phase for an unrelated software-rendering artifact), not a
  // hero visual detail depending on soft penumbra.
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const envMap = makeEnvironment(renderer);
  scene.environment = envMap;

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
  // Blued-steel tuning/hitch pins — deliberately duller than the strings
  // so a dense row of them doesn't compete with the string highlights.
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x7d7d84,
    metalness: 0.9,
    roughness: 0.32,
    envMapIntensity: 1.1,
  });
  // Duplex/capo bar — the polished strip strings press over just past the
  // tuning pins (a bright, very recognizable line in reference photos).
  const capoBarMat = new THREE.MeshStandardMaterial({
    color: 0xe2e2e6,
    metalness: 0.95,
    roughness: 0.12,
    envMapIntensity: 1.4,
  });
  // The bridge — dark hardwood, distinct from the lighter soundboard it
  // sits on (real bridges are typically a denser, redder-brown wood).
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x4a2413,
    roughness: 0.55,
    envMapIntensity: 0.5,
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

  // Strings anchor at the plate's actual front width (~x:0.3-1.28 — see
  // buildPlateShape's front-edge points) and fan toward its wider tail
  // bulge for the long bass strings, staying nearly straight for the short
  // treble ones — a plain parallel run (the old version) left every string
  // confined to a band narrower than the plate itself, visibly disconnected
  // from the soundboard shape it's supposed to sit on top of.
  //
  // Each string is now two segments meeting at a bridge contact point
  // instead of one straight run. A real string speaks between the tuning
  // pin (front) and the bridge on the soundboard, then continues a short
  // "after length" to the hitch pin near the tail — a single straight
  // cylinder reads as a flat haze from above; the break at the bridge is
  // what makes the strings look like they're resting on something rather
  // than floating in a plane.
  // Strings are entirely static (never individually animated — only the
  // keys are), so all 120 segments are baked into ONE merged geometry/mesh
  // instead of 120 separate THREE.Mesh objects. This sandbox's software
  // renderer is disproportionately sensitive to draw-call count (the same
  // reasoning scene3d.js's floating notes already document) — 120 separate
  // draw calls for strings alone was a real, measured contributor to the
  // recital section running ~3x slower than every other section on the
  // page (671ms/frame vs. ~200-260ms elsewhere, isolated via a live
  // frame-timing comparison before this fix).
  function makeStringGeometry(start, end, radius) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const geo = new THREE.CylinderGeometry(radius, radius, dir.length(), 6);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const pos = start.clone().addScaledVector(dir, 0.5);
    geo.applyMatrix4(new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1)));
    return geo;
  }
  const STRING_COUNT = 60;
  const stringGeos = [];
  const tuningPinPts = [];
  const bridgePts = [];
  const hitchPinPts = [];
  for (let i = 0; i < STRING_COUNT; i++) {
    const t = i / (STRING_COUNT - 1); // 0 = bass (long, thick), 1 = treble (short, thin)
    const xFront = lerp(0.3, 1.28, t);
    const len = lerp(2.05, 0.6, t);
    const fan = lerp(0.5, 0.03, t); // bass strings angle toward the plate's -X tail bulge
    const radius = lerp(0.0028, 0.0012, t); // thickened for legibility at real render distance
    const zStart = 0.64;
    const start = new THREE.Vector3(xFront, 0.768, zStart);
    const end = new THREE.Vector3(xFront - fan, 0.741, zStart + len); // soundboard height at the hitch pin
    // Bridge sits most of the way toward the tail — the long speaking
    // length runs front-to-bridge, with only a short after-length
    // continuing past it to the hitch pin, matching a real grand's layout.
    const bridgeFrac = lerp(0.86, 0.8, t);
    const bridge = start.clone().lerp(end, bridgeFrac);
    bridge.y = 0.752; // proud of the soundboard (0.741), under the plate's underside
    stringGeos.push(makeStringGeometry(start, bridge, radius));
    stringGeos.push(makeStringGeometry(bridge, end, radius));
    tuningPinPts.push(start.clone().add(new THREE.Vector3(0, -0.012, -0.02)));
    bridgePts.push(bridge);
    hitchPinPts.push(end.clone().add(new THREE.Vector3(0, 0.004, 0.012)));
  }
  const stringsMesh = new THREE.Mesh(mergeGeometries(stringGeos), stringMat);
  root.add(stringsMesh);

  // Tuning pins (wrestplank row) + hitch pins (tail rail) — small steel
  // pegs following the same front/tail anchor points the strings use, so
  // they line up exactly instead of being separately guessed. Every
  // string gets a hitch pin; only every other gets a tuning pin (real
  // ones are tightly packed enough that this still reads as a dense row
  // without doubling the pin count for no visible gain at this scale).
  // All static and sharing one material (pinMat) — merged into one mesh
  // for the same draw-call reason as the strings above.
  const tuningPinGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.02, 6);
  const hitchPinGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.012, 6);
  const pinGeos = [];
  const tiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-6), 0, 0));
  tuningPinPts.forEach((p, i) => {
    if (i % 2 === 1) return;
    const geo = tuningPinGeo.clone();
    geo.applyMatrix4(new THREE.Matrix4().compose(p, tiltQuat, new THREE.Vector3(1, 1, 1)));
    pinGeos.push(geo);
  });
  hitchPinPts.forEach((p) => {
    const geo = hitchPinGeo.clone();
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    pinGeos.push(geo);
  });
  const pinsMesh = new THREE.Mesh(mergeGeometries(pinGeos), pinMat);
  root.add(pinsMesh);

  // Duplex/capo bar — traces the same front-edge points the tuning pins
  // use, so it stays glued to the string row exactly rather than being
  // hand-fit to a separate curve.
  const capoCurve = new THREE.CatmullRomCurve3(
    tuningPinPts.map((p) => p.clone().add(new THREE.Vector3(0, 0.006, 0.01))),
    false
  );
  const capoBar = new THREE.Mesh(new THREE.TubeGeometry(capoCurve, 80, 0.004, 8, false), capoBarMat);
  root.add(capoBar);

  // Bridge rail — built from the same bridgePts the strings bend at above,
  // so the raised wood sits exactly under the strings instead of being
  // eyeballed separately.
  const bridgeCurve = new THREE.CatmullRomCurve3(
    bridgePts.map((p) => p.clone().add(new THREE.Vector3(0, -0.003, 0))),
    false
  );
  const bridgeRail = new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 80, 0.009, 8, false), bridgeMat);
  root.add(bridgeRail);

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
  // A turned-baluster profile (subtle bulge in the upper third, waisted
  // middle, slender ankle near the caster) instead of a plain linear
  // taper — reads as a carved furniture leg rather than a traffic cone.
  // Shared by the main legs and the (smaller) bench legs below via the
  // same radiusTop/radiusBottom scale so both stay proportional.
  function legLatheGeometry(radiusTop, radiusBottom, height) {
    const profile = [
      { y: 0.0, r: radiusBottom },
      { y: 0.16, r: radiusBottom * 1.25 },
      { y: 0.32, r: radiusTop * 0.78 },
      { y: 0.46, r: radiusTop * 0.92 },
      { y: 0.58, r: radiusTop * 0.74 },
      { y: 0.74, r: radiusTop * 0.94 },
      { y: 1.0, r: radiusTop },
    ];
    const points = profile.map(({ y, r }) => new THREE.Vector2(Math.max(r, 0.0006), y * height));
    return new THREE.LatheGeometry(points, 16);
  }
  // legRadiusTop/Bottom let the (smaller, lighter) bench legs below reuse
  // this same builder instead of a second hand-tuned copy.
  function makeLeg(x, z, legRadiusTop = 0.05, legRadiusBottom = 0.035, legHeight = 0.72) {
    const g = new THREE.Group();
    const leg = new THREE.Mesh(legLatheGeometry(legRadiusTop, legRadiusBottom, legHeight), lacquer);
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

  // pedals, hanging below the keybed's front-center on a turned lyre post
  // (legLatheGeometry, same turned-baluster profile as the main legs —
  // was a bare cylinder before, part of the "pedals are just bricks"
  // complaint even though the pedals themselves weren't the only culprit).
  const lyrePost = new THREE.Mesh(legLatheGeometry(0.024, 0.015, 0.62), lacquer);
  lyrePost.position.set(0.77, 0.05, -0.05);
  lyrePost.castShadow = true;
  root.add(lyrePost);
  // A rounded-tip paddle (a flat pad + a half-cylinder cap at the toe end)
  // instead of a bare box — reads as an actual pedal lever, not a brick.
  function makePedal(x) {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.01, 0.085), goldHardware);
    pad.position.set(0, 0, -0.02);
    g.add(pad);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.01, 16, 1, false, 0, Math.PI), goldHardware);
    cap.rotation.set(0, 0, Math.PI / 2);
    cap.rotation.y = Math.PI / 2;
    cap.position.set(0, 0, 0.0625);
    g.add(cap);
    g.position.set(x, 0.07, -0.05);
    g.rotation.x = THREE.MathUtils.degToRad(-8);
    return g;
  }
  [0.62, 0.77, 0.92].forEach((x) => root.add(makePedal(x)));

  // Thin trapwork rods connecting each pedal up to the keybed — without
  // these the pedals read as unattached floating shapes rather than part
  // of a mechanism, a specific complaint from the previous pass.
  function makePedalRod(x) {
    const from = new THREE.Vector3(x, 0.1, -0.045);
    const to = new THREE.Vector3(0.77, 0.685, -0.05);
    const dir = new THREE.Vector3().subVectors(to, from);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, dir.length(), 6), pinMat);
    rod.position.copy(from).addScaledVector(dir, 0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return rod;
  }
  [0.62, 0.77, 0.92].forEach((x) => root.add(makePedalRod(x)));

  // ---- floor: shadow-catcher only ----
  // Used to be a real-time mirror (Reflector) + a transparent ShadowMaterial
  // plane sitting a hair above it to catch the contact shadow without
  // breaking the mirror. A now-abandoned wide "concert hall" camera
  // experiment needed a bigger floor radius, and enlarging the Reflector
  // specifically produced a persistent stray red-triangle smear in the
  // mirrored image — tried a larger clipBias, a more moderate radius, and
  // moving nearby geometry clear of the y=0 clip plane; none of it fixed
  // it. Isolated it conclusively by hiding the Reflector and the
  // shadow-catcher independently — only hiding the Reflector made the
  // artifact disappear, and the resulting shot (just the shadow catcher
  // over the page's own starfield field showing through the transparent
  // canvas) already looked good on its own, so the mirror was dropped
  // rather than keep chasing what's most likely a software-rendering
  // (SwiftShader) artifact in this sandbox's render-to-texture pass. If
  // revisiting: the shadow-catcher-only look is fine, don't reintroduce a
  // Reflector without re-testing in a real GPU browser first.
  let shadowCatcher = null;
  if (floor) {
    const floorGeo = new THREE.CircleGeometry(5, 64);
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
  key.shadow.mapSize.set(768, 768);
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

  // A per-song overhead colored SpotLight + a visible additive-blended
  // cone beam used to live here (setMood(), driven by main.js's
  // MOOD_COLORS) — the user's verdict on the cone specifically: "the piano
  // view closes up, which honestly looks great but the light does not."
  // Removed entirely rather than kept as an unused hook. Per-song color
  // reaction now lives outside the piano scene instead: the ambient
  // particle field tints (scene3d.js's setTint) and a flowing-notes DOM
  // layer recolors (sections/notesFlow.js) — see main.js's recital
  // onStateChange handler.

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
  // `running` also doubles as a visibility gate — the piano stage is fixed
  // and only actually shown near the recital section, but nothing was ever
  // pausing this loop while scrolled away, so it kept rendering a full PBR
  // scene (shadows, PMREM env, backdrop) every frame for the entire page
  // lifetime. See pause()/resume() below — main.js wires these to the same
  // ScrollTrigger boundary that already fades #piano-stage's opacity.
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

  function pause() {
    running = false;
  }
  function resume() {
    if (running) return;
    running = true;
    loop();
  }

  function dispose() {
    running = false;
    ro.disconnect();
    renderer.dispose();
    envMap.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  }

  return { pressKey, flyTo, pause, resume, resize, dispose, scene, camera, renderer, root };
}
