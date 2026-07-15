// =========================================================================
// KINETIC FORGE — concept 03
// Raw-WebGL animated wireframe terrain (CPU-generated line grid, noise
// displaced, re-uploaded each frame), a playable grand piano wired to the
// shared WebAudio engine, magnetic buttons, Lenis smooth scroll + GSAP
// ScrollTrigger reveals. Duotone ink + acid-lime.
// =========================================================================
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { buildKeyboard, createPianoVoice, noteNameToMidi } from '../../shared/pianoEngine.js';
import { scheduleLiebestraum } from '../../shared/liebestraum.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;

// -------------------------------------------------------------------------
// Noise (given utility) + fractal brownian motion
// -------------------------------------------------------------------------
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2D(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += amp * noise2D(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm; // 0..1
}

// -------------------------------------------------------------------------
// tiny column-major mat4 helpers
// -------------------------------------------------------------------------
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function lookAt(eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

// -------------------------------------------------------------------------
// WebGL wireframe terrain
// -------------------------------------------------------------------------
function initTerrain(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) {
    canvas.style.display = 'none';
    return { setActive() {}, resize() {} };
  }

  const VERT = `
    attribute vec3 a_pos;
    uniform mat4 u_mvp;
    uniform float u_depth;
    varying float v_fog;
    varying float v_height;
    void main() {
      v_height = a_pos.y;
      v_fog = clamp((-a_pos.z) / u_depth, 0.0, 1.0);
      gl_Position = u_mvp * vec4(a_pos, 1.0);
    }
  `;
  const FRAG = `
    precision mediump float;
    uniform vec3 u_accent;
    varying float v_fog;
    varying float v_height;
    void main() {
      float ridge = clamp(v_height * 0.4 + 0.42, 0.0, 1.0);
      vec3 col = mix(u_accent * 0.42, u_accent, ridge);
      float fog = smoothstep(0.12, 0.96, v_fog);
      float alpha = (1.0 - fog) * 0.92;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader error', gl.getShaderInfoLog(s));
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const uMvp = gl.getUniformLocation(prog, 'u_mvp');
  const uAccent = gl.getUniformLocation(prog, 'u_accent');
  const uDepthLoc = gl.getUniformLocation(prog, 'u_depth');

  // grid config
  const COLS = IS_MOBILE ? 60 : 96;
  const ROWS = IS_MOBILE ? 48 : 68;
  const SPAN_X = 32;
  const DEPTH = 46;
  const AMP = 2.7;

  const count = COLS * ROWS;
  const positions = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const ampScale = new Float32Array(count);

  for (let r = 0; r < ROWS; r++) {
    const rf = r / (ROWS - 1);
    const z = -rf * DEPTH;
    for (let c = 0; c < COLS; c++) {
      const cf = c / (COLS - 1);
      const x = -SPAN_X / 2 + cf * SPAN_X;
      const i = r * COLS + c;
      baseX[i] = x;
      baseZ[i] = z;
      // taller ridges in the distance, calmer plain up close (keeps type area readable)
      ampScale[i] = 0.32 + 0.95 * rf;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z;
    }
  }

  // line index buffer (built once): horizontal + vertical segments
  const idx = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) idx.push(i, i + 1);
      if (r < ROWS - 1) idx.push(i, i + COLS);
    }
  }
  // vertex count (COLS*ROWS) stays well under 65535, so 16-bit indices are safe
  const indexBuf = gl.createBuffer();
  const indexType = gl.UNSIGNED_SHORT;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const indexCount = idx.length;

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  gl.uniform3f(uAccent, 0.776, 1.0, 0.0);
  gl.uniform1f(uDepthLoc, DEPTH);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.039, 0.039, 0.043, 1.0);
  gl.lineWidth(1);

  let vw = 0, vh = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw(lastT);
  }

  // pointer parallax (lerped)
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!REDUCE) {
    window.addEventListener('pointermove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let lastT = REDUCE ? 8.4 : 0;
  function draw(time) {
    lastT = time;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    const drift = time * 0.16;
    const offX = mouse.x * 2.2;
    for (let i = 0; i < count; i++) {
      const x = baseX[i], z = baseZ[i];
      const n = fbm(x * 0.12 + offX, z * 0.12 - drift);
      positions[i * 3 + 1] = (n - 0.5) * 2 * AMP * ampScale[i] - 1.4;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    const aspect = (canvas.width || 1) / (canvas.height || 1);
    const proj = perspective((52 * Math.PI) / 180, aspect, 0.1, 200);
    const eye = [mouse.x * 2.0, 5.2 + mouse.y * -1.2, 9.5];
    const center = [mouse.x * 2.6, -0.6, -DEPTH * 0.5];
    const view = lookAt(eye, center, [0, 1, 0]);
    const mvp = mul(proj, view);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(uMvp, false, new Float32Array(mvp));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.drawElements(gl.LINES, indexCount, indexType, 0);
  }

  let running = false;
  let active = true;
  function loop(ms) {
    if (!running) return;
    draw(ms / 1000);
    requestAnimationFrame(loop);
  }
  function setActive(on) {
    active = on;
    if (REDUCE) {
      draw(lastT);
      return;
    }
    if (on && !running) {
      running = true;
      requestAnimationFrame(loop);
    } else if (!on) {
      running = false;
    }
  }

  window.addEventListener('resize', resize);
  resize();
  setActive(true);
  return { setActive, resize };
}

// -------------------------------------------------------------------------
// Build DOM from shared content
// -------------------------------------------------------------------------
function renderContent() {
  // projects
  const list = document.getElementById('projects');
  projects.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'project reveal';
    li.innerHTML = `
      <span class="project__num">P/${String(i + 1).padStart(2, '0')}</span>
      <div class="project__body">
        <h3 class="project__title">${p.title}</h3>
        <p class="project__desc">${p.description}</p>
      </div>
      <div class="project__tags">
        ${p.tags.map((t) => `<span class="project__tag">${t}</span>`).join('')}
      </div>`;
    if (p.url && p.url !== '#') li.style.cursor = 'pointer';
    list.appendChild(li);
  });

  // piano intro
  document.getElementById('pianoIntro').textContent = pianoIntro;

  // hobbies
  const hobbyWrap = document.getElementById('hobbies');
  hobbies.forEach((h, i) => {
    const div = document.createElement('div');
    div.className = 'hobby reveal';
    div.innerHTML = `
      <span class="hobby__num">H/${String(i + 1).padStart(2, '0')}</span>
      <div>
        <h3 class="hobby__title">${h.title}</h3>
        <p class="hobby__desc">${h.description}</p>
      </div>`;
    hobbyWrap.appendChild(div);
  });

  // contact
  const contact = document.getElementById('contactLinks');
  const entries = [
    { label: 'GitHub', handle: links.github.handle, href: links.github.url, ext: true },
    { label: 'Instagram', handle: links.instagram.handle, href: links.instagram.url, ext: true },
    { label: 'Email', handle: links.email.address, href: `mailto:${links.email.address}`, ext: false },
  ];
  entries.forEach((e) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'contact__link magnetic';
    a.href = e.href;
    if (e.ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.innerHTML = `<span>${e.label}</span><span class="contact__handle">${e.handle}</span>`;
    li.appendChild(a);
    contact.appendChild(li);
  });

  // ticker (decorative)
  const track = document.getElementById('tickerTrack');
  const bits = [
    'KINETIC FORGE', '0x1F4A', 'WEBGL // GL.LINES', 'NOISE 2D', 'FBM · 3 OCT',
    'ML ENGINEER', 'PIANO ▸ WEBAUDIO', '60FPS', 'SANTIAGO', '01001101 01001100',
    'DISPLACEMENT.Y', 'A4=440HZ',
  ];
  const one = bits.map((b) => `<span>${b}</span>`).join('');
  track.innerHTML = one + one; // duplicate for seamless -50% loop

  document.getElementById('year').textContent = String(new Date().getFullYear());
}

// -------------------------------------------------------------------------
// Piano
// -------------------------------------------------------------------------
function initPiano() {
  const { whites, blacks } = buildKeyboard('C3', 'C6');
  const whiteWrap = document.getElementById('whiteKeys');
  const blackWrap = document.getElementById('blackKeys');
  const nowEl = document.getElementById('pianoNow');
  const N = whites.length;

  document.getElementById('pianoStage')?.style.setProperty('--wkeys', String(N));

  const byMidi = new Map();

  whites.forEach((w) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key key--white';
    b.dataset.midi = String(w.midi);
    b.setAttribute('aria-label', `Piano key ${w.note}`);
    whiteWrap.appendChild(b);
    byMidi.set(w.midi, b);
  });

  blacks.forEach((bk) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key key--black';
    b.dataset.midi = String(bk.midi);
    b.setAttribute('aria-label', `Piano key ${bk.note}`);
    // center between the two flanking white keys
    const centerPct = ((bk.afterWhiteIndex + 1) / N) * 100;
    const widthPct = (1 / N) * 100 * 0.62;
    b.style.left = `${centerPct}%`;
    b.style.width = `${widthPct}%`;
    b.style.transform = 'translateX(-50%)';
    blackWrap.appendChild(b);
    byMidi.set(bk.midi, b);
  });

  // fix black-key transform origin so translateX(-50%) + press-tilt combine
  blackWrap.querySelectorAll('.key--black').forEach((el) => {
    el.style.transformOrigin = 'top center';
  });

  // lazy WebAudio voice (created on first user gesture)
  let voice = null;
  function ensureVoice() {
    if (!voice) voice = createPianoVoice({ outputGain: 0.9 });
    return voice;
  }

  function noteName(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  function press(el) {
    if (!el) return;
    el.classList.add('is-down');
    // black keys keep their translateX; press-tilt applied via class differences
    if (el.classList.contains('key--black')) {
      el.style.transform = 'translateX(-50%) rotateX(7deg)';
    }
  }
  function release(el) {
    if (!el) return;
    el.classList.remove('is-down');
    if (el.classList.contains('key--black')) {
      el.style.transform = 'translateX(-50%)';
    }
  }

  function playMidi(midi, velocity = 1) {
    ensureVoice().play(midi, { isMidi: true, velocity, sustain: 1.8 });
    nowEl.textContent = `▸ ${noteName(midi)}`;
  }

  // pointer interaction (delegated)
  const keybed = document.getElementById('keybed');
  keybed.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    const midi = Number(key.dataset.midi);
    playMidi(midi);
    press(key);
    const up = () => {
      release(key);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  // prevent focus click also firing a second sound; keys are buttons but we
  // handle everything on pointerdown, so suppress default click behaviour.
  keybed.addEventListener('click', (e) => {
    if (e.target.closest('.key')) e.preventDefault();
  });

  // computer keyboard mapping (home-row-ish), starting middle C = C4 (60)
  const keyMap = {
    KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65,
    KeyT: 66, KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71,
    KeyK: 72, KeyO: 73, KeyL: 74, KeyP: 75, Semicolon: 76,
  };
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const midi = keyMap[e.code];
    if (midi === undefined) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (held.has(midi)) return;
    held.add(midi);
    playMidi(midi);
    press(byMidi.get(midi));
  });
  window.addEventListener('keyup', (e) => {
    const midi = keyMap[e.code];
    if (midi === undefined) return;
    held.delete(midi);
    release(byMidi.get(midi));
  });

  // "Hear it played" — Liebestraum excerpt
  const btn = document.getElementById('liebestraumBtn');
  const label = document.getElementById('liebestraumLabel');
  let playing = null;
  function stopPiece() {
    if (playing) {
      playing.stop();
      playing = null;
    }
    btn.classList.remove('is-playing');
    label.textContent = 'Hear it played';
    byMidi.forEach((el) => release(el));
  }
  btn.addEventListener('click', () => {
    if (playing) {
      stopPiece();
      return;
    }
    ensureVoice();
    btn.classList.add('is-playing');
    label.textContent = 'Stop';
    playing = scheduleLiebestraum({
      eighthMs: 210,
      onNote: (name, opts) => {
        const midi = noteNameToMidi(name);
        ensureVoice().play(midi, { isMidi: true, ...opts });
        nowEl.textContent = `▸ ${name}`;
        const el = byMidi.get(midi);
        if (el) {
          press(el);
          setTimeout(() => release(el), 220);
        }
      },
    });
    // auto-reset the button when the piece finishes
    setTimeout(() => {
      if (playing) stopPiece();
    }, playing.totalMs + 300);
  });
}

// -------------------------------------------------------------------------
// Magnetic buttons (GSAP quickTo)
// -------------------------------------------------------------------------
function initMagnetic() {
  if (REDUCE) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const strength = parseFloat(el.dataset.strength) || 0.35;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

// -------------------------------------------------------------------------
// Hero title parallax echo
// -------------------------------------------------------------------------
function initHeroEcho() {
  const echo = document.querySelector('[data-echo]');
  if (!echo || REDUCE) return;
  const xTo = gsap.quickTo(echo, 'x', { duration: 0.8, ease: 'power3.out' });
  const yTo = gsap.quickTo(echo, 'y', { duration: 0.8, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    xTo(10 + nx * 16);
    yTo(10 + ny * 16);
  }, { passive: true });
}

// -------------------------------------------------------------------------
// Scroll: Lenis + ScrollTrigger reveals
// -------------------------------------------------------------------------
function initScroll() {
  let lenis = null;
  if (!REDUCE) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // anchor links -> lenis smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -10 });
      });
    });
  }

  // reveals
  gsap.utils.toArray('.reveal').forEach((el) => {
    if (REDUCE) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.from(el, {
      opacity: 0,
      y: 52,
      duration: 0.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  // scroll progress bar
  const bar = document.getElementById('progressBar');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      bar.style.width = `${(self.progress * 100).toFixed(2)}%`;
    },
  });

  return lenis;
}

// -------------------------------------------------------------------------
// Boot
// -------------------------------------------------------------------------
function boot() {
  renderContent();
  initPiano();

  const terrain = initTerrain(document.getElementById('terrain'));

  // pause the terrain render loop when the hero is scrolled away (perf)
  const hero = document.getElementById('hero');
  if ('IntersectionObserver' in window && !REDUCE) {
    const io = new IntersectionObserver(
      (entries) => terrain.setActive(entries[0].isIntersecting),
      { threshold: 0.02 },
    );
    io.observe(hero);
  }

  initMagnetic();
  initHeroEcho();
  initScroll();

  // recalc after web fonts settle (Anton changes layout heights a lot)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
