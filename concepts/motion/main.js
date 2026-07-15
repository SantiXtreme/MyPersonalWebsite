/* =========================================================================
   Motion — main.js
   A scroll spectacle, rebuilt: Elden-Ring-rooted atmosphere (golden Site-of-
   Grace sigils, foggy ruin-dusk palette, drifting embers) reimagined as an
   original WebGL portfolio piece rather than a literal reskin.
   - Lenis smooth scroll + GSAP ScrollTrigger (scrub uses NUMERIC smoothing,
     content reveals use once:true fixed animations — the round-1 fix, kept
     because it's proven and explicitly validated in NOTES.md).
   - ONE persistent Three.js particle field (shared/../scene3d.js) that never
     goes idle and whose palette/behavior morphs per "scene" — plus bloom.
   - Cursor reactivity is spectacular AND distinct per section, but all
     built on that same field (see scene3d.js's cursorForce per scene) with
     two extra lightweight DOM touches where a discrete effect fits better:
     a torchlight reveal over the project cards, and a rune sigil that
     trails the cursor on contact.
   - The shared Three.js grand piano on a fixed stage, scrubbed dolly-in +
     camera-fly to the keys for the minigame — reused from recital's proven
     choreography via the shared CAMERA_PRESETS.
   - "Cadenza": the falling-notes rhythm minigame, re-skinned, still driving
     the real 3D keys.
   ========================================================================= */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';

import { person, projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { createGrandPiano3D, CAMERA_PRESETS } from '../../shared/piano3d.js';
import { createRecitalPlayer, SONGS } from '../../shared/recital.js';
import { createMotionField } from './scene3d.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* =========================================================================
   0 · POPULATE CONTENT FROM shared/content.js
   ========================================================================= */
$('#signoff-name').textContent = person.name;
$('#piano-intro').textContent = pianoIntro;

const projectGrid = $('#project-grid');
projects.forEach((p, i) => {
  const card = document.createElement('article');
  card.className = 'project-card reveal';
  card.innerHTML = `
    <span class="card-num">P/${String(i + 1).padStart(2, '0')}</span>
    <h3 class="card-title">${p.title}</h3>
    <p class="card-desc">${p.description}</p>
    <div class="card-tags">${p.tags.map((t) => `<span>${t}</span>`).join('')}</div>
    <a class="card-arrow" href="${p.url}">Open <span>&rarr;</span></a>`;
  projectGrid.appendChild(card);
});

const hobbyList = $('#hobby-list');
hobbies.forEach((h, i) => {
  const row = document.createElement('div');
  row.className = 'hobby-row reveal';
  row.innerHTML = `
    <span class="h-index">0${i + 1}</span>
    <span class="h-title">${h.title}</span>
    <span class="h-desc">${h.description}</span>`;
  hobbyList.appendChild(row);
});

const contactLinks = $('#contact-links');
const LINKS = [
  { label: 'GitHub', href: links.github.url },
  { label: 'Instagram', href: links.instagram.url },
  { label: 'Email', href: `mailto:${links.email.address}` },
];
LINKS.forEach((l) => {
  const a = document.createElement('a');
  a.className = 'contact-link reveal';
  a.href = l.href;
  a.textContent = l.label;
  if (l.label !== 'Email') {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  contactLinks.appendChild(a);
});

/* =========================================================================
   1 · THE ATMOSPHERIC FIELD (never idle) — see scene3d.js
   ========================================================================= */
const field = createMotionField($('#field'));
field.setScene('hero');

/* =========================================================================
   2 · CURSOR REACTIVITY — one shared field, a distinct touch per section
   ========================================================================= */
let currentScene = 'hero';
const torch = $('#torch');
const graceSigil = $('#grace-sigil');
const sigilFollow = { x: gsap.quickTo(graceSigil, 'x', { duration: 1.1, ease: 'elastic.out(1, 0.55)' }), y: null };
sigilFollow.y = gsap.quickTo(graceSigil, 'y', { duration: 1.1, ease: 'elastic.out(1, 0.55)' });
// Cached at rest (transform zeroed) whenever contact becomes active — the
// cursor-follow offset below is computed against this fixed point, not a
// fresh getBoundingClientRect() each move (which would already include the
// sigil's current offset and compound into runaway drift).
let sigilRest = null;

let lastEmberAt = 0;
window.addEventListener('pointermove', (e) => {
  field.setPointer(e.clientX, e.clientY, true);

  if (currentScene === 'hero' && !REDUCED) {
    const now = performance.now();
    if (now - lastEmberAt > 45) {
      lastEmberAt = now;
      field.burst(e.clientX, e.clientY, { count: 2, size: 2, speed: 0.9, life: 520, color: 0xf3cf94 });
    }
  }
  if (currentScene === 'projects') {
    torch.style.setProperty('--tx', `${e.clientX}px`);
    torch.style.setProperty('--ty', `${e.clientY}px`);
    torch.style.opacity = '1';
  }
  if (currentScene === 'contact' && !REDUCED && sigilRest) {
    sigilFollow.x(clamp((e.clientX - sigilRest.cx) * 0.18, -46, 46));
    sigilFollow.y(clamp((e.clientY - sigilRest.cy) * 0.18, -46, 46));
  }
});
window.addEventListener('pointerleave', () => {
  field.setPointer(-9999, -9999, false);
  torch.style.opacity = '0';
});

/* =========================================================================
   3 · SMOOTH SCROLL (Lenis) — native fallback under reduced-motion
   ========================================================================= */
let lenis = null;
if (!REDUCED) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', () => ScrollTrigger.update());
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* =========================================================================
   4 · CINEMATIC INTRO + KINETIC HERO TYPE
   ========================================================================= */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const word = document.createElement('span');
  word.className = 'word';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    word.appendChild(s);
  }
  el.appendChild(word);
  return $$('.ch', el);
}

