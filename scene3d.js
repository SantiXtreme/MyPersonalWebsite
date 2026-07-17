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

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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

  // ---- scene / palette state ----
  let target = SCENES.hero;
  const live = { a: [...target.a], b: [...target.b], drift: [...target.drift], turbulence: target.turbulence };
  let liveDensity = 1;
  let tint = null; // { color: THREE.Color, until: timestamp } — temporary per-song retint
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
      } else if (tint) {
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
      composer.dispose();
      renderer.dispose();
    },
  };
}
