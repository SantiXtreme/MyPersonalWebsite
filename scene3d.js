// Motion's persistent atmospheric field — a single Three.js particle system
// (embers/ash/dust/leaves, depending on the active "scene") plus a bloom
// pass, replacing the old 2D canvas flow-field. Self-contained and
// self-driving (own requestAnimationFrame loop), matching the pattern
// already established by shared/piano3d.js.
//
// Deliberately ONE system rather than five bolted-on gimmicks: every
// section reuses the same particle pool and the same cursor-force
// mechanism, just with a different palette/behavior profile per scene
// (see SCENES below) — cohesive, not a pile of unrelated effects.
//
// Usage:
//   const field = createMotionField(canvasEl);
//   field.setScene('hero');
//   field.setPointer(x, y, true);
//   field.burst(x, y, { color: 0xe7b878, count: 14 });
//   field.setTint(0xdd93ab, 1400); // e.g. the active recital piece's color
//   field.setTint(null); // clear immediately (e.g. on song pause/stop)
//   field.dispose();
//
// setTint() drives more than particle color: it's the whole per-song
// recital background reaction. The renderer's clear color washes toward
// the tint (the main, deliberately-strong effect — "the background
// should literally change color"), and a handful of small floating 3D
// note meshes fade in as a secondary accent, both easing in/out together.
// See the "floating 3D notes" block below for why these are real Object3D
// meshes and not DOM elements.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Per-scene atmosphere: base drift (dx,dy px/s), turbulence strength, palette
// (two colors particles blend between), particle "mode" (ember|ash|dust|leaf),
// how the cursor perturbs the field, and density relative to the base count.
const SCENES = {
  // Darker blues, deliberately distinct from the gold/ember mood elsewhere —
  // the reactive letter-cloud (sections/reactiveLetters.js) is the main
  // cursor interaction here now; this ambient trail is a secondary layer.
  hero: {
    mode: 'ember',
    a: [68, 102, 178],
    b: [150, 190, 255],
    drift: [0, -22],
    turbulence: 0.8,
    cursorForce: 'trail',
    density: 1,
  },
  // Warm violet/rose — deliberately distinct from the hero's cool blues
  // right above it, and from the gold that dominates later sections.
  about: {
    mode: 'ash',
    a: [190, 140, 210],
    b: [255, 190, 190],
    drift: [4, 6],
    turbulence: 0.5,
    // Cursor reactivity is intentionally hero/contact-only — see the note
    // on the 'contact' entry below.
    cursorForce: 'none',
    density: 0.6,
  },
  ml: {
    mode: 'ash',
    a: [130, 150, 180],
    b: [122, 178, 255],
    drift: [6, 8],
    turbulence: 0.5,
    cursorForce: 'none', // the torchlight reveal covers cursor reactivity here
    density: 0.55,
  },
  mathphysics: {
    mode: 'dust',
    a: [90, 130, 200],
    b: [180, 200, 255],
    drift: [0, -4],
    turbulence: 0.4,
    cursorForce: 'none',
    density: 0.45,
  },
  volleyball: {
    mode: 'ember',
    a: [255, 200, 140],
    b: [160, 200, 255],
    drift: [10, 14],
    turbulence: 0.6,
    cursorForce: 'none',
    density: 0.35, // kept sparse — the clip background is the main visual
  },
  recital: {
    mode: 'dust',
    a: [231, 184, 120],
    b: [255, 232, 196],
    drift: [0, -6],
    turbulence: 0.35,
    cursorForce: 'none',
    density: 0.6,
  },
  reading: {
    mode: 'dust',
    a: [214, 170, 110],
    b: [180, 130, 80],
    drift: [6, 14],
    turbulence: 0.5,
    cursorForce: 'none',
    density: 0.55,
  },
  hobbies: {
    mode: 'leaf',
    a: [214, 156, 96],
    b: [180, 120, 74],
    drift: [14, 26],
    turbulence: 0.9,
    // Cursor reactivity is hero/contact-only now — it was interrupting the
    // Elden Ring video background here.
    cursorForce: 'none',
    density: 0.5, // kept lower — the Elden Ring video is the main visual
  },
  // Same colors as before, per the user's request to keep the ending
  // pixel-identical — only its cursor reactivity changed (from a
  // sigil-gather effect to the same reactive letter-cloud the hero uses),
  // so this ambient ember field also moves from 'gather' (which targeted
  // the now-removed grace-sigil) to 'trail', matching the hero it bookends.
  contact: {
    mode: 'ember',
    a: [231, 184, 120],
    b: [200, 170, 255],
    drift: [0, -14],
    turbulence: 0.5,
    cursorForce: 'trail',
    density: 0.55,
  },
};

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aRot;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vRot = aRot;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRot);
    float s = sin(vRot);
    vec2 ruv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    // a soft, slightly elongated glow — reads as ember/leaf/dust depending
    // on aspect + color, without needing a separate texture per mode
    float d = length(ruv * vec2(1.0, 1.55));
    float glow = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.1);
    float a = glow * vAlpha;
    if (a < 0.012) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export function createMotionField(canvas, options = {}) {
  const { graceSigil = true } = options;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
  camera.position.z = 5;

  // Opaque (not alpha:true) on purpose — mixing a transparent canvas with
  // UnrealBloomPass's additive composite is a known rough edge in three.js
  // (bloom's internal passes don't reliably carry an alpha channel through),
  // so this canvas paints its own solid dusk base like the old 2D
  // flow-field did; per-section mood layers are separate DOM gradients
  // stacked above it (see style.css), same overall layering as before.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0b0910, 1);
  // ACES roll-off, not the default NoToneMapping — without it, the bright
  // additive particle cores clip straight to flat white instead of reading
  // as warm gold (the same fix piano3d.js needed for its lacquer material).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.32, 0.4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- particle pool ----
  let W = 0;
  let H = 0;
  let count = 0;
  let particles = [];
  let geometry, points, positions, sizes, colors, alphas, rots;

  function baseCountFor(w, h) {
    return clamp(Math.round((w * h) / 3400), 140, REDUCED ? 90 : 760);
  }

  function makeParticle(scn, spawnAnywhere) {
    const isLeaf = scn.mode === 'leaf';
    const p = {
      x: Math.random() * W,
      y: spawnAnywhere ? Math.random() * H : H + Math.random() * 40,
      vx: (Math.random() - 0.5) * 8,
      vy: 0,
      seed: Math.random() * 1000,
      paletteMix: Math.random(),
      overrideColor: null,
      size: isLeaf ? 6 + Math.random() * 7 : 2 + Math.random() * 3.4,
      life: 0,
      maxLife: 0, // 0 = ambient/infinite (respawns on wrap instead of dying)
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * (isLeaf ? 2.4 : 0.4),
      burst: false,
    };
    return p;
  }

  function buildPool(newCount) {
    count = newCount;
    particles = new Array(count).fill(0).map(() => makeParticle(target, true));
    positions = new Float32Array(count * 3);
    sizes = new Float32Array(count);
    colors = new Float32Array(count * 3);
    alphas = new Float32Array(count);
    rots = new Float32Array(count);

    geometry?.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aRot', new THREE.BufferAttribute(rots, 1));

    if (!points) {
      const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      points = new THREE.Points(geometry, material);
      scene.add(points);
    } else {
      points.geometry = geometry;
    }
  }

  // ---- hero backdrop sigil (ring + cross, subtle rotating) ----
  // Recolored to the hero's blue accent (was gold) — the shape is an
  // abstract rune circle, not a reproduction of any game's icon, so it
  // carries over fine into the "darker blues" hero mood.
  let sigil = null;
  if (graceSigil) {
    sigil = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x6fa3ff, transparent: true, opacity: 0, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), ringMat);
    sigil.add(ring);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x6fa3ff, transparent: true, opacity: 0, toneMapped: false });
    const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 2.5), barMat);
    sigil.add(vBar);
    const hBar = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), barMat.clone());
    hBar.position.y = 0.62;
    sigil.add(hBar);
    sigil.userData.mats = [ringMat, barMat, hBar.material];
    sigil.visible = false;
    scene.add(sigil);
  }

  // ---- quasar (About section centerpiece) ----
  // Rebuilt to match a real reference image the user supplied (quasar.jpeg,
  // repo root) — a dusty edge-on torus with warm glow bleeding through its
  // clumpy gaps, two wide flared blue-white jets, set against a dense
  // starfield + diffuse plasma clouds. A real astronomical-illustration
  // look, not the EHT/black-hole-photo look this replaced (dark shadow +
  // thin photon ring) — a deliberate pivot once given a concrete reference,
  // not a refinement of the old approach. Still lives in this same scene/
  // composer (one WebGL context, one bloom pass — see file header) rather
  // than a new canvas, fading in/out by sceneName exactly like the hero
  // sigil above.
  //
  // Deliberately pushed toward MORE visual complexity per explicit
  // instruction ("don't hesitate making it complex... if it's simple it's
  // useless") while keeping the same cost discipline as before: animation
  // lives in shader uniforms/vertex-color gradients wherever possible, not
  // per-frame CPU buffer rewrites — confirmed by measurement afterward that
  // none of this added measurable frame cost (see the lag-review notes).
  const quasarGroup = new THREE.Group();
  quasarGroup.visible = false;
  scene.add(quasarGroup);

  const Q_CORE_R = 0.1; // warm glow, visible through gaps in the dust torus
  const Q_TORUS_INNER = 0.045;
  const Q_TORUS_OUTER = 0.78; // the dominant central mass — bigger than a first pass had it,
  // which read as too small next to the jets and nearly invisible against the dark backdrop
  const Q_OUTER_R = 1.0; // overall reach — hot-spot orbit range, jet length reference
  const Q_SQUASH = 0.42; // flattens the torus into an ellipse — a fixed
  // "viewed from above" tilt, since this whole field is seen through a
  // static orthographic camera with no true 3D perspective to fake it with.

  // Radial center-bright-to-edge-black falloff baked into vertex colors —
  // a vertex colored pure black contributes nothing under ADDITIVE
  // blending, so this reads as a soft glow falloff with zero shader cost.
  function radialFalloffColors(posAttr, maxR, color, power) {
    const colors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const d = Math.sqrt(posAttr.getX(i) ** 2 + posAttr.getY(i) ** 2) / maxR;
      const f = Math.pow(Math.max(0, 1 - d), power);
      colors[i * 3] = color.r * f;
      colors[i * 3 + 1] = color.g * f;
      colors[i * 3 + 2] = color.b * f;
    }
    return new THREE.BufferAttribute(colors, 3);
  }

  // Central glow — layered warm white->gold->orange->red, additive, the
  // light the dust torus (drawn on top, below) partially obscures.
  function buildGlowGeometry() {
    const layers = [
      { r: 0.032, color: new THREE.Color(0xfffaf0), power: 1.3 },
      { r: 0.06, color: new THREE.Color(0xffd9a0), power: 1.5 },
      { r: 0.09, color: new THREE.Color(0xff9a4d), power: 1.8 },
      { r: 0.13, color: new THREE.Color(0xd4502e), power: 2.1 },
    ];
    const geos = layers.map(({ r, color, power }) => {
      const g = new THREE.CircleGeometry(r, 28);
      g.setAttribute('color', radialFalloffColors(g.attributes.position, r, color, power));
      return g;
    });
    return mergeGeometries(geos);
  }
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(buildGlowGeometry(), glowMat);
  quasarGroup.add(glow);

  // Dust torus — a REAL 3D volume (THREE.TorusGeometry, a genuine tube
  // swept around a ring), not a flat painted disc. A first pass used a flat
  // RingGeometry with a 2D noise texture, which — however clumpy the alpha
  // pattern — could never actually read as volumetric; a flat shape lit
  // uniformly has no roundness cue regardless of texture detail. This
  // version shades each fragment against its own real surface normal (a
  // fixed light direction, no scene THREE.Light needed — just a dot
  // product in the fragment shader) so the tube visibly curves away into
  // shadow on one side and catches light on the other, on top of the same
  // clumpy FBM-noise dust texture as before. NORMAL blending (not additive)
  // — real dust blocks light rather than adding to it.
  const Q_TUBE_R = 0.36; // thick relative to the ring radius — a fat,
  // puffy donut with a small hole, matching the reference's dense mass
  // rather than a thin ring.
  const torusFrag = /* glsl */ `
    varying vec3 vPos3;
    varying vec3 vNormal;
    uniform float uTime, uOpacity, uDensity;
    uniform vec3 uDust, uDustLit;
    // A first pass used a plain sum of sines for the clump mask — cheap,
    // but sine sums are inherently periodic and produced a visible
    // repeating checkerboard/argyle grid instead of organic cloud texture
    // (confirmed by screenshot). Replaced with a real value-noise FBM: a
    // smoothed hash grid, fractal-summed across a few octaves with a
    // rotation applied between each one specifically to break up any
    // axis-aligned repetition — the standard fix for this exact artifact.
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.55;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 4; i++) {
        v += amp * valueNoise(p);
        p = rot * p * 2.03 + vec2(11.3, 5.7);
        amp *= 0.52;
      }
      return v;
    }
    void main() {
      vec2 p1 = vPos3.xy * 3.2 + vec2(uTime * 0.045, -uTime * 0.03);
      float clumpRaw = fbm(p1); // roughly 0..1.1
      float clump = smoothstep(0.24, 0.7, clumpRaw); // 0..1, contrast-boosted
      // Fixed-direction fake lighting — a real vertex normal (from the
      // actual 3D tube geometry) dotted against a constant light vector,
      // no THREE.Light needed. This is what actually reads as "3D" (a
      // curved surface rolling from lit to shadowed), not the texture.
      vec3 lightDir = normalize(vec3(0.4, 0.6, 0.75));
      float ndl = dot(normalize(vNormal), lightDir) * 0.5 + 0.5;
      float shade = mix(0.4, 1.25, ndl); // ambient floor + a real highlight, not flat-lit
      // Density: a high, user-requested floor (was a much wider 0.12-0.95
      // range that read as thin/wispy) — this is meant to be a dense,
      // substantial cloud mass with occasional bright gaps, not mostly gap.
      float alpha = mix(uDensity, 0.98, clump) * uOpacity;
      vec3 radialTint = mix(uDustLit, uDust, smoothstep(0.0, 0.5, length(vPos3.xy)));
      vec3 col = mix(mix(uDustLit, radialTint, 0.4), radialTint, clump) * shade;
      if (alpha < 0.02) discard;
      gl_FragColor = vec4(col, alpha);
    }
  `;
  const torusVert = /* glsl */ `
    varying vec3 vPos3;
    varying vec3 vNormal;
    void main() {
      vPos3 = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const torusMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDensity: { value: 0.55 },
      uDust: { value: new THREE.Color(0x5c5468) }, // brightened + cooled from a near-black brown —
      // dark-over-dark under NormalBlending against this canvas's own near-black backdrop was
      // reading as almost invisible; needs its own visible luminance to read as a silhouette at all
      uDustLit: { value: new THREE.Color(0xb87a4a) }, // warm rim where dust catches the glow's light
    },
    vertexShader: torusVert,
    fragmentShader: torusFrag,
    transparent: true,
    // Unlike every flat shape elsewhere in this file (rings/circles/cones,
    // which have no self-overlap issue viewed from a fixed angle), a REAL
    // tube has a front-facing and a back-facing surface that both project
    // into roughly the same screen area from a near-symmetric view. With
    // depthTest off (this file's usual pattern), both surfaces draw with no
    // occlusion between them and interleave in arbitrary triangle order —
    // confirmed by screenshot: the torus rendered as sparse, thin outline
    // traces instead of a filled volume. Depth test/write turned back on
    // JUST for this mesh (a per-material setting, doesn't affect anything
    // else sharing this canvas) so the near surface correctly occludes the
    // far one, like any normal opaque-ish 3D object would.
    depthWrite: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(Q_TORUS_OUTER - Q_TUBE_R, Q_TUBE_R, 20, 128), torusMat);
  // Z is squashed FAR more aggressively than Y — quasarGroup's own uniform
  // scale (~360x, set in resize()) would otherwise blow the tube's real Z
  // depth (±0.36 locally) out to roughly ±130 world units, well outside
  // this canvas's orthographic camera near/far range (camera.position.z=5,
  // near=-10/far=10 → a visible world-Z window of about [-5, 15]) — most of
  // the tube was simply being clipped, the other real contributor to the
  // "thin outline" bug alongside the missing depth test above.
  torus.scale.set(1, Q_SQUASH, 0.03);
  quasarGroup.add(torus);

  // A second, larger, softer "outer haze" layer — a bigger, thinner,
  // fainter torus surrounding the dense one, for the diffuse edge the
  // reference image shows (the dust mass doesn't end with a hard
  // silhouette, it trails off into wispy haze). Same shader, different
  // uniforms/scale — one extra draw call for real added depth.
  const torusHazeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDensity: { value: 0.12 },
      uDust: { value: new THREE.Color(0x584f68) },
      uDustLit: { value: new THREE.Color(0x8a5a6a) },
    },
    vertexShader: torusVert,
    fragmentShader: torusFrag,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
  const torusHaze = new THREE.Mesh(
    new THREE.TorusGeometry(Q_TORUS_OUTER - Q_TUBE_R * 0.6, Q_TUBE_R * 1.35, 14, 96),
    torusHazeMat
  );
  torusHaze.scale.set(1, Q_SQUASH, 0.03);
  quasarGroup.add(torusHaze);

  // Relativistic jets — wide, flared, wispy blue-white cones (narrow at the
  // core, flaring outward toward the tip, matching the reference image's
  // "trumpet" shape — the opposite taper from a collimated beam). Two
  // layers per direction: a narrow bright inner flare + a wider, softer
  // outer haze, each pair merged into one mesh (2 draw calls total for
  // all 4 cones). translate+mirror gets the apex (radius 0) touching the
  // core and the wide base flaring away, since ConeGeometry's default
  // apex/base order is the other way around.
  function buildJetGeometry(height, tipRadius, color, power) {
    const g = new THREE.ConeGeometry(tipRadius, height, 16, 1, true);
    g.scale(1, -1, 1); // mirror: apex/base swap sides
    g.translate(0, height / 2, 0); // apex -> 0 (at the core), base -> height (far, wide)
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const yFrac = clamp(pos.getY(i) / height, 0, 1); // 0 at core, 1 at tip
      const f = Math.pow(1 - yFrac, power);
      colors[i * 3] = color.r * f;
      colors[i * 3 + 1] = color.g * f;
      colors[i * 3 + 2] = color.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }
  const jetInnerColor = new THREE.Color(0xd8ecff); // near-white, faint blue
  const jetOuterColor = new THREE.Color(0x2f6fd6); // deep blue haze
  const jetInnerUp = buildJetGeometry(1.5, 0.16, jetInnerColor, 1.6);
  const jetInnerDown = buildJetGeometry(1.5, 0.16, jetInnerColor, 1.6);
  jetInnerDown.rotateX(Math.PI);
  const jetInnerMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const jetsInner = new THREE.Mesh(mergeGeometries([jetInnerUp, jetInnerDown]), jetInnerMat);
  quasarGroup.add(jetsInner);

  const jetOuterUp = buildJetGeometry(1.85, 0.34, jetOuterColor, 1.1);
  const jetOuterDown = buildJetGeometry(1.85, 0.34, jetOuterColor, 1.1);
  jetOuterDown.rotateX(Math.PI);
  const jetOuterMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const jetsOuter = new THREE.Mesh(mergeGeometries([jetOuterUp, jetOuterDown]), jetOuterMat);
  quasarGroup.add(jetsOuter);

  // Small bright "knots" along each jet — the shocked-plasma clumps
  // visible in real jet imagery (e.g. M87's jet), not a smooth gradient
  // the whole way. Static, merged into one draw call.
  function buildKnotsGeometry() {
    // Deliberately small + soft (a first pass at 0.05 radius bloomed into
    // oversized floating orbs rather than reading as subtle jet texture —
    // this canvas's UnrealBloomPass amplifies small bright additive points
    // a lot, the same lesson learned earlier with the notes/clear-color
    // tint work) — these should read as texture, not as their own objects.
    const geos = [];
    const knotColor = new THREE.Color(0xdcecff);
    [1, -1].forEach((dir) => {
      [0.3, 0.65, 1.05, 1.5].forEach((yDist, i) => {
        const r = 0.02 - i * 0.003;
        const g = new THREE.CircleGeometry(r, 10);
        g.setAttribute('color', radialFalloffColors(g.attributes.position, r, knotColor, 2.2));
        g.translate((Math.random() - 0.5) * 0.04, dir * yDist, 0.001);
        geos.push(g);
      });
    });
    return mergeGeometries(geos);
  }
  const knotsMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const knots = new THREE.Mesh(buildKnotsGeometry(), knotsMat);
  quasarGroup.add(knots);

  // Hot-spot embers orbiting within the torus band — one InstancedMesh
  // (one draw call, GPU-instanced), Keplerian-ish angular speed (∝
  // 1/sqrt(radius), so inner embers visibly lap outer ones) — the same
  // "real physics over scripted motion" preference already established by
  // sections/orbits.js's N-body sim. Recolored warm ember-orange (was
  // gold-white) to match the dusty-torus aesthetic instead of a bright
  // accretion disk.
  const Q_HOTSPOT_COUNT = 16;
  const hotspotGeo = new THREE.CircleGeometry(0.02, 10);
  hotspotGeo.setAttribute(
    'color',
    radialFalloffColors(hotspotGeo.attributes.position, 0.02, new THREE.Color(0xffb266), 1.2)
  );
  const hotspotMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const hotspots = new THREE.InstancedMesh(hotspotGeo, hotspotMat, Q_HOTSPOT_COUNT);
  quasarGroup.add(hotspots);
  const hotspotState = Array.from({ length: Q_HOTSPOT_COUNT }, () => ({
    radius: lerp(Q_TORUS_INNER * 1.3, Q_TORUS_OUTER * 0.95, Math.random()),
    angle: Math.random() * Math.PI * 2,
  }));
  const hsDummy = new THREE.Object3D();
  const hsColor = new THREE.Color();

  let quasarOpacity = 0;

  // ---- literal space backdrop for About (stars + plasma clouds) ----
  // The user's explicit ask: the background itself has to read as space —
  // "the distant stars, plasma clouds etc." — not just the quasar object
  // floating on a plain gradient. Positioned in full canvas pixel space
  // (like the main ambient particle system) rather than the quasar's own
  // unit-radius local space, so it spans the whole viewport, not just the
  // area right around the quasar. Fades in/out with the same quasarOpacity
  // as everything else above.
  const aboutSpaceGroup = new THREE.Group();
  aboutSpaceGroup.visible = false;
  scene.add(aboutSpaceGroup);

  // Dense starfield — reuses this file's own particle shader (VERT/FRAG,
  // defined above for the main ambient field) rather than a new one; the
  // aSize/aColor/aAlpha/aRot interface is generic, not tied to the ambient
  // simulation's own logic, so a second, much simpler THREE.Points sharing
  // it costs nothing extra to build.
  const STAR_COUNT = 320;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starSizes = new Float32Array(STAR_COUNT);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const starAlphas = new Float32Array(STAR_COUNT);
  const starRots = new Float32Array(STAR_COUNT);
  const starState = Array.from({ length: STAR_COUNT }, () => ({
    xf: Math.random(),
    yf: Math.random(),
    size: 0.9 + Math.random() * 1.8,
    seed: Math.random() * 1000,
    twSpeed: 0.4 + Math.random() * 1.1,
    blue: Math.random() < 0.3, // a minority read cooler-white, most warm-white
  }));
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(starAlphas, 1));
  starGeo.setAttribute('aRot', new THREE.BufferAttribute(starRots, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  aboutSpaceGroup.add(starPoints);

  // Plasma clouds — a handful of large, soft, slowly-drifting additive
  // blobs scattered across the viewport, blue/cyan (deliberately distinct
  // from the quasar's own warm palette, echoing the reference image's cool
  // nebula haze around a warm core). Few enough (6) that separate meshes
  // (not instanced) are the simpler, still-cheap choice.
  const PLASMA_COUNT = 6;
  const plasmaColors = [0x3a6fb8, 0x4a8fc9, 0x2f5a99, 0x5aa0d6, 0x3d7ab0, 0x2a4f8a];
  const plasmaState = Array.from({ length: PLASMA_COUNT }, (_, i) => ({
    xf: 0.08 + Math.random() * 0.84,
    yf: 0.08 + Math.random() * 0.84,
    r: 90 + Math.random() * 140,
    seed: Math.random() * 1000,
    driftSpeed: 0.00002 + Math.random() * 0.00003,
    color: plasmaColors[i % plasmaColors.length],
  }));
  const plasmaClouds = plasmaState.map((p) => {
    const g = new THREE.CircleGeometry(1, 24);
    g.setAttribute('color', radialFalloffColors(g.attributes.position, 1, new THREE.Color(p.color), 1.8));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    aboutSpaceGroup.add(mesh);
    return { mesh, mat };
  });

  // ---- floating 3D notes (recital mood accent) ----
  // A secondary accent while a song plays — the background clear-color
  // wash below (see BASE_CLEAR/tintBlend) is the main effect; this is
  // deliberately a handful of small, real 3D shapes (not flat DOM text —
  // an earlier flat-glyph version was both the wrong read on "floating 3D"
  // and, worse, a real perf bug: it mutated CSS top/left every frame,
  // which forces a layout+repaint per element per frame instead of just a
  // compositor-thread transform, and was the actual source of reported
  // "insane lag." Real Object3D position updates here have no such cost.
  // One shared material (not one per note) since all notes always share
  // the same color/opacity, driven once per frame below. Each note's
  // head/stem/flag are baked into ONE merged BufferGeometry (mergeGeometries,
  // not a Group of separate meshes) — this sandbox's software renderer is
  // disproportionately sensitive to draw-call count, so one draw call per
  // note instead of two or three is a real, free win regardless of GPU.
  function buildNoteGeometry(withFlag) {
    const head = new THREE.CircleGeometry(1, 20);
    head.rotateZ(-0.35);
    head.scale(1, 0.76, 1);
    const stem = new THREE.BoxGeometry(0.16, 3.2, 0.16);
    stem.translate(0.92, 1.7, 0);
    const parts = [head, stem];
    // every other note gets a small angled "flag" — reads as an eighth
    // note (♪) instead of a plain quarter note (♩), for a little variety.
    if (withFlag) {
      const flag = new THREE.BoxGeometry(0.9, 0.16, 0.16);
      flag.rotateZ(-0.7);
      flag.translate(1.25, 2.9, 0);
      parts.push(flag);
    }
    return mergeGeometries(parts);
  }
  // Additive blending + depthWrite:false, matching the particle material
  // above — a normal-blended translucent shape at ~0.5 opacity all but
  // disappears once the background itself is a similar hue (which it now
  // is, once the wash landed), same as the particles would without this.
  const notesMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const NOTE_COUNT_3D = 6;
  const notesGroup = new THREE.Group();
  notesGroup.visible = false;
  const notes3d = Array.from({ length: NOTE_COUNT_3D }, (_, i) => {
    const mesh = new THREE.Mesh(buildNoteGeometry(i % 2 === 0), notesMat);
    const scale = 9 + Math.random() * 9;
    mesh.scale.setScalar(scale);
    notesGroup.add(mesh);
    return {
      mesh,
      xFrac: Math.random(),
      // Initial seed spans the full drift range (0 to ~1.5), not just the
      // below-the-fold spawn band — without this every note starts off-
      // screen and a user who plays a song sees nothing for the first
      // several seconds until the first ones drift up into view. Respawn
      // (in the drift loop below) keeps using the below-the-fold band,
      // that part is correct — only the *first* placement needed spreading.
      yFrac: Math.random() * 1.5,
      speed: 0.00006 + Math.random() * 0.00007, // frac of viewport height per ms
      sway: 12 + Math.random() * 18,
      seed: Math.random() * 1000,
      rotX: (Math.random() - 0.5) * 0.0016,
      rotY: (Math.random() - 0.5) * 0.0022,
    };
  });
  scene.add(notesGroup);
  let notesOpacity = 0;

  // ---- scene / palette state ----
  let target = SCENES.hero;
  const live = { a: [...target.a], b: [...target.b], drift: [...target.drift], turbulence: target.turbulence };
  let liveDensity = 1;
  let tint = null; // { color: THREE.Color, until: timestamp } — temporary per-song retint
  // The clear-color wash is the *main* per-song background reaction (a
  // literal color shift, not just a few tinted particles) — tintBlend
  // eases toward/away from it so play/pause reads as a fade, not a snap.
  // lastTintColor persists past tint clearing so the fade-out tail still
  // references the right hue while tintBlend eases back to 0.
  //
  // Critical gotcha, found by screenshot after the first version washed
  // the ENTIRE page out to near-white: this canvas runs ACESFilmicToneMapping
  // (deliberately, for the ember/dust particle highlights — see the
  // renderer setup above), and that curve is tuned around a mostly-dark
  // frame with small bright highlights. Filling the *entire* frame with
  // a moderate-brightness clear color (even an ordinary, not-especially-
  // bright hex like 0x664488) reads to ACES as a huge bright area and
  // blows the whole image out toward white. Confirmed by testing a bare
  // static setClearColor() with no other logic involved at all — not a
  // bug in the blend math, a fundamental mismatch between "tonemap a
  // small highlight" and "tonemap the whole background." Fix: the wash
  // targets a darkened copy of the tint color (see darkTintColor below),
  // not the vivid hex used for particles/notes — same hue, low luminance,
  // stays inside the range ACES was tuned for. A plain flat purple at
  // that same low luminance (0x1a1030) was confirmed clean by screenshot.
  const BASE_CLEAR = new THREE.Color(0x0b0910);
  const lastTintColor = new THREE.Color(0x0b0910);
  const darkTintColor = new THREE.Color(0x0b0910);
  const liveClearColor = new THREE.Color(0x0b0910);
  let tintBlend = 0;
  let sceneName = 'hero';

  function field(x, y, t) {
    return (
      (Math.sin(x * 0.0022 + t * 0.16) + Math.cos(y * 0.002 - t * 0.13) + Math.sin((x - y) * 0.0014 + t * 0.11)) *
      Math.PI
    );
  }

  // ---- pointer / cursor state ----
  const pointer = { x: -9999, y: -9999, active: false, px: -9999, py: -9999 };
  let gatherPoint = null; // {x,y} — used by 'gather' cursorForce (contact section)

  function resize() {
    W = canvas.clientWidth || window.innerWidth || 1;
    H = canvas.clientHeight || window.innerHeight || 1;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    camera.left = 0;
    camera.right = W;
    camera.top = 0;
    camera.bottom = H;
    camera.updateProjectionMatrix();
    bloom.setSize(W, H);

    const target2 = baseCountFor(W, H);
    if (Math.abs(target2 - count) > count * 0.25 || !points) buildPool(target2);

    if (sigil) {
      const r = Math.min(W, H) * 0.24;
      sigil.scale.setScalar(r);
      sigil.position.set(W * 0.5, H * 0.4, 0);
    }

    // Upper-right of the About section, clear of the key-area card grid
    // below and the header text's left-aligned column — see the About CSS
    // header note for how this pairs with the section's own background.
    const qr = Math.min(W, H) * 0.4;
    quasarGroup.scale.setScalar(qr);
    quasarGroup.position.set(W * 0.74, H * 0.34, 0);

    // Plasma cloud radii scale with viewport size (like the quasar itself)
    // rather than staying a fixed pixel size regardless of screen.
    const plasmaScale = Math.min(W, H) * 0.9;
    plasmaClouds.forEach(({ mesh }, i) => {
      mesh.scale.setScalar((plasmaState[i].r / 220) * plasmaScale * 0.55);
    });
  }

  let t = 0;
  let last = performance.now();
  const speedFactor = REDUCED ? 0.12 : 1;

  function integrate(dt) {
    t += dt * 0.001;
    const k = 1 - Math.pow(0.0015, dt / 1000);
    for (let i = 0; i < 3; i++) {
      live.a[i] = lerp(live.a[i], target.a[i], k);
      live.b[i] = lerp(live.b[i], target.b[i], k);
    }
    live.drift[0] = lerp(live.drift[0], target.drift[0], k);
    live.drift[1] = lerp(live.drift[1], target.drift[1], k);
    live.turbulence = lerp(live.turbulence, target.turbulence, k);
    liveDensity = lerp(liveDensity, target.density, k);

    if (tint && performance.now() > tint.until) tint = null;
    if (tint) {
      lastTintColor.copy(tint.color);
      darkTintColor.copy(tint.color).multiplyScalar(0.28); // see the gotcha note above
    }

    // About is exempt from the song-mood wash — the user's explicit ask:
    // About's background is space (and now the quasar) "even when playing
    // a song," full stop, unlike every other section where the global wash
    // carrying through is deliberate (confirmed separately, see the
    // recital-mood-active notes elsewhere in this file). Gates the clear-
    // color wash, the floating-notes accent, and the ambient particles'
    // color override below — About keeps its own violet/rose palette and
    // the quasar's own colors regardless of recital playback state.
    const spaceExempt = sceneName === 'about';

    // Background clear-color wash — the main per-song reaction. Eases
    // toward a strong (mostly-replaced, not subtle) mix with the *darkened*
    // mood color while tint is active, and back to the base dusk tone when
    // it clears. Blending toward darkTintColor (not the vivid tint.color
    // used for particles/notes) is what keeps this from blowing out — see
    // the gotcha note above.
    tintBlend = lerp(tintBlend, tint && !spaceExempt ? 0.9 : 0, k);
    liveClearColor.copy(BASE_CLEAR).lerp(darkTintColor, tintBlend);
    renderer.setClearColor(liveClearColor, 1);

    // Floating 3D notes — secondary accent, faded in step with the same
    // tint state (see file header note on why these are real Object3D
    // meshes and not DOM elements).
    const notesTarget = tint && !spaceExempt ? 0.6 : 0;
    notesOpacity = lerp(notesOpacity, notesTarget, k);
    notesMat.opacity = notesOpacity;
    if (notesOpacity > 0.004) {
      notesMat.color.copy(lastTintColor).multiplyScalar(1.8); // boosted for bloom, see composer setup
      notesGroup.visible = true;
      notes3d.forEach((n) => {
        n.yFrac -= n.speed * dt;
        if (n.yFrac < -0.15) {
          n.yFrac = 1.15 + Math.random() * 0.35;
          n.xFrac = Math.random();
        }
        const sway = Math.sin(t * 0.9 + n.seed) * n.sway;
        n.mesh.position.set(n.xFrac * W + sway, n.yFrac * H, 0);
        n.mesh.rotation.x += n.rotX * dt;
        n.mesh.rotation.y += n.rotY * dt;
      });
    } else {
      notesGroup.visible = false;
    }

    const activeCount = Math.max(20, Math.round(count * liveDensity));
    const spd = speedFactor * (0.7 + live.turbulence * 0.6);

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const alive = i < activeCount || p.burst;

      if (p.burst) {
        p.life += dt;
        p.vy += 0.00028 * dt; // gentle gravity on burst sparks
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.rot += p.rotSpeed * dt * 0.01;
        if (p.life > p.maxLife) {
          p.burst = false;
          p.y = H + 20;
          p.x = Math.random() * W;
          p.life = 0;
        }
      } else if (alive) {
        const ang = field(p.x, p.y, t);
        p.x += (Math.cos(ang) * spd * 10 + live.drift[0] * speedFactor * (dt / 1000));
        p.y += (Math.sin(ang) * spd * 10 + live.drift[1] * speedFactor * (dt / 1000));
        p.rot += p.rotSpeed * dt * 0.01 * (target.mode === 'leaf' ? 1 : 0.2);

        // cursor forces — the one place per-section "reactivity" differs,
        // all operating on the same shared particle pool.
        if (!REDUCED && pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          const R2 = 30000;
          if (d2 < R2) {
            const inv = 1 - d2 / R2;
            if (target.cursorForce === 'stir') {
              p.x += -dy * 0.05 * inv;
              p.y += dx * 0.05 * inv;
            } else if (target.cursorForce === 'scatter') {
              const dist = Math.sqrt(d2) || 1;
              p.x += (dx / dist) * inv * 6.5;
              p.y += (dy / dist) * inv * 6.5;
            } else if (target.cursorForce === 'trail') {
              p.x += -dy * 0.03 * inv;
              p.y += dx * 0.03 * inv - inv * 1.4;
            }
          }
        }
        if (target.cursorForce === 'gather' && gatherPoint) {
          const dx = gatherPoint.x - p.x;
          const dy = gatherPoint.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d > 40) {
            p.x += (dx / d) * 0.32;
            p.y += (dy / d) * 0.32;
          }
        }

        if (p.x < -30) p.x = W + 30;
        if (p.x > W + 30) p.x = -30;
        if (p.y < -40) {
          p.y = H + 30;
          p.x = Math.random() * W;
        }
        if (p.y > H + 40) {
          p.y = -30;
          p.x = Math.random() * W;
        }
      }

      const i3 = i * 3;
      positions[i3] = p.x;
      positions[i3 + 1] = H - p.y; // flip so +y-down input maps to on-screen down
      positions[i3 + 2] = 0;

      // color priority: a per-burst override (e.g. a lane-hit or a recital
      // note) > a temporary whole-field tint (the active recital piece's
      // color) > the section's ambient two-color palette blend.
      if (p.burst && p.overrideColor) {
        colors[i3] = p.overrideColor.r;
        colors[i3 + 1] = p.overrideColor.g;
        colors[i3 + 2] = p.overrideColor.b;
      } else if (tint && !spaceExempt) {
        colors[i3] = tint.color.r;
        colors[i3 + 1] = tint.color.g;
        colors[i3 + 2] = tint.color.b;
      } else {
        const col = p.paletteMix < 0.5 ? live.a : live.b;
        colors[i3] = col[0] / 255;
        colors[i3 + 1] = col[1] / 255;
        colors[i3 + 2] = col[2] / 255;
      }
      sizes[i] = p.size * (p.burst ? clamp(1 - p.life / p.maxLife, 0, 1) * 1.6 + 0.3 : 1);
      alphas[i] = alive ? (p.burst ? clamp(1 - p.life / p.maxLife, 0, 1) : 0.35 + p.paletteMix * 0.4) : 0;
      rots[i] = p.rot;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aRot.needsUpdate = true;

    if (sigil) {
      const mats = sigil.userData.mats;
      const wantVisible = sceneName === 'hero';
      sigil.visible = wantVisible || mats[0].opacity > 0.002;
      const targetOp = wantVisible ? 0.55 : 0;
      mats.forEach((m) => (m.opacity = lerp(m.opacity, targetOp, k)));
      if (!REDUCED) sigil.rotation.z += dt * 0.00012;
    }

    // Quasar (About centerpiece) — same fade-by-scene pattern as the sigil.
    const wantQuasar = sceneName === 'about';
    quasarOpacity = lerp(quasarOpacity, wantQuasar ? 1 : 0, k);
    quasarGroup.visible = wantQuasar || quasarOpacity > 0.003;
    aboutSpaceGroup.visible = quasarGroup.visible;
    if (quasarGroup.visible) {
      glowMat.opacity = quasarOpacity;
      torusMat.uniforms.uOpacity.value = quasarOpacity;
      torusHazeMat.uniforms.uOpacity.value = quasarOpacity;
      jetInnerMat.opacity = quasarOpacity * 0.85;
      jetOuterMat.opacity = quasarOpacity * 0.5;
      knotsMat.opacity = quasarOpacity * 0.55;
      hotspotMat.opacity = quasarOpacity;
      if (!REDUCED) {
        torusMat.uniforms.uTime.value = t;
        torusHazeMat.uniforms.uTime.value = t;
        torus.rotation.z += dt * 0.00003;
        torusHaze.rotation.z -= dt * 0.00002; // drifts the opposite way — real depth cue, the outer haze doesn't spin in lockstep with the dense core
        hotspotState.forEach((h, i) => {
          // Keplerian-ish: angular speed falls off with radius (∝ 1/sqrt(r))
          // — inner embers visibly lap outer ones, not a uniform spin.
          h.angle += (0.9 / Math.sqrt(h.radius)) * dt * 0.001;
          hsDummy.position.set(Math.cos(h.angle) * h.radius, Math.sin(h.angle) * h.radius * Q_SQUASH, 0.001);
          hsDummy.updateMatrix();
          hotspots.setMatrixAt(i, hsDummy.matrix);
          // A touch of the same "moving material" beaming idea, toned down
          // and warmed for embers rather than a bright accretion disk: the
          // approaching side reads a little brighter, the receding side a
          // little dimmer.
          const doppler = Math.cos(h.angle);
          const beam = 1 + doppler * 0.35;
          hsColor.setRGB(beam, beam * 0.82, beam * 0.55);
          hotspots.setColorAt(i, hsColor);
        });
        hotspots.instanceMatrix.needsUpdate = true;
        if (hotspots.instanceColor) hotspots.instanceColor.needsUpdate = true;
      }

      // Plasma clouds — slow independent drift + a slow opacity pulse per
      // cloud so the whole backdrop feels alive rather than a static poster.
      plasmaClouds.forEach(({ mesh, mat }, i) => {
        const p = plasmaState[i];
        mat.opacity = quasarOpacity * (0.32 + 0.12 * Math.sin(t * 0.3 + p.seed));
        if (!REDUCED) {
          const dx = Math.sin(t * 0.15 + p.seed) * 40;
          const dy = Math.cos(t * 0.12 + p.seed * 1.3) * 30;
          mesh.position.set(p.xf * W + dx, p.yf * H + dy, 0);
        } else {
          mesh.position.set(p.xf * W, p.yf * H, 0);
        }
      });

      // Starfield twinkle — per-star size/alpha oscillation, cheap at this
      // count (320, well under the ambient field's own 760-particle budget
      // already running every frame regardless).
      for (let i = 0; i < STAR_COUNT; i++) {
        const s = starState[i];
        const i3 = i * 3;
        starPositions[i3] = s.xf * W;
        starPositions[i3 + 1] = s.yf * H;
        starPositions[i3 + 2] = 0;
        const tw = REDUCED ? 1 : 0.55 + 0.45 * Math.sin(t * s.twSpeed + s.seed);
        starSizes[i] = s.size * tw;
        starAlphas[i] = quasarOpacity * (0.4 + 0.6 * tw);
        starColors[i3] = 1;
        starColors[i3 + 1] = s.blue ? 0.94 : 1;
        starColors[i3 + 2] = s.blue ? 1 : 0.92;
        starRots[i] = 0;
      }
      starGeo.attributes.position.needsUpdate = true;
      starGeo.attributes.aSize.needsUpdate = true;
      starGeo.attributes.aAlpha.needsUpdate = true;
      starGeo.attributes.aColor.needsUpdate = true;
    }
  }

  function renderFrame() {
    composer.render();
  }

  let running = true;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(48, now - last);
    last = now;
    if (!document.hidden) {
      integrate(dt);
      renderFrame();
    }
    requestAnimationFrame(loop);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame((n) => {
    last = n;
    loop(n);
  });

  return {
    setScene(name) {
      const next = SCENES[name] || SCENES.hero;
      if (next !== target) {
        const modeChanged = next.mode !== target.mode;
        target = next;
        sceneName = name;
        if (modeChanged) {
          // Re-skin the ambient population in place (size/spin only — never
          // teleport position/velocity) so e.g. "leaf" mode's larger,
          // tumbling particles show up right away instead of waiting for a
          // pool rebuild that a scene switch alone would never trigger.
          const isLeaf = target.mode === 'leaf';
          particles.forEach((p) => {
            if (p.burst) return;
            p.size = isLeaf ? 6 + Math.random() * 7 : 2 + Math.random() * 3.4;
            p.rotSpeed = (Math.random() - 0.5) * (isLeaf ? 2.4 : 0.4);
          });
        }
      } else {
        sceneName = name;
      }
    },
    setPointer(x, y, active) {
      pointer.x = x;
      pointer.y = H - y; // convert CSS (down-positive) to field space
      pointer.active = active;
    },
    setGatherPoint(x, y) {
      gatherPoint = x == null ? null : { x, y: H - y };
    },
    setTint(color, ms = 1500) {
      // null clears immediately — matches the null-to-clear convention used
      // elsewhere (piano.setMood(null), the recital mood-color plumbing).
      // Without this, a long-running tint (e.g. "for as long as a song
      // plays") had no way to be cancelled early on pause/stop short of
      // waiting out its full duration.
      if (color == null) {
        tint = null;
        return;
      }
      tint = { color: new THREE.Color(color), until: performance.now() + ms };
    },
    burst(x, y, opts = {}) {
      const n = REDUCED ? 4 : opts.count ?? 16;
      const col = opts.color !== undefined ? new THREE.Color(opts.color) : null;
      let spawned = 0;
      for (let i = 0; i < particles.length && spawned < n; i++) {
        const p = particles[i];
        if (p.burst) continue;
        const a = Math.random() * Math.PI * 2;
        const sp = (opts.speed ?? 2.6) * (0.4 + Math.random());
        p.burst = true;
        p.life = 0;
        p.maxLife = opts.life ?? 700 + Math.random() * 400;
        p.x = x;
        p.y = H - y;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp - 1.6;
        p.size = (opts.size ?? 3.4) + Math.random() * 2;
        p.overrideColor = col;
        spawned++;
      }
    },
    resize,
    dispose() {
      running = false;
      ro.disconnect();
      geometry?.dispose();
      points?.material.dispose();
      glow.geometry.dispose();
      glowMat.dispose();
      torus.geometry.dispose();
      torusMat.dispose();
      torusHaze.geometry.dispose();
      torusHazeMat.dispose();
      jetsInner.geometry.dispose();
      jetInnerMat.dispose();
      jetsOuter.geometry.dispose();
      jetOuterMat.dispose();
      knots.geometry.dispose();
      knotsMat.dispose();
      hotspotGeo.dispose();
      hotspotMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      plasmaClouds.forEach(({ mesh, mat }) => {
        mesh.geometry.dispose();
        mat.dispose();
      });
      composer.dispose();
      renderer.dispose();
    },
  };
}
