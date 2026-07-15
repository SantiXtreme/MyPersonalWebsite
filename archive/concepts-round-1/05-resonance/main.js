// ============================================================
// Resonance — a living, audio-reactive personal site.
//
// The whole page sits on top of a generative particle field
// (2D canvas, additive glow). The field drifts organically,
// is gently pulled by the cursor, and — the signature move —
// erupts in a pitch-mapped ripple + spark burst every time a
// piano note sounds (click, tap, computer key, or autoplay).
// ============================================================

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import {
  person,
  projects,
  hobbies,
  links,
  pianoIntro,
} from '../../shared/content.js';
import {
  buildKeyboard,
  createPianoVoice,
  noteNameToMidi,
} from '../../shared/pianoEngine.js';
import { scheduleLiebestraum } from '../../shared/liebestraum.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Pitch range used to normalise notes -> position/colour/energy.
// Wider than the visible keyboard so the low autoplay bass (F2/Eb2)
// and any highs still map inside 0..1.
const MIN_MIDI = noteNameToMidi('C2'); // 36
const MAX_MIDI = noteNameToMidi('C6'); // 84
const norm = (midi) =>
  Math.max(0, Math.min(1, (midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)));

// ============================================================
// 1. THE FIELD — generative, cursor + audio reactive canvas
// ============================================================
class ResonanceField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;
    this.t = 0;

    this.particles = [];
    this.sparks = [];
    this.ripples = [];

    // pointer as a soft attractor
    this.pointer = { x: -9999, y: -9999, active: false };

    // Ambient field palette (hue in HSL).
    this.ambientHues = [188, 300, 260, 155]; // cyan, magenta, violet, green

    // Pre-render soft glow sprites keyed by hue bucket — drawing a cached
    // sprite is far cheaper than a fresh radial gradient per particle/frame.
    this.sprites = this._buildSprites();

    this.reduced = REDUCED;
    this.fieldCount = this.reduced ? 30 : 110;
    this.driftScale = this.reduced ? 0.35 : 1;
    this.trailAlpha = this.reduced ? 0.4 : 0.16;

    this.resize();
    this._spawnField();
    this._bind();

    this.running = true;
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  _buildSprites() {
    const sprites = {};
    for (let hue = 140; hue <= 340; hue += 10) {
      const size = 128;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      grad.addColorStop(0, `hsla(${hue}, 100%, 72%, 1)`);
      grad.addColorStop(0.25, `hsla(${hue}, 100%, 60%, 0.55)`);
      grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      sprites[hue] = c;
    }
    return sprites;
  }

  _sprite(hue) {
    let h = Math.round(hue / 10) * 10;
    h = Math.max(140, Math.min(340, h));
    return this.sprites[h];
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // paint the base so first frame isn't a flash of white
    this.ctx.fillStyle = '#06060f';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  _spawnField() {
    this.particles.length = 0;
    for (let i = 0; i < this.fieldCount; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: 14 + Math.random() * 46,
        hue: this.ambientHues[(Math.random() * this.ambientHues.length) | 0],
        alpha: 0.1 + Math.random() * 0.18,
        seed: Math.random() * 1000,
      });
    }
  }

  _bind() {
    const move = (x, y) => {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.active = true;
    };
    window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), {
      passive: true,
    });
    window.addEventListener(
      'pointerdown',
      (e) => move(e.clientX, e.clientY),
      { passive: true },
    );
    window.addEventListener('pointerout', () => (this.pointer.active = false));
    window.addEventListener('resize', () => this.resize());
  }

  // SIGNATURE: called on every note-on. midi drives position, colour,
  // size and speed of the reaction.
  pulse(midi, velocity = 1) {
    const t = norm(midi); // 0 (low) .. 1 (high)
    const margin = this.w * 0.12;
    const x = margin + t * (this.w - margin * 2);
    // originate in a mid band so it's on-screen whatever the scroll pos
    const y = this.h * (0.4 + Math.random() * 0.22);

    // low -> warm magenta/violet, high -> cool cyan/green
    const hue = 330 - t * 175; // 330 .. 155
    const rm = this.reduced ? 0.45 : 1;

    // low = slow + large; high = fast + tight
    const maxR = (470 - t * 300) * rm;
    const speed = (110 + t * 300) * rm;
    this.ripples.push({
      x,
      y,
      r: 6,
      maxR,
      speed,
      hue,
      life: 1,
      lineW: (7 - t * 4.5) * (this.reduced ? 0.7 : 1),
      alpha: (0.4 + t * 0.4) * (this.reduced ? 0.6 : 1),
    });

    // one-time outward impulse on nearby field particles — the whole
    // field visibly kicks when a note lands.
    const impR = maxR * 0.7;
    const push = (24 + t * 60) * velocity * (this.reduced ? 0.4 : 1);
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < impR) {
        const f = (1 - d / impR) * push;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    }

    // spark burst
    const n = this.reduced ? 6 : 14 + ((t * 10) | 0);
    const sp = (60 + t * 200) * rm;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = sp * (0.4 + Math.random() * 0.8);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 3 + Math.random() * 6 + t * 5,
        hue: hue + (Math.random() - 0.5) * 30,
        life: 1,
        decay: 0.6 + Math.random() * 0.7,
      });
    }
    if (this.sparks.length > 500) this.sparks.splice(0, this.sparks.length - 500);
  }

  loop(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // clamp after tab-away
    this.t += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const { w, h, t } = this;
    const pointerR = 260;

    for (const p of this.particles) {
      // organic flow-field drift (cheap pseudo-noise from layered sines)
      const ang =
        Math.sin(p.x * 0.0016 + t * 0.28 + p.seed) *
          Math.cos(p.y * 0.0016 - t * 0.22 + p.seed) *
          Math.PI *
          2;
      const accel = 6 * this.driftScale;
      p.vx += Math.cos(ang) * accel * dt;
      p.vy += Math.sin(ang) * accel * dt;

      // soft cursor attraction + a little tangential swirl -> fluid, not sticky
      if (this.pointer.active) {
        const dx = this.pointer.x - p.x;
        const dy = this.pointer.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < pointerR) {
          const f = (1 - d / pointerR) * (this.reduced ? 20 : 46);
          p.vx += (dx / d) * f * dt;
          p.vy += (dy / d) * f * dt;
          // swirl
          p.vx += (-dy / d) * f * 0.5 * dt;
          p.vy += (dx / d) * f * 0.5 * dt;
        }
      }

      // damping keeps things calm and fluid
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx;
      p.y += p.vy;

      // wrap around edges for an endless field
      const m = p.r;
      if (p.x < -m) p.x = w + m;
      else if (p.x > w + m) p.x = -m;
      if (p.y < -m) p.y = h + m;
      else if (p.y > h + m) p.y = -m;
    }

    // sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.93;
      s.vy *= 0.93;
      s.life -= dt * s.decay;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    // ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += r.speed * dt;
      r.life = 1 - r.r / r.maxR;
      if (r.r >= r.maxR) this.ripples.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    // motion-blur trails: translucent dark rect instead of a hard clear
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(6, 6, 15, ${this.trailAlpha})`;
    ctx.fillRect(0, 0, this.w, this.h);

    // additive glow for everything luminous
    ctx.globalCompositeOperation = 'lighter';

    // field particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      const spr = this._sprite(p.hue);
      ctx.drawImage(spr, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }

    // sparks
    for (const s of this.sparks) {
      const a = Math.max(0, s.life);
      ctx.globalAlpha = a * 0.9;
      const spr = this._sprite(s.hue);
      const r = s.r * (0.6 + s.life * 0.8);
      ctx.drawImage(spr, s.x - r, s.y - r, r * 2, r * 2);
    }

    // ripples (stroked glowing rings)
    ctx.globalAlpha = 1;
    for (const r of this.ripples) {
      const a = Math.max(0, r.life) * r.alpha;
      ctx.strokeStyle = `hsla(${r.hue}, 100%, 65%, ${a})`;
      ctx.lineWidth = r.lineW * (0.5 + r.life);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      // faint inner echo
      ctx.strokeStyle = `hsla(${r.hue}, 100%, 80%, ${a * 0.4})`;
      ctx.lineWidth = Math.max(1, r.lineW * 0.4);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ============================================================
// 2. CONTENT INJECTION (from shared/content.js — never invented)
// ============================================================
function injectContent() {
  document.querySelectorAll('[data-name]').forEach((el) => {
    el.textContent = person.name;
  });

  const intro = document.querySelector('[data-piano-intro]');
  if (intro) intro.textContent = pianoIntro;

  // projects
  const grid = document.getElementById('project-grid');
  projects.forEach((p) => {
    const card = document.createElement('a');
    card.className = 'project-card reveal';
    card.href = p.url || '#';
    if ((p.url || '#') !== '#') {
      card.target = '_blank';
      card.rel = 'noopener';
    }
    const h3 = document.createElement('h3');
    h3.textContent = p.title;
    const desc = document.createElement('p');
    desc.textContent = p.description;
    const tags = document.createElement('div');
    tags.className = 'tag-row';
    (p.tags || []).forEach((tg) => {
      const s = document.createElement('span');
      s.className = 'tag';
      s.textContent = tg;
      tags.appendChild(s);
    });
    card.append(h3, desc, tags);
    grid.appendChild(card);
  });

  // hobbies
  const list = document.getElementById('hobby-list');
  hobbies.forEach((hb) => {
    const li = document.createElement('li');
    li.className = 'hobby-item reveal';
    const h3 = document.createElement('h3');
    h3.textContent = hb.title;
    const p = document.createElement('p');
    p.textContent = hb.description;
    li.append(h3, p);
    list.appendChild(li);
  });

  // contact
  const wrap = document.getElementById('contact-links');
  const entries = [
    { kind: 'github', glyph: '⌥', label: links.github.handle, href: links.github.url },
    {
      kind: 'instagram',
      glyph: '◎',
      label: links.instagram.handle,
      href: links.instagram.url,
    },
    {
      kind: 'email',
      glyph: '✉',
      label: links.email.address,
      href: `mailto:${links.email.address}`,
    },
  ];
  entries.forEach((e) => {
    const a = document.createElement('a');
    a.className = 'contact-link reveal';
    a.dataset.kind = e.kind;
    a.href = e.href;
    if (e.kind !== 'email') {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    const g = document.createElement('span');
    g.className = 'glyph';
    g.setAttribute('aria-hidden', 'true');
    g.textContent = e.glyph;
    const t = document.createElement('span');
    t.textContent = e.label;
    a.append(g, t);
    wrap.appendChild(a);
  });
}

// ============================================================
// 3. THE PIANO — real WebAudio, click / tap / keyboard input
// ============================================================
function buildPiano(field) {
  const voice = createPianoVoice({ outputGain: 0.85 });
  const START = 'C3';
  const END = 'C5';
  const { whites, blacks } = buildKeyboard(START, END);
  const kb = document.getElementById('keyboard');

  // midi -> DOM element, for highlighting from any input source
  const elByMidi = new Map();

  whites.forEach((wk) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key white';
    b.dataset.midi = wk.midi;
    b.setAttribute('aria-label', `Piano key ${wk.note}`);
    const label = document.createElement('span');
    label.className = 'key-label';
    label.textContent = wk.note;
    b.appendChild(label);
    kb.appendChild(b);
    elByMidi.set(wk.midi, b);
  });

  blacks.forEach((bk) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key black';
    b.dataset.midi = bk.midi;
    b.dataset.after = bk.afterWhiteIndex;
    b.setAttribute('aria-label', `Piano key ${bk.note}`);
    kb.appendChild(b);
    elByMidi.set(bk.midi, b);
  });

  // Layout: compute white-key width so it fits (scrolls internally on
  // tiny screens rather than overflowing the page), place blacks by px.
  function layout() {
    const scroll = kb.parentElement;
    const avail = scroll.clientWidth;
    const kw = Math.max(30, Math.min(60, avail / whites.length));
    const blackW = kw * 0.62;
    kb.style.width = kw * whites.length + 'px';
    whites.forEach((wk) => {
      elByMidi.get(wk.midi).style.width = kw + 'px';
    });
    blacks.forEach((bk) => {
      const el = elByMidi.get(bk.midi);
      el.style.width = blackW + 'px';
      // sits over the gap after its reference white key
      el.style.left = (bk.afterWhiteIndex + 1) * kw - blackW / 2 + 'px';
    });
  }
  layout();
  window.addEventListener('resize', layout);

  function flash(midi) {
    const el = elByMidi.get(midi);
    if (!el) return;
    el.classList.add('is-active');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-active'), 190);
  }

  // single entry point for every note-on
  function noteOn(midi, { velocity = 1, sustain = 1.6 } = {}) {
    voice.play(midi, { isMidi: true, velocity, sustain });
    field.pulse(midi, velocity);
    flash(midi);
  }

  // pointer input on the keyboard (event delegation)
  kb.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    noteOn(Number(key.dataset.midi), { velocity: 0.95 });
  });
  // keyboard-accessible activation of a focused key
  kb.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    noteOn(Number(key.dataset.midi), { velocity: 0.9 });
  });

  // Computer-keyboard input: classic chromatic layout starting at START.
  const keyOrder = [
    'a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j',
    'k', 'o', 'l', 'p', ';', "'",
  ];
  const startMidi = noteNameToMidi(START);
  const charToMidi = new Map();
  keyOrder.forEach((c, i) => charToMidi.set(c, startMidi + i));
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const c = e.key.toLowerCase();
    if (!charToMidi.has(c) || held.has(c)) return;
    held.add(c);
    noteOn(charToMidi.get(c), { velocity: 0.85 });
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

  return { noteOn, voice };
}

// ============================================================
// 4. AUTOPLAY — Liszt, Liebestraum No. 3 (shared transcription)
// ============================================================
function wireAutoplay(piano) {
  const btn = document.getElementById('autoplay-btn');
  let handle = null;

  function stop() {
    if (handle) handle.stop();
    handle = null;
    btn.setAttribute('aria-pressed', 'false');
    btn.querySelector('.autoplay-label').textContent =
      'Autoplay — Liszt, Liebestraum No. 3';
  }

  btn.addEventListener('click', () => {
    if (handle) {
      stop();
      return;
    }
    btn.setAttribute('aria-pressed', 'true');
    btn.querySelector('.autoplay-label').textContent = 'Stop';
    handle = scheduleLiebestraum({
      eighthMs: REDUCED ? 240 : 210,
      onNote: (noteName, opts) => {
        piano.noteOn(noteNameToMidi(noteName), {
          velocity: 0.8,
          sustain: opts?.sustain ?? 1.4,
        });
      },
    });
    // auto-reset the button when the piece finishes
    setTimeout(() => {
      if (handle) stop();
    }, handle.totalMs + 200);
  });
}

// ============================================================
// 5. SCROLL — Lenis smooth scroll + GSAP section reveals
// ============================================================
function initScroll() {
  if (REDUCED) {
    // no smoothing, just make everything visible
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    return;
  }

  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // reveal groups on scroll with a soft, living ease (hero handled separately)
  gsap.utils.toArray('.reveal').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'back.out(1.4)',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
          onEnter: () => el.classList.add('is-in'),
        },
      },
    );
  });

  // hero reveals immediately with a gentle stagger
  gsap.set('.hero .reveal', { opacity: 0, y: 28 });
  gsap.to('.hero .reveal', {
    opacity: 1,
    y: 0,
    duration: 1.1,
    ease: 'back.out(1.5)',
    stagger: 0.12,
    delay: 0.15,
    onComplete: () =>
      document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('is-in')),
  });
}

// ============================================================
// Boot
// ============================================================
function boot() {
  injectContent();
  const field = new ResonanceField(document.getElementById('field'));
  const piano = buildPiano(field);
  wireAutoplay(piano);
  initScroll();

  // A tiny "hello" ripple so the field is alive before any interaction
  // (helps first paint feel intentional; skipped under reduced motion flashes? keep small)
  setTimeout(() => field.pulse(noteNameToMidi('G3'), 0.5), 600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
