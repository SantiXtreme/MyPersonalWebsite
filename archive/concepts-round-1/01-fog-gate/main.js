/* =========================================================================
   Fog Gate — main.js
   - Raw WebGL (no Three.js) full-screen-triangle fbm fog + ember shader
   - Canvas-2D ember particles drifting upward
   - GSAP + ScrollTrigger boss-arena title cards (pin + scrub)
   - Lenis smooth scroll
   - Real playable piano via shared/pianoEngine.js
   ========================================================================= */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { person, projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { buildKeyboard, createPianoVoice, noteNameToMidi } from '../../shared/pianoEngine.js';
import { scheduleLiebestraum } from '../../shared/liebestraum.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================================
   1. WEBGL FOG SHADER
   ========================================================================= */
const FRAG = `
precision highp float;
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_scroll;
uniform vec2  u_pointer;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0)); float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p) {
  float v = 0.0; float amp = 0.5;
  for (int i=0;i<5;i++) { v += amp*noise(p); p *= 2.0; amp *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  float t = u_time * 0.045;

  // domain-warped drifting fog
  vec2 q = vec2(
    fbm(p * 2.2 + vec2(0.0, -t * 2.2)),
    fbm(p * 2.2 + vec2(5.2, t * 1.4))
  );
  vec2 r = vec2(
    fbm(p * 2.2 + 3.0 * q + vec2(1.7 - t, 9.2)),
    fbm(p * 2.2 + 3.0 * q + vec2(8.3, 2.8 + t))
  );
  float f = fbm(p * 2.2 + 2.4 * r + vec2(0.0, -t * 1.3));

  // scroll thickens / lifts the fog
  f += u_scroll * 0.18;

  float density = smoothstep(0.05, 1.05, f + length(r) * 0.35);

  // pointer glow — an ember lantern following the cursor
  vec2 ptr = vec2(u_pointer.x * aspect, u_pointer.y);
  float pd = distance(p, ptr);
  float glow = exp(-pd * pd * 3.5) * 0.45;

  // palette — cool blue-ink fog with warm light pooled beyond the gate
  vec3 ink   = vec3(0.028, 0.038, 0.062);   // deep blue-charcoal
  vec3 charc  = vec3(0.075, 0.086, 0.120);  // cool charcoal fog
  vec3 ember = vec3(0.92, 0.45, 0.15);
  vec3 gold  = vec3(0.98, 0.83, 0.52);

  vec3 col = mix(ink, charc, density);

  // warm pool concentrated low & center — the fire beyond the fog gate
  float gateX = 1.0 - smoothstep(0.0, 0.5, abs(uv.x - 0.5));
  float low   = smoothstep(0.74, -0.08, uv.y);
  float warm  = density * low * (0.32 + 0.9 * gateX);
  col = mix(col, ember, clamp(warm * 0.82, 0.0, 1.0));

  // pale-gold only in the brightest wisps
  float hi = smoothstep(0.80, 1.2, f + glow);
  col = mix(col, gold, hi * 0.5);

  // pointer ember bloom
  col += ember * glow * (0.28 + density * 0.7);

  // faint vertical "fog gate" seam of light, breathing slowly
  float seam = exp(-pow((uv.x - 0.5) * 13.0, 2.0));
  col += gold * seam * (0.045 + 0.04 * sin(u_time * 0.4)) * (0.3 + 0.7 * uv.y);

  // vignette (deep, to hold the moody frame)
  vec2 vg = uv - 0.5;
  float vign = smoothstep(1.18, 0.16, dot(vg, vg) * 2.55);
  col *= vign;

  // top darkening — sky above the gate falls to ink
  col *= mix(0.42, 1.0, uv.y * 0.78 + 0.2);

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function initFog() {
  const canvas = document.getElementById('fog');
  const gl =
    canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) ||
    canvas.getContext('experimental-webgl');
  if (!gl) {
    // Graceful fallback: a static warm gradient so the page is never blank.
    canvas.style.background =
      'radial-gradient(120% 80% at 50% 108%, #4a2a12 0%, #14100b 45%, #05060a 100%)';
    return;
  }

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[fog] shader error:', gl.getShaderInfoLog(s));
    }
    return s;
  };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[fog] link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // full-screen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uScroll = gl.getUniformLocation(prog, 'u_scroll');
  const uPointer = gl.getUniformLocation(prog, 'u_pointer');

  // Fog is soft/blurry, so render at reduced scale for performance.
  const RENDER_SCALE = 0.6;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth * RENDER_SCALE));
    const h = Math.max(1, Math.floor(window.innerHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // smoothed pointer + scroll state
  const pointer = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = 1 - e.clientY / window.innerHeight;
    },
    { passive: true }
  );

  let scrollRatio = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollRatio = max > 0 ? window.scrollY / max : 0;
  };
  readScroll();
  window.addEventListener('scroll', readScroll, { passive: true });

  function draw(timeMs) {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    gl.uniform1f(uTime, timeMs * 0.001);
    gl.uniform1f(uScroll, scrollRatio);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (REDUCED) {
    // Reduced motion: render a single frozen frame, no animation loop.
    draw(4200);
  } else {
    const loop = (t) => {
      draw(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

/* =========================================================================
   2. EMBER PARTICLES (canvas 2D)
   ========================================================================= */
function initEmbers() {
  if (REDUCED) return; // near-zero particles on reduced motion
  const canvas = document.getElementById('embers');
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let embers = [];

  function count() {
    return Math.round(Math.min(60, (window.innerWidth * window.innerHeight) / 26000));
  }
  function spawn(initial) {
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + Math.random() * 60,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.25 + Math.random() * 0.7,
      drift: (Math.random() - 0.5) * 0.35,
      phase: Math.random() * Math.PI * 2,
      life: Math.random(),
      hot: Math.random() > 0.55, // some gold, some ember
    };
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    embers = Array.from({ length: count() }, () => spawn(true));
  }
  resize();
  window.addEventListener('resize', resize);

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.vy;
      e.x += e.drift + Math.sin(t * 0.0006 + e.phase) * 0.35;
      e.life += 0.004;
      if (e.y < -10) {
        Object.assign(e, spawn(false));
      }
      // fade near the top of travel
      const fade = Math.min(1, e.y / H + 0.15);
      const twinkle = 0.55 + 0.45 * Math.sin(t * 0.004 + e.phase);
      const a = Math.max(0, fade) * twinkle * 0.8;
      const col = e.hot ? '244,227,173' : '232,147,63';
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* =========================================================================
   3. CONTENT INJECTION (from shared/content.js)
   ========================================================================= */
function injectContent() {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  // Projects
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = projects
    .map(
      (p, i) => `
      <article class="card anim-hide">
        <span class="card-index">Rune ${roman[i] || i + 1}</span>
        <h3 class="card-name">${p.title}</h3>
        <p class="card-desc">${p.description}</p>
        <div class="card-tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      </article>`
    )
    .join('');

  // Piano intro
  document.getElementById('piano-intro').textContent = pianoIntro;

  // Hobbies
  const hg = document.getElementById('hobbies-grid');
  hg.innerHTML = hobbies
    .map(
      (h) => `
      <article class="hobby anim-hide">
        <h3 class="hobby-name">${h.title}</h3>
        <p class="hobby-desc">${h.description}</p>
      </article>`
    )
    .join('');

  // Contact
  const cl = document.getElementById('contact-links');
  const items = [
    { chan: 'GitHub', handle: links.github.handle, href: links.github.url },
    { chan: 'Instagram', handle: links.instagram.handle, href: links.instagram.url },
    { chan: 'Email', handle: links.email.address, href: `mailto:${links.email.address}` },
  ];
  cl.innerHTML = items
    .map(
      (it) => `
      <a class="contact-link" href="${it.href}" target="_blank" rel="noopener noreferrer">
        <span class="contact-chan">${it.chan}</span>
        <span class="contact-handle">${it.handle}</span>
      </a>`
    )
    .join('');
}

