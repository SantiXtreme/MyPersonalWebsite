// ============================================================
// Atelier Noir — main module
// Hand-built atmospheric scene (drifting fog over a pine treeline)
// + animated film grain, Lenis smooth-scroll, GSAP ScrollTrigger
// page-turn reveals, a WebAudio ambient drone opt-in, and a real
// playable piano driven by the shared piano engine.
// ============================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { person, projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { buildKeyboard, createPianoVoice, noteNameToMidi } from '../../shared/pianoEngine.js';
import { scheduleLiebestraum } from '../../shared/liebestraum.js';

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// ------------------------------------------------------------
// 1. Populate content from the shared single source of truth
// ------------------------------------------------------------
function fillContent() {
  // name
  document.querySelectorAll('[data-name]').forEach((el) => (el.textContent = person.name));
  document.querySelector('[data-wordmark]').textContent = person.name;

  // piano intro
  document.getElementById('piano-intro').textContent = pianoIntro;

  // projects
  const projectsEl = document.getElementById('projects');
  projects.forEach((p, i) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = p.url || '#';
    card.setAttribute('data-reveal', '');
    const num = String(i + 1).padStart(2, '0');
    const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    card.innerHTML = `
      <span class="card-index">${num}</span>
      <h3 class="card-title">${p.title}</h3>
      <p class="card-desc">${p.description}</p>
      <div class="card-tags">${tags}</div>`;
    projectsEl.appendChild(card);
  });

  // hobbies
  const hobbiesEl = document.getElementById('hobbies');
  hobbies.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'hobby';
    row.setAttribute('data-reveal', '');
    row.innerHTML = `
      <h3 class="hobby-title">${h.title}</h3>
      <p class="hobby-desc">${h.description}</p>`;
    hobbiesEl.appendChild(row);
  });

  // contact links
  const linksEl = document.getElementById('links');
  const rows = [
    { label: 'GitHub', href: links.github.url, handle: links.github.handle },
    { label: 'Instagram', href: links.instagram.url, handle: links.instagram.handle },
    { label: 'Email', href: `mailto:${links.email.address}`, handle: links.email.address },
  ];
  rows.forEach(({ label, href, handle }) => {
    const li = document.createElement('li');
    li.className = 'link-row';
    li.innerHTML = `
      <a href="${href}"${label !== 'Email' ? ' target="_blank" rel="noopener"' : ''}>
        <span class="link-label">${label}</span>
        <span class="link-handle">${handle}</span>
      </a>`;
    linksEl.appendChild(li);
  });
}

// ------------------------------------------------------------
// 2. Atmospheric scene — fog drifting over a pine treeline
// ------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a normalised pine ridge: array of {x, h} peaks across [0..1].
function makeRidge(seed, count, minH, maxH) {
  const rnd = mulberry32(seed);
  const peaks = [];
  for (let i = 0; i <= count; i++) {
    const x = i / count + (rnd() - 0.5) * (0.5 / count);
    const h = minH + rnd() * (maxH - minH);
    peaks.push({ x, h });
  }
  return peaks;
}

const sceneState = {
  scrollY: 0,
  mood: 0, // 0..1 how deep into the page — thickens fog / darkens
};

