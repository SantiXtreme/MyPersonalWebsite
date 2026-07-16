/* =========================================================================
   Off the hours — main.js
   Santiago's personal site: a scroll spectacle covering five key areas
   (Machine Learning, Math & Physics, Volleyball, Piano, Reading) either
   side of a hero + about, ending on the same "Let's make something move"
   close as before.
   - Lenis smooth scroll + GSAP ScrollTrigger (scrub uses NUMERIC smoothing,
     content reveals use once:true fixed animations — proven, kept).
   - ONE persistent Three.js particle field (scene3d.js) that never goes
     idle and whose palette/behavior morphs per section — plus bloom.
   - Cursor reactivity is spectacular AND distinct per section: the shared
     field's per-scene cursorForce, a torchlight reveal over Machine
     Learning, and a reactive letter-cloud (sections/reactiveLetters.js)
     that lights up the hero/ending text as it passes near it.
   - Five key-area heroes, each with its own motion-first intro: a flowing
     neural net (ML), a live elastic-collision demo + floating equations
     (Math & Physics), the user's own looping clips (Volleyball), the
     shared 3D grand piano (Piano), and a falling book shelf (Reading).
   - Hobbies keeps the shared piano's neighbor slot but swaps in a full
     YouTube-embed background for its featured entry (Elden Ring).
   ========================================================================= */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';

import {
  person,
  aboutIntro,
  keyAreas,
  projects,
  hobbies,
  links,
  pianoIntro,
  volleyball,
  books,
} from './shared/content.js';
import { createGrandPiano3D, CAMERA_PRESETS } from './shared/piano3d.js';
import { createRecitalPlayer, SONGS } from './shared/recital.js';
import { createMotionField } from './scene3d.js';
import { createNeuralNet } from './sections/neuralNet.js';
import { createCollisionDemo } from './sections/collision.js';
import { createFloatingEquations } from './sections/equations.js';
import { createVolleyballPlayer } from './sections/volleyballPlayer.js';
import { createEldenRingBackground } from './sections/eldenRingBg.js';
import { createBookDrop } from './sections/books.js';
import { createReactiveCloud } from './sections/reactiveLetters.js';

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
$('#hero-tagline').textContent = person.tagline;
$('#piano-intro').textContent = pianoIntro;
$('#about-intro').textContent = aboutIntro;

function fillPhotoFrame(frameEl, photoUrl, alt) {
  if (!photoUrl) return; // leave the elegant placeholder in place
  frameEl.innerHTML = `<img src="${photoUrl}" alt="${alt}" loading="lazy" />`;
}
fillPhotoFrame($('#hero-photo-frame'), person.photo, person.name);
fillPhotoFrame($('#volleyball-photo-frame'), volleyball.photo, `${person.name} playing volleyball`);

const keyAreaGrid = $('#key-area-grid');
keyAreas.forEach((k) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'key-area-card reveal';
  btn.innerHTML = `<span class="ka-index">${k.index}</span><span class="ka-label">${k.label}</span>`;
  btn.addEventListener('click', () => scrollToSection(`#${k.id}`));
  keyAreaGrid.appendChild(btn);
});

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

$('#volleyball-intro').textContent = volleyball.intro;
$('#stat-height').textContent = volleyball.height;
$('#stat-position').textContent = volleyball.position;
$('#stat-reach').textContent = volleyball.verticalReach;

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

const reactiveCloud = createReactiveCloud();
reactiveCloud.mount(document.body);

let lastEmberAt = 0;
window.addEventListener('pointermove', (e) => {
  field.setPointer(e.clientX, e.clientY, true);

  if (currentScene === 'hero' && !REDUCED) {
    const now = performance.now();
    if (now - lastEmberAt > 45) {
      lastEmberAt = now;
      field.burst(e.clientX, e.clientY, { count: 2, size: 2, speed: 0.9, life: 520, color: 0x8fc7ff });
    }
  }
  if (currentScene === 'ml') {
    torch.style.setProperty('--tx', `${e.clientX}px`);
    torch.style.setProperty('--ty', `${e.clientY}px`);
    torch.style.opacity = '1';
  }
  if (currentScene === 'hero' || currentScene === 'contact') {
    reactiveCloud.updatePointer(e.clientX, e.clientY);
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
function scrollToSection(selector) {
  const el = $(selector);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView({ behavior: 'smooth' });
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
    // A space-only display:inline-block span collapses to zero width under
    // normal whitespace rules — use a non-breaking space so gaps survive.
    s.textContent = ch === ' ' ? ' ' : ch;
    word.appendChild(s);
  }
  el.appendChild(word);
  return $$('.ch', el);
}

// Intro curtain word — built from person.name so it never drifts out of
// sync with the actual site owner's name.
const introWordEl = $('#intro-word');
for (const ch of person.name.toUpperCase()) {
  const s = document.createElement('span');
  s.textContent = ch;
  introWordEl.appendChild(s);
}

const heroChars = splitChars($('#hero-title'));
const contactChars = [...splitChars($('#ct-line1')), ...splitChars($('#ct-line2'))];
reactiveCloud.registerLetters([...heroChars, ...contactChars]);

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
        if (currentScene !== 'ml') torch.style.opacity = '0';
        reactiveCloud.setActive(currentScene === 'hero' || currentScene === 'contact');
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
revealBatch($$('.key-area-card'), { y: 40, perRow: 5, stagger: 0.08 });
revealBatch($$('.project-card'), { y: 60, rot: 8, perRow: 3, stagger: 0.1 });
revealBatch($$('.stat'), { y: 30, perRow: 3, stagger: 0.1 });
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
  li.addEventListener('click', () => scrollToSection(`#${sec.id}`));
  railList.appendChild(li);
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 55%',
    end: 'bottom 55%',
    onToggle: (self) => li.classList.toggle('active', self.isActive),
  });
});