/* =========================================================================
   4. PIANO
   ========================================================================= */
function initPiano() {
  const root = document.getElementById('piano-keys');
  const { whites, blacks } = buildKeyboard('C4', 'C6'); // 2 octaves
  const keyByMidi = new Map();

  // white keys
  whites.forEach((w) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key key--white';
    btn.dataset.midi = w.midi;
    btn.setAttribute('aria-label', w.note);
    btn.textContent = w.note.startsWith('C') ? w.note : '';
    root.appendChild(btn);
    keyByMidi.set(w.midi, btn);
  });

  // black keys positioned relative to the white-key track
  const wCount = whites.length;
  blacks.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key key--black';
    btn.dataset.midi = b.midi;
    btn.setAttribute('aria-label', b.note);
    // sit exactly on the boundary between afterWhiteIndex and the next white
    // key; account for the keyboard's 14px horizontal padding.
    btn.style.left = `calc(14px + ${b.afterWhiteIndex + 1} * (100% - 28px) / ${wCount})`;
    root.appendChild(btn);
    keyByMidi.set(b.midi, btn);
  });

  // lazy audio (first gesture) to respect autoplay policy
  let voice = null;
  const getVoice = () => (voice ||= createPianoVoice());

  const flash = (midi) => {
    const el = keyByMidi.get(midi);
    if (!el) return;
    el.classList.add('is-active');
    setTimeout(() => el.classList.remove('is-active'), 190);
  };

  const strike = (midi, opts = {}) => {
    getVoice().play(midi, { isMidi: true, ...opts });
    flash(midi);
  };

  // pointer + keyboard interaction on the keys
  root.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    strike(Number(key.dataset.midi), { velocity: 0.95 });
  });
  // buttons also fire click via Enter/Space (keyboard a11y)
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    strike(Number(key.dataset.midi), { velocity: 0.95 });
  });

  // computer-keyboard row mapping (A..K white + W E T Y U black), one octave from C4
  const KEYMAP = {
    a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
  };
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m === undefined || held.has(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    held.add(e.key);
    strike(m, { velocity: 0.9 });
  });
  window.addEventListener('keyup', (e) => held.delete(e.key));

  // Liebestraum autoplay (bonus)
  const btn = document.getElementById('liebestraum-btn');
  const label = btn.querySelector('.btn-label');
  let player = null;
  const stopPlayer = () => {
    if (player) {
      player.stop();
      player = null;
    }
    btn.classList.remove('is-playing');
    label.textContent = 'Play Liebestraum No. 3';
  };
  btn.addEventListener('click', () => {
    if (player) {
      stopPlayer();
      return;
    }
    getVoice();
    btn.classList.add('is-playing');
    label.textContent = 'Stop';
    player = scheduleLiebestraum({
      onNote: (name, opts) => strike(noteNameToMidi(name), opts),
      eighthMs: 200,
    });
    setTimeout(stopPlayer, player.totalMs + 200);
  });
}