const heroChars = splitChars($('#hero-title'));
gsap.set(heroChars, { yPercent: 120, opacity: 0 });
gsap.set('.reveal-intro', { opacity: 0, y: 24 });

let introRan = false;
function runIntro() {
  if (introRan) return;
  introRan = true;
  if (REDUCED) {
    $('#intro').style.display = 'none';
    gsap.set(heroChars, { yPercent: 0, opacity: 1 });
    gsap.set('.reveal-intro', { opacity: 1, y: 0 });
    return;
  }
  lenis && lenis.stop();
  const tl = gsap.timeline({
    onComplete: () => {
      $('#intro').classList.add('done');
      lenis && lenis.start();
    },
  });
  tl.to('#intro .intro-sigil', { opacity: 0.85, scale: 1, duration: 1.0, ease: 'power2.out' }, 0)
    .to('#intro .intro-word span', {
      opacity: 1,
      yPercent: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.06,
      startAt: { yPercent: 60 },
    }, 0.15)
    .fromTo('#intro .intro-line', { width: 0 }, { width: '46%', duration: 0.7, ease: 'power2.inOut' }, '-=0.2')
    .to('#intro .intro-sigil', { opacity: 0, scale: 1.4, duration: 0.6, ease: 'power2.in' }, '-=0.3')
    .to('#intro .intro-word span', { yPercent: -120, opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.03 }, '+=0.25')
    .to('#intro', { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.15')
    .set('#intro', { display: 'none' })
    .to(
      heroChars,
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.06,
        startAt: { filter: 'blur(14px)' },
        filter: 'blur(0px)',
      },
      '-=0.55'
    )
    .to('.reveal-intro', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, '-=0.7');
}

/* =========================================================================
   5 · SCROLL SCENES · REVEALS · RAIL
   ========================================================================= */
$$('.scene').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 60%',
    end: 'bottom 40%',
    onToggle: (self) => {
      if (self.isActive) {
        currentScene = sec.dataset.scene;
        field.setScene(currentScene);
        if (currentScene !== 'projects') torch.style.opacity = '0';
        if (currentScene === 'contact') {
          gsap.set(graceSigil, { x: 0, y: 0 });
          const r = graceSigil.getBoundingClientRect();
          sigilRest = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
          field.setGatherPoint(sigilRest.cx, sigilRest.cy);
        } else {
          sigilRest = null;
          field.setGatherPoint(null);
        }
      }
    },
  });
});

function revealBatch(items, opts = {}) {
  items.forEach((el, i) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.fromTo(
          el,
          { opacity: 0, y: REDUCED ? 0 : opts.y ?? 46, rotateX: REDUCED ? 0 : opts.rot ?? 0 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: REDUCED ? 0.4 : 0.9,
            ease: 'power3.out',
            delay: (i % (opts.perRow || 3)) * (opts.stagger ?? 0.09),
          }
        );
      },
    });
  });
}
$$('.section-head').forEach((h) => revealBatch([h], { y: 30 }));
$('.contact-title') && revealBatch([$('.contact-title')], { y: 40 });
revealBatch($$('.project-card'), { y: 60, rot: 8, perRow: 3, stagger: 0.1 });
revealBatch($$('.hobby-row'), { y: 40, perRow: 1, stagger: 0 });
revealBatch($$('.contact-link'), { y: 24, perRow: 3, stagger: 0.08 });