/* =========================================================================
   6 · MACHINE LEARNING — flowing neural net
   ========================================================================= */
const neuralNet = createNeuralNet($('#ml-canvas'));
ScrollTrigger.create({
  trigger: '#machine-learning',
  start: 'top 70%',
  end: 'bottom 30%',
  onEnter: () => neuralNet.activate(),
  onEnterBack: () => neuralNet.activate(),
  onLeave: () => neuralNet.deactivate(),
  onLeaveBack: () => neuralNet.deactivate(),
});

/* =========================================================================
   7 · MATH & PHYSICS — live elastic collision + floating equations
   ========================================================================= */
const collisionDemo = createCollisionDemo($('#collision-canvas'));
const mathEquations = createFloatingEquations($('#mathphysics-eq-wrap'), { density: 'dense', opacity: 0.4 });
const aboutEquations = createFloatingEquations($('#about-canvas-wrap'), { density: 'sparse', opacity: 0.22 });
mathEquations.bindScroll(ScrollTrigger, '#math-physics');
aboutEquations.bindScroll(ScrollTrigger, '#about');
aboutEquations.activate();
ScrollTrigger.create({
  trigger: '#math-physics',
  start: 'top 70%',
  end: 'bottom 30%',
  onEnter: () => {
    collisionDemo.activate();
    mathEquations.activate();
  },
  onEnterBack: () => {
    collisionDemo.activate();
    mathEquations.activate();
  },
  onLeave: () => {
    collisionDemo.deactivate();
    mathEquations.deactivate();
  },
  onLeaveBack: () => {
    collisionDemo.deactivate();
    mathEquations.deactivate();
  },
});

/* =========================================================================
   8 · VOLLEYBALL — the user's own looping clips, sequential + repeating
   ========================================================================= */
const volleyballPlayer = createVolleyballPlayer($('#volleyball-bg'));
ScrollTrigger.create({
  trigger: '#volleyball',
  start: 'top 80%',
  end: 'bottom 20%',
  onEnter: () => volleyballPlayer.start(),
  onEnterBack: () => volleyballPlayer.start(),
  onLeave: () => volleyballPlayer.stop(),
  onLeaveBack: () => volleyballPlayer.stop(),
});

/* =========================================================================
   9 · READING — falling book shelf, once
   ========================================================================= */
const bookShelf = createBookDrop($('#book-shelf-mount'), books);
ScrollTrigger.create({
  trigger: '#reading',
  start: 'top 75%',
  once: true,
  onEnter: () => bookShelf.play(),
});

/* =========================================================================
   10 · HOBBIES — Elden Ring embed background (featured entry)
   ========================================================================= */
const eldenRingBg = createEldenRingBackground($('#hobbies-bg'));
let eldenRingMounted = false;
ScrollTrigger.create({
  trigger: '#hobbies',
  start: 'top 80%',
  end: 'bottom 20%',
  onEnter: async () => {
    if (!eldenRingMounted) {
      eldenRingMounted = true;
      await eldenRingBg.mount();
    }
    eldenRingBg.play();
  },
  onEnterBack: () => eldenRingBg.play(),
  onLeave: () => eldenRingBg.pause(),
  onLeaveBack: () => eldenRingBg.pause(),
});

/* =========================================================================
   11 · THE 3D PIANO STAGE (fixed) + camera choreography
   ========================================================================= */
const pianoMount = $('#piano-mount');
const piano = createGrandPiano3D(pianoMount, {
  cameraPreset: 'hero',
  accentColor: 0xe7b878,
  bodyColor: 0x120f1e,
  floorColor: 0x0d1013,
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
  piano.renderer.toneMappingExposure = lerp(0.62, 1.08, p);
}
let dollyProgress = 0;
applyDolly(0);
if (REDUCED) {
  applyDolly(1);
  dollyProgress = 1;
} else {
  ScrollTrigger.create({
    trigger: '#recital',
    start: 'top bottom',
    end: 'top top',
    scrub: 0.8,
    onUpdate: (self) => {
      dollyProgress = self.progress;
      applyDolly(self.progress);
    },
  });
  gsap.to(piano.root.rotation, { y: 0.03, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

function setExposure(v, d = 1.2) {
  gsap.to(piano.renderer, { toneMappingExposure: v, duration: d, ease: 'power2.inOut' });
}

/* =========================================================================
   12 · RECITAL PLAYER (3 songs) — per-piece color flows through onNote;
   starting playback flies the camera in on the keys (replaces the old
   Cadenza-triggered fly-in — there's no minigame gating it anymore).
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

    if (!REDUCED) {
      if (s.playing) {
        piano.flyTo('keys', 1.6);
        setExposure(0.85);
      } else {
        piano.flyTo('hero', 1.4);
        setExposure(lerp(0.62, 1.08, dollyProgress));
      }
    }
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
      console.error('[site] song load failed', err);
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
   13 · GO
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