function initScene() {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;

  const ridges = [
    { peaks: makeRidge(11, 26, 0.1, 0.26), base: 0.72, color: '#191a20', parallax: 0.04 },
    { peaks: makeRidge(42, 20, 0.16, 0.4), base: 0.82, color: '#101116', parallax: 0.09 },
    { peaks: makeRidge(77, 15, 0.22, 0.52), base: 0.95, color: '#08080b', parallax: 0.16 },
  ];

  // Fog puffs — soft radial blobs drifting horizontally.
  const puffRnd = mulberry32(303);
  const puffs = [];
  for (let i = 0; i < 18; i++) {
    puffs.push({
      x: puffRnd(),
      y: 0.42 + puffRnd() * 0.5,
      r: 0.16 + puffRnd() * 0.26,
      spd: (0.006 + puffRnd() * 0.014) * (puffRnd() < 0.5 ? -1 : 1),
      a: 0.03 + puffRnd() * 0.05,
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawRidge(r) {
    const shift = sceneState.scrollY * r.parallax;
    const baseY = H * r.base - shift;
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(-40, H + 40);
    ctx.lineTo(-40, baseY);
    for (const p of r.peaks) {
      const px = p.x * (W + 80) - 40;
      const half = (W / r.peaks.length) * 0.62;
      ctx.lineTo(px - half, baseY);
      ctx.lineTo(px, baseY - p.h * H);
      ctx.lineTo(px + half, baseY);
    }
    ctx.lineTo(W + 40, baseY);
    ctx.lineTo(W + 40, H + 40);
    ctx.closePath();
    ctx.fill();
  }

  function render(t) {
    const mood = sceneState.mood;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `rgb(${10 - mood * 4}, ${10 - mood * 4}, ${13 - mood * 4})`);
    sky.addColorStop(0.55, '#121318');
    sky.addColorStop(1, '#1a1b21');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // moon glow (a faint, desaturated warm light behind the ridge)
    const gx = W * 0.68;
    const gy = H * (0.3 - mood * 0.06);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, H * 0.7);
    glow.addColorStop(0, `rgba(199, 181, 156, ${0.14 - mood * 0.06})`);
    glow.addColorStop(0.4, 'rgba(150, 150, 160, 0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // far fog band behind ridges
    drawFog(t, mood, 0.35, 0.55);
    drawRidge(ridges[0]);
    drawFog(t, mood, 0.5, 0.72);
    drawRidge(ridges[1]);
    drawRidge(ridges[2]);
    // foreground mist across the base
    drawFog(t, mood, 0.68, 1.0);
  }

  function drawFog(t, mood, yLo, yHi) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const boost = 1 + mood * 0.7;
    for (const p of puffs) {
      if (p.y < yLo || p.y > yHi) continue;
      const cx = ((p.x % 1) + 1) % 1;
      const x = cx * (W + W * 0.4) - W * 0.2;
      const y = p.y * H - sceneState.scrollY * 0.03;
      const rad = p.r * W;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const alpha = Math.min(p.a * boost, 0.14);
      g.addColorStop(0, `rgba(196, 198, 205, ${alpha})`);
      g.addColorStop(1, 'rgba(196, 198, 205, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function step(now) {
    // advance drift
    if (!prefersReduced) {
      for (const p of puffs) {
        p.x += p.spd * 0.0025;
      }
    }
    render(now * 0.001);
    if (!prefersReduced) rafId = requestAnimationFrame(step);
  }

  let rafId = null;
  resize();
  window.addEventListener('resize', () => {
    resize();
    if (prefersReduced) render(0); // static repaint
  });

  if (prefersReduced) {
    render(0);
  } else {
    rafId = requestAnimationFrame(step);
  }
}

// ------------------------------------------------------------
// 3. Film grain overlay — animated noise tile
// ------------------------------------------------------------
function initGrain() {
  const canvas = document.getElementById('grain');
  const ctx = canvas.getContext('2d');
  const TILE = 110;
  const tile = document.createElement('canvas');
  tile.width = TILE;
  tile.height = TILE;
  const tileCtx = tile.getContext('2d');
  const imgData = tileCtx.createImageData(TILE, TILE);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function regenTile() {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    tileCtx.putImageData(imgData, 0, 0);
  }

  function paint() {
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    paint();
  });

  if (prefersReduced) {
    // one static frame, no flicker
    regenTile();
    paint();
    return;
  }

  // ~11fps flicker for an analog feel without burning CPU
  let last = 0;
  function loop(now) {
    if (now - last > 88) {
      regenTile();
      paint();
      last = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------
// 4. Smooth scroll (Lenis) + scroll-driven mood
// ------------------------------------------------------------
function initScroll() {
  const updateMood = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    sceneState.scrollY = window.scrollY || window.pageYOffset || 0;
    sceneState.mood = max > 0 ? Math.min(sceneState.scrollY / max, 1) : 0;
  };

  if (prefersReduced) {
    // native scroll, no smoothing — just track mood
    window.addEventListener('scroll', updateMood, { passive: true });
    updateMood();
    return;
  }

  const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', () => {
    updateMood();
    ScrollTrigger.update();
  });

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  updateMood();
}

// ------------------------------------------------------------
// 5. Reveal animations (page-turn feel) + hero load-in + wordmark
// ------------------------------------------------------------
function initReveals() {
  const wordmark = document.querySelector('[data-wordmark]');
  const heroBits = gsap.utils.toArray('[data-hero]');
  const reveals = gsap.utils.toArray('[data-reveal]');

  if (prefersReduced) {
    gsap.set([...heroBits, ...reveals], { opacity: 1, y: 0, filter: 'none' });
    // wordmark visible once past the hero
    ScrollTrigger.create({
      trigger: '#work',
      start: 'top 70%',
      onEnter: () => wordmark.classList.add('is-visible'),
      onLeaveBack: () => wordmark.classList.remove('is-visible'),
    });
    return;
  }

  // Hero: slow blur/fade rise on load
  gsap.set(heroBits, { opacity: 0, y: 26, filter: 'blur(12px)' });
  gsap.to(heroBits, {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    duration: 1.6,
    ease: 'power2.out',
    stagger: 0.18,
    delay: 0.25,
  });

  // Section reveals — quiet, restrained, page-turn
  reveals.forEach((el) => {
    gsap.set(el, { opacity: 0, y: 34, filter: 'blur(8px)' });
    gsap.to(el, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 84%',
        toggleActions: 'play none none none',
      },
    });
  });

  // Wordmark fades in after the hero
  ScrollTrigger.create({
    trigger: '#work',
    start: 'top 70%',
    onEnter: () => wordmark.classList.add('is-visible'),
    onLeaveBack: () => wordmark.classList.remove('is-visible'),
  });
}