if (!REDUCED) {
  gsap.to('#hero-title', {
    yPercent: -18,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
  });
  gsap.to('.hero-tagline', {
    yPercent: -40,
    opacity: 0.2,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
  });
}

const railList = $('#rail-list');
$$('.scene').forEach((sec, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<span class="rlabel">${sec.dataset.label}</span><span class="dot"></span>`;
  li.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(sec, { offset: 0, duration: 1.4 });
    else sec.scrollIntoView({ behavior: 'smooth' });
  });
  railList.appendChild(li);
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 55%',
    end: 'bottom 55%',
    onToggle: (self) => li.classList.toggle('active', self.isActive),
  });
});

/* =========================================================================
   6 · THE 3D PIANO STAGE (fixed) + camera choreography
   ========================================================================= */
const pianoMount = $('#piano-mount');
const piano = createGrandPiano3D(pianoMount, {
  cameraPreset: 'hero',
  accentColor: 0xe7b878,
  bodyColor: 0x120f1e,
  floorColor: 0x0d1013, // wet-dark-stone tint, distinct from recital's warm wood
});

const accentLight = new THREE.PointLight(0xe7b878, 0, 7, 2);
accentLight.position.set(0.7, 1.5, 1.6);
piano.scene.add(accentLight);
function pulseAccent(v = 0.8, color) {
  gsap.killTweensOf(accentLight);
  if (color !== undefined) accentLight.color.set(color);
  accentLight.intensity = 2.4 * clamp(v, 0.3, 1);
  gsap.to(accentLight, { intensity: 0, duration: 0.55, ease: 'power2.out' });
}

const stage = $('#piano-stage');
ScrollTrigger.create({
  trigger: '#recital',
  start: 'top 85%',
  endTrigger: '#cadenza',
  end: 'bottom 15%',
  onToggle: (self) => gsap.to(stage, { opacity: self.isActive ? 1 : 0, duration: 0.8, ease: 'power2.out' }),
});

const FAR = CAMERA_PRESETS.stage;
const NEAR = CAMERA_PRESETS.hero;
function applyDolly(p) {
  piano.camera.position.set(
    lerp(FAR.pos[0], NEAR.pos[0], p),
    lerp(FAR.pos[1], NEAR.pos[1], p),
    lerp(FAR.pos[2], NEAR.pos[2], p)
  );
  piano.camera.lookAt(
    lerp(FAR.look[0], NEAR.look[0], p),
    lerp(FAR.look[1], NEAR.look[1], p),
    lerp(FAR.look[2], NEAR.look[2], p)
  );
  // No root.position.y "sink while far" shift here (the old version had
  // one) — it was tuned against the old, wider-framed camera presets; with
  // the new closer "keys legible" hero/stage framing (see piano3d.js) the
  // same absolute shift read as a broken, way-too-close piano.
  piano.renderer.toneMappingExposure = lerp(0.62, 1.08, p);
}
applyDolly(0);
if (REDUCED) {
  applyDolly(1);
} else {
  ScrollTrigger.create({
    trigger: '#recital',
    start: 'top bottom',
    end: 'top top',
    scrub: 0.8,
    onUpdate: (self) => applyDolly(self.progress),
  });
  gsap.to(piano.root.rotation, { y: 0.03, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

function setExposure(v, d = 1.2) {
  gsap.to(piano.renderer, { toneMappingExposure: v, duration: d, ease: 'power2.inOut' });
}
ScrollTrigger.create({
  trigger: '#cadenza',
  start: 'top 62%',
  end: 'bottom 38%',
  onEnter: () => {
    piano.flyTo('keys', 1.6);
    setExposure(0.85);
    game.setActive(true);
  },
  onEnterBack: () => {
    piano.flyTo('keys', 1.6);
    setExposure(0.85);
    game.setActive(true);
  },
  onLeave: () => {
    game.setActive(false);
  },
  onLeaveBack: () => {
    if (!REDUCED) piano.flyTo('hero', 1.4);
    else applyDolly(1);
    setExposure(1.08);
    game.setActive(false);
  },
});

/* =========================================================================
   7 · RECITAL PLAYER (3 songs) — per-piece color flows through onNote
   ========================================================================= */
const media = $('#media');
const nowPlaying = $('#now-playing');
const transport = $('#transport');
const playBtn = $('#play-btn');
const pauseBtn = $('#pause-btn');
const tStatus = $('#t-status');

const player = createRecitalPlayer({
  mediaContainer: media,
  onNote: (midi, opts) => {
    piano.pressKey(midi, opts);
    pulseAccent(opts?.velocity ?? 0.8, opts?.color);
    field.burst(window.innerWidth * 0.7, window.innerHeight * 0.55, {
      count: 6,
      color: opts?.color,
      size: 3,
      speed: 1.4,
      life: 650,
    });
  },
  onStateChange: (s) => {
    if (s.ended) tStatus.textContent = 'ended';
    else tStatus.textContent = s.playing ? 'playing' : 'paused';
  },
});

const songList = $('#song-list');
let loadingSong = false;
let currentSongId = null;

SONGS.forEach((song) => {
  const btn = document.createElement('button');
  btn.className = 'song-btn';
  btn.type = 'button';
  btn.innerHTML = `<span class="s-title">${song.title}</span><span class="s-sub">${song.subtitle}</span>`;
  btn.addEventListener('click', async () => {
    if (loadingSong || currentSongId === song.id) return;
    loadingSong = true;
    $$('.song-btn', songList).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    transport.hidden = true;
    tStatus.textContent = '';
    nowPlaying.innerHTML = `Loading <em style="font-style:normal;color:var(--ink)">${song.title}</em>&hellip;`;
    try {
      await player.load(song.id);
      currentSongId = song.id;
      nowPlaying.innerHTML = `Now cued · <em style="font-style:normal;color:var(--ink)">${song.title}</em> — ${song.subtitle}`;
      transport.hidden = false;
    } catch (err) {
      console.error('[motion] song load failed', err);
      nowPlaying.textContent = 'Could not load this piece — try another.';
    } finally {
      loadingSong = false;
    }
  });
  songList.appendChild(btn);
});

playBtn.addEventListener('click', () => player.play());
pauseBtn.addEventListener('click', () => player.pause());

/* =========================================================================
   8 · CADENZA — falling-notes rhythm minigame (re-skinned, same mechanics)
   ========================================================================= */
const game = (() => {
  const shell = $('#game-shell');
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const startBtn = $('#game-start');
  const verdict = $('#game-verdict');
  const elScore = $('#hud-score');
  const elCombo = $('#hud-combo');
  const elAcc = $('#hud-acc');

  const LANES = 4;
  const KEY_MAP = { d: 0, f: 1, j: 2, k: 3 };
  const LANE_MIDI = [55, 60, 64, 67];
  const LANE_COL = [
    [231, 184, 120],
    [161, 214, 255],
    [220, 160, 255],
    [255, 158, 158],
  ];
  const FALL_MS = 1500;
  const PERFECT = 55;
  const GOOD = 120;
  const RUN_MS = 45000;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let hitY = 0;

  let notes = [];
  let laneFlash = [0, 0, 0, 0];
  let running = false;
  let active = false;
  let raf = null;
  let last = 0;
  let elapsed = 0;
  let nextSpawn = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let judged = 0;

  function resize() {
    const r = shell.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    hitY = H * 0.8;
  }
  new ResizeObserver(resize).observe(shell);
  resize();

  const laneX = (i) => W * (0.5 + (i - (LANES - 1) / 2) * 0.15);
  const laneW = () => W * 0.115;

  function spawn() {
    const lane = Math.floor(Math.random() * LANES);
    notes.push({ lane, t: 0, hit: false });
  }

  function screenPos(el) {
    const r = shell.getBoundingClientRect();
    return { x: r.left + el.x, y: r.top + el.y };
  }

  function judge(lane) {
    if (!running) return;
    let best = null;
    let bestD = Infinity;
    for (const n of notes) {
      if (n.lane !== lane || n.hit) continue;
      const d = Math.abs(n.t - FALL_MS);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    laneFlash[lane] = 1;
    if (best && bestD <= GOOD) {
      best.hit = true;
      judged++;
      const perfect = bestD <= PERFECT;
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      score += (perfect ? 100 : 55) + combo * 4;
      hits++;
      const sp = screenPos({ x: laneX(lane), y: hitY });
      field.burst(sp.x, sp.y, { count: perfect ? 22 : 12, color: rgbToHex(LANE_COL[lane]), speed: perfect ? 3.2 : 2.1, life: 620 });
      showVerdict(perfect ? 'Perfect' : 'Good', LANE_COL[lane]);
      piano.pressKey(LANE_MIDI[lane], { velocity: perfect ? 0.95 : 0.7 });
      pulseAccent(perfect ? 0.95 : 0.7, rgbToHex(LANE_COL[lane]));
      sync();
    } else {
      combo = 0;
      sync();
    }
  }

  function rgbToHex([r, g, b]) {
    return (r << 16) | (g << 8) | b;
  }

  function miss() {
    combo = 0;
    judged++;
    showVerdict('Miss', [140, 130, 150]);
    sync();
  }

  let verdictTween = null;
  function showVerdict(text, col) {
    verdict.textContent = text;
    verdict.style.color = `rgb(${col[0]},${col[1]},${col[2]})`;
    verdictTween && verdictTween.kill();
    verdictTween = gsap.fromTo(
      verdict,
      { opacity: 1, scale: 0.85 },
      { opacity: 0, scale: 1.15, duration: 0.7, ease: 'power2.out' }
    );
  }

  function sync() {
    elScore.textContent = score;
    elCombo.textContent = combo;
    elAcc.textContent = (judged ? Math.round((hits / judged) * 100) : 100) + '%';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const lw = laneW();

    for (let i = 0; i < LANES; i++) {
      const x = laneX(i);
      const c = LANE_COL[i];
      const flash = laneFlash[i];
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.02 + flash * 0.05})`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${0.09 + flash * 0.18})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - lw / 2, 0, lw, H);
      laneFlash[i] = Math.max(0, flash - 0.02);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, hitY - 18, 0, hitY + 18);
    hg.addColorStop(0, 'rgba(231,184,120,0)');
    hg.addColorStop(0.5, 'rgba(231,184,120,0.5)');
    hg.addColorStop(1, 'rgba(231,184,120,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(laneX(0) - lw, hitY - 18, laneX(LANES - 1) - laneX(0) + lw * 2, 36);
    ctx.restore();

    for (let i = 0; i < LANES; i++) {
      const x = laneX(i);
      const c = LANE_COL[i];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.5 + laneFlash[i] * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // a rune-tablet notch instead of a plain rounded rect
      ctx.roundRect(x - lw / 2 + 3, hitY - 9, lw - 6, 18, [3, 9, 3, 9]);
      ctx.stroke();
    }

    for (const n of notes) {
      if (n.hit) continue;
      const p = n.t / FALL_MS;
      const y = p * hitY;
      const x = laneX(n.lane);
      const c = LANE_COL[n.lane];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = lw * 0.4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.7);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.95)`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.95)`;
      ctx.beginPath();
      ctx.roundRect(x - r, y - r * 0.42, r * 2, r * 0.84, r * 0.3);
      ctx.fill();
    }

    if (!running) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, hitY - 1, W, 2);
    }
  }

  function step(now) {
    if (!active) {
      raf = null;
      return;
    }
    const dt = Math.min(50, now - last);
    last = now;

    if (running) {
      elapsed += dt;
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        spawn();
        nextSpawn = 460 + Math.random() * 360 - Math.min(220, elapsed / 220);
      }
      for (const n of notes) n.t += dt;
      for (const n of notes) {
        if (!n.hit && n.t - FALL_MS > GOOD) {
          n.hit = true;
          miss();
        }
      }
      notes = notes.filter((n) => n.t < FALL_MS + 500);
      if (elapsed >= RUN_MS) finish();
    }

    draw();
    raf = requestAnimationFrame(step);
  }

  function ensureLoop() {
    if (!raf && active) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  function start() {
    notes = [];
    score = 0;
    combo = 0;
    maxCombo = 0;
    hits = 0;
    judged = 0;
    elapsed = 0;
    nextSpawn = 700;
    running = true;
    sync();
    startBtn.classList.add('hidden');
    ensureLoop();
  }

  function finish() {
    running = false;
    verdict.textContent = `${score}`;
    verdict.style.color = 'var(--gold)';
    gsap.fromTo(verdict, { opacity: 1, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' });
    startBtn.textContent = 'Play again';
    startBtn.classList.remove('hidden');
  }

  window.addEventListener('keydown', (e) => {
    if (!active || !running) return;
    const lane = KEY_MAP[e.key.toLowerCase()];
    if (lane !== undefined) {
      e.preventDefault();
      judge(lane);
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!running) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    let lane = 0;
    let bd = Infinity;
    for (let i = 0; i < LANES; i++) {
      const d = Math.abs(x - laneX(i));
      if (d < bd) {
        bd = d;
        lane = i;
      }
    }
    judge(lane);
  });
  startBtn.addEventListener('click', start);

  return {
    setActive(v) {
      active = v;
      if (v) ensureLoop();
    },
  };
})();

/* =========================================================================
   9 · GO
   ========================================================================= */
window.addEventListener('load', () => {
  ScrollTrigger.refresh();
  runIntro();
});
if (document.readyState === 'complete') {
  ScrollTrigger.refresh();
  runIntro();
}
window.addEventListener('resize', () => ScrollTrigger.refresh());
setTimeout(() => ScrollTrigger.refresh(), 1200);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