/* =========================================================================
   5. SMOOTH SCROLL + REVEALS + BOSS TITLE CARDS
   ========================================================================= */
function initMotion() {
  // ---- Lenis smooth scroll (skip on reduced motion) ----
  if (!REDUCED) {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis; // debug/verification hook
  }

  if (REDUCED) {
    // Simple, instant reveals — no pins, no scroll-jack theatrics.
    gsap.utils.toArray('.anim-hide').forEach((el) => gsap.set(el, { opacity: 1 }));
    // Title cards are visible by default (no anim-hide on them); nothing else to do.
    return;
  }

  // ---- HERO intro reveal on load ----
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.25 });
  heroTl
    .from('.hero-eyebrow', { opacity: 0, y: 14, duration: 1.1 })
    .to('.hero-eyebrow', { opacity: 1, duration: 0.01 }, '<')
    .fromTo('.rule--top', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.2 }, '-=0.7')
    .fromTo(
      '.hero-title .ht',
      { opacity: 0, y: 30, filter: 'blur(14px)', scale: 1.25 },
      { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 1.6, stagger: 0.09 },
      '-=0.9'
    )
    .fromTo('.rule--bot', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.2 }, '-=1.2')
    .fromTo('.hero-tag', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.2 }, '-=0.7')
    .fromTo('.scroll-cue', { opacity: 0 }, { opacity: 1, duration: 1 }, '-=0.4');

  // ---- BOSS-ARENA TITLE CARDS (pin + scrub) — the signature interaction ----
  gsap.utils.toArray('.chapter').forEach((chapter) => {
    const pin = chapter.querySelector('.chapter-pin');
    const card = chapter.querySelector('.title-card');
    const kicker = card.querySelector('.card-kicker');
    const title = card.querySelector('.card-title');
    const sub = card.querySelector('.card-sub');
    const ruleTop = card.querySelector('.card-rule--top');
    const ruleBot = card.querySelector('.card-rule--bot');

    // initial hidden state
    gsap.set([kicker, title, sub], { opacity: 0 });
    gsap.set([ruleTop, ruleBot], { scaleX: 0, opacity: 0 });
    gsap.set(title, { scale: 1.22, letterSpacing: '0.4em' });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: '+=100%',
        pin: true,
        pinSpacing: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
    });

    // Phase 1 — the banner flashes up big and gold
    tl.to([ruleTop, ruleBot], { scaleX: 1, opacity: 1, duration: 1, ease: 'power2.out' }, 0)
      .to(kicker, { opacity: 1, duration: 0.8 }, 0.15)
      .to(
        title,
        { opacity: 1, scale: 1, letterSpacing: '0.1em', duration: 1.4, ease: 'power3.out' },
        0.2
      )
      .to(sub, { opacity: 1, duration: 1 }, 0.6)
      // Phase 2 — hold (empty gap keeps it on screen as you keep scrolling)
      .to({}, { duration: 1.1 })
      // Phase 3 — the banner recedes, settling out of the way for content
      .to(
        [kicker, sub],
        { opacity: 0, y: -18, duration: 0.8, ease: 'power2.in' },
        '>-0.1'
      )
      .to(
        title,
        { opacity: 0, scale: 1.16, y: -26, filter: 'blur(6px)', duration: 1, ease: 'power2.in' },
        '<'
      )
      .to([ruleTop, ruleBot], { scaleX: 0, opacity: 0, duration: 0.8, ease: 'power2.in' }, '<');
  });

  // ---- CONTENT REVEALS beneath each banner ----
  const revealGroups = [
    '.content-head',
    '#projects-grid .card',
    '.piano-wrap',
    '#hobbies-grid .hobby',
    '#contact-links',
  ];
  revealGroups.forEach((sel) => {
    const els = gsap.utils.toArray(sel);
    if (!els.length) return;
    gsap.fromTo(
      els,
      { opacity: 0, y: 42 },
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: els[0], start: 'top 82%', once: true },
      }
    );
  });

  // Recalculate once fonts/images settle
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/* =========================================================================
   BOOT
   ========================================================================= */
function boot() {
  document.title = `${person.name} — Fog Gate`;
  initFog();
  initEmbers();
  injectContent();
  initPiano();
  initMotion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