// ------------------------------------------------------------
// 6. Ambient drone (WebAudio) — opt-in, default OFF
// ------------------------------------------------------------
function initAmbient() {
  const btn = document.getElementById('sound-toggle');
  let ctx = null;
  let nodes = null;
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    filter.connect(master);
    master.connect(ctx.destination);

    // detuned oscillators = a soft, breathing pad
    const freqs = [55, 82.4, 110]; // A1, E2, A2 — an open, hollow fifth
    const oscs = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.6 : 0.32;
      o.connect(g).connect(filter);
      o.start();
      return o;
    });

    // slow LFO opens/closes the filter for gentle movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    nodes = { master, oscs, lfo };
  }

  function enable() {
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    on = true;
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'Disable ambient sound');
    const now = ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.linearRampToValueAtTime(0.05, now + 2.2);
  }

  function disable() {
    on = false;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Enable ambient sound');
    if (!ctx) return;
    const now = ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.linearRampToValueAtTime(0, now + 1.4);
  }

  btn.addEventListener('click', () => (on ? disable() : enable()));
}

// ------------------------------------------------------------
// 7. Playable piano (shared engine, keyed by MIDI to dodge the
//    flat/sharp naming pitfall the shared engine warns about)
// ------------------------------------------------------------
function initPiano() {
  const kbEl = document.getElementById('keyboard');
  const START = 'C3';
  const END = 'C5'; // two octaves — comfortably above the 1.5 minimum
  const { whites, blacks } = buildKeyboard(START, END);

  const voice = createPianoVoice({ outputGain: 0.85 });
  const keyByMidi = new Map();

  // white keys
  whites.forEach((w) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'key white';
    el.dataset.midi = w.midi;
    el.setAttribute('aria-label', `Play ${w.note}`);
    kbEl.appendChild(el);
    keyByMidi.set(w.midi, el);
  });

  // black keys, positioned over the whites
  blacks.forEach((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'key black';
    el.dataset.midi = b.midi;
    el.setAttribute('aria-label', `Play ${b.note}`);
    // sit centred on the gap after its white neighbour
    el.style.left = `calc(${b.afterWhiteIndex + 1} * var(--wk) - var(--bk) / 2)`;
    kbEl.appendChild(el);
    keyByMidi.set(b.midi, el);
  });

  function flash(el, ms = 220) {
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), ms);
  }

  function playMidi(midi, opts = {}) {
    voice.play(midi, { isMidi: true, sustain: 1.5, velocity: 0.9, ...opts });
    flash(keyByMidi.get(midi), (opts.sustain ? opts.sustain * 260 : 220));
  }

  // pointer + keyboard activation on each key
  kbEl.querySelectorAll('.key').forEach((el) => {
    const midi = Number(el.dataset.midi);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playMidi(midi);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playMidi(midi);
      }
    });
  });

  // computer-keyboard mapping over the lower octave (a fun, optional touch)
  const rowMap = {
    a: 'C3', w: 'C#3', s: 'D3', e: 'D#3', d: 'E3', f: 'F3',
    t: 'F#3', g: 'G3', y: 'G#3', h: 'A3', u: 'A#3', j: 'B3',
    k: 'C4', o: 'C#4', l: 'D4',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    const note = rowMap[e.key.toLowerCase()];
    if (!note) return;
    playMidi(noteNameToMidi(note));
  });

  // "Play a phrase" — reuse the shared Liebestraum transcription
  const demoBtn = document.getElementById('demo-btn');
  let demoHandle = null;
  function stopDemo() {
    if (demoHandle) {
      demoHandle.stop();
      demoHandle = null;
    }
    demoBtn.classList.remove('is-playing');
    demoBtn.textContent = 'Play a phrase';
  }
  demoBtn.addEventListener('click', () => {
    if (demoHandle) {
      stopDemo();
      return;
    }
    demoBtn.classList.add('is-playing');
    demoBtn.textContent = 'Stop';
    demoHandle = scheduleLiebestraum({
      eighthMs: 235,
      onNote: (name, opts) => {
        const midi = noteNameToMidi(name);
        voice.play(midi, { isMidi: true, sustain: opts.sustain });
        flash(keyByMidi.get(midi), Math.min((opts.sustain || 0.9) * 260, 420));
      },
    });
    // auto-reset the button when the phrase finishes
    setTimeout(() => {
      if (demoHandle) stopDemo();
    }, demoHandle.totalMs + 200);
  });
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
fillContent();
initScene();
initGrain();
initScroll();
initReveals();
initAmbient();
initPiano();

// Make sure ScrollTrigger measures the final, content-filled layout.
window.addEventListener('load', () => ScrollTrigger.refresh());
