// ============================================================
// Recital — main module
//
// "Entering a theatre and watching a piano recital, with ML in
// mind." A velvet curtain parts on load; a real 3D grand piano
// sits fixed under a spotlight; the camera makes a slow reverent
// approach as you scroll to the stage; three recital pieces play
// for real and strike the piano's keys; ML projects are listed as
// the evening's "programme" of movements.
//
// Built on: Lenis (silky smooth scroll), GSAP + ScrollTrigger
// (soft blur-rise reveals + the curtain timeline + the camera
// dolly), the shared 3D piano (shared/piano3d.js) and the shared
// three-song recital player (shared/recital.js).
// ============================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';

import { person, projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { createGrandPiano3D, CAMERA_PRESETS } from '../../shared/piano3d.js';
import { createRecitalPlayer, SONGS } from '../../shared/recital.js';

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// ------------------------------------------------------------
// 1. Content from the shared single source of truth
// ------------------------------------------------------------
function fillContent() {
  document.querySelectorAll('[data-name]').forEach((el) => (el.textContent = person.name));
  document.querySelector('[data-wordmark]').textContent = person.name;
  document.getElementById('piano-intro').textContent = pianoIntro;

  // Projects → programme "movements"
  const projectsEl = document.getElementById('projects');
  projects.forEach((p, i) => {
    const row = document.createElement('article');
    row.className = 'movement';
    row.setAttribute('data-reveal', '');
    const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    row.innerHTML = `
      <div class="movement-numeral">${ROMAN[i] || i + 1}</div>
      <div class="movement-body">
        <h3 class="movement-title">${p.title}</h3>
        <p class="movement-desc">${p.description}</p>
        <div class="movement-tags">${tags}</div>
      </div>`;
    projectsEl.appendChild(row);
  });

  // Hobbies
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

  // Contact links
  const linksEl = document.getElementById('links');
  const rows = [
    { label: 'GitHub', href: links.github.url, handle: links.github.handle, ext: true },
    { label: 'Instagram', href: links.instagram.url, handle: links.instagram.handle, ext: true },
    { label: 'Email', href: `mailto:${links.email.address}`, handle: links.email.address, ext: false },
  ];
  rows.forEach(({ label, href, handle, ext }) => {
    const li = document.createElement('li');
    li.className = 'link-row';
    li.innerHTML = `
      <a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>
        <span class="link-label">${label}</span>
        <span class="link-handle">${handle}</span>
      </a>`;
    linksEl.appendChild(li);
  });
}

// ------------------------------------------------------------
// 2. Filmic grain (subtle, warm) — reuses the proven tile approach
// ------------------------------------------------------------
function initGrain() {
  const canvas = document.getElementById('grain');
  const ctx = canvas.getContext('2d');
  const TILE = 120;
  const tile = document.createElement('canvas');
  tile.width = TILE;
  tile.height = TILE;
  const tileCtx = tile.getContext('2d');
  const imgData = tileCtx.createImageData(TILE, TILE);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function regen() {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
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
    regen();
    paint();
    return;
  }
  let last = 0;
  function loop(now) {
    if (now - last > 96) {
      regen();
      paint();
      last = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------
// 3. Smooth scroll (Lenis) driving ScrollTrigger
// ------------------------------------------------------------
function initScroll() {
  if (prefersReduced) return; // native scroll — calm by default
  const lenis = new Lenis({
    duration: 1.25,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

// ------------------------------------------------------------
// 4. The 3D piano + spotlight camera + dust
// ------------------------------------------------------------
const stageState = {
  approach: prefersReduced ? 1 : 0, // 0 = far / back of the hall, 1 = near
  visible: prefersReduced ? 1 : 0, // stage-layer opacity target
};

function initStage() {
  const mount = document.getElementById('piano-mount');
  const layer = document.getElementById('stage-layer');
  const spotlightEl = document.getElementById('spotlight');
  const floorGlow = document.getElementById('floor-glow');

  const piano = createGrandPiano3D(mount, {
    cameraPreset: 'stage',
    accentColor: 0xc9a86a, // warm footlight gold — suits the theatre
    bodyColor: 0x0a0908,
    floorColor: 0x1c140c, // warm stage-wood tint for the reflective floor
  });
  const cam = piano.camera;

  // Two anchors: FAR (approaching from the back of the hall, = the shared
  // 'stage' preset) → NEAR (the shared 'hero' preset, angled down into the
  // now-detailed open lid so the gold plate/strings read once the instrument
  // is close). Reusing the named presets from piano3d.js instead of
  // duplicating the numbers keeps this in sync with motion's choreography.
  const FAR = CAMERA_PRESETS.stage;
  const NEAR = CAMERA_PRESETS.hero;

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeApproach = (t) => 1 - Math.pow(1 - t, 3); // cubic ease-out

  function driveCamera(now) {
    const p = easeApproach(Math.min(1, Math.max(0, stageState.approach)));
    pos.set(
      lerp(FAR.pos[0], NEAR.pos[0], p),
      lerp(FAR.pos[1], NEAR.pos[1], p),
      lerp(FAR.pos[2], NEAR.pos[2], p)
    );
    look.set(
      lerp(FAR.look[0], NEAR.look[0], p),
      lerp(FAR.look[1], NEAR.look[1], p),
      lerp(FAR.look[2], NEAR.look[2], p)
    );

    // Portrait framing: ease the camera back along its view axis so the
    // whole instrument stays in frame on tall/narrow viewports.
    const aspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
    const pull = aspect < 1 ? 1 + (1 - aspect) * 0.85 : 1;
    if (pull !== 1) {
      dir.subVectors(pos, look).multiplyScalar(pull);
      pos.copy(look).add(dir);
    }

    // A gentle idle drift so the instrument breathes even when still.
    if (!prefersReduced) {
      const t = now * 0.001;
      pos.x += Math.sin(t / 5.5) * 0.06;
      pos.y += Math.sin(t / 7.3 + 1.2) * 0.04;
    }

    cam.position.copy(pos);
    cam.lookAt(look);
    requestAnimationFrame(driveCamera);
  }
  requestAnimationFrame(driveCamera);

  // Fade the whole stage layer in as #stage enters and out as it leaves.
  gsap.set(layer, { opacity: stageState.visible });
  if (!prefersReduced) {
    ScrollTrigger.create({
      trigger: '#stage',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const pr = self.progress;
        // trapezoid: ramp in over first 14%, hold, ramp out over last 16%
        let o = 1;
        if (pr < 0.14) o = pr / 0.14;
        else if (pr > 0.84) o = Math.max(0, (1 - pr) / 0.16);
        stageState.visible = o;
        layer.style.opacity = o.toFixed(3);
      },
    });

    // Reverent approach: complete the dolly during the scroll-in.
    ScrollTrigger.create({
      trigger: '#stage',
      start: 'top bottom',
      end: 'top top',
      scrub: 0.8,
      onUpdate: (self) => {
        stageState.approach = self.progress;
      },
    });
  } else {
    layer.style.opacity = '1';
  }

  // A small warm flash of the spotlight + floor glow on each struck note.
  // `color` (from the active piece's PERFORMANCE_PROFILES entry in
  // shared/recital.js) retints the floor glow so each piece leaves a subtly
  // different pool of light at the instrument's base — the spotlight beam
  // itself stays neutral stage-light white/gold, so this reads as "the
  // piece's color" rather than turning the whole stage into a light show.
  function pulse(velocity = 0.6, color) {
    if (prefersReduced) return;
    gsap.killTweensOf(spotlightEl);
    gsap.fromTo(
      spotlightEl,
      { '--pulse': 0.4 + velocity * 0.5 },
      { '--pulse': 0, duration: 0.55, ease: 'power2.out' }
    );
    gsap.fromTo(
      floorGlow,
      { opacity: 0.9 + velocity * 0.3 },
      { opacity: 0.7, duration: 0.6, ease: 'power2.out' }
    );
    if (color !== undefined) {
      // A per-piece constant (from PERFORMANCE_PROFILES), so a direct set is
      // fine here — CSS custom properties holding an "r, g, b" triplet can't
      // be smoothly cross-faded via a plain GSAP/CSS transition anyway (they
      // aren't a registered <color>-typed property), and re-setting the same
      // value on every note is a no-op in practice.
      const c = new THREE.Color(color);
      const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
      floorGlow.style.setProperty('--tint-rgb', rgb);
    }
  }

  initDust(stageState);

  return { piano, layer, pulse };
}

// Dust motes drifting in the beam — only animates while the stage is lit.
function initDust(state) {
  const canvas = document.getElementById('dust');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  const motes = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (motes.length === 0) {
      const count = Math.min(52, Math.round((W * H) / 32000));
      for (let i = 0; i < count; i++) {
        motes.push({
          x: 0.5 + (Math.random() - 0.5) * 0.7,
          y: Math.random(),
          r: 0.4 + Math.random() * 1.4,
          spd: 0.00006 + Math.random() * 0.00012,
          drift: (Math.random() - 0.5) * 0.00008,
          a: 0.1 + Math.random() * 0.5,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    const vis = state.visible;
    if (vis > 0.02) {
      for (const m of motes) {
        if (!prefersReduced) {
          m.y -= m.spd * 16.7;
          m.x += m.drift * 16.7 + Math.sin(now * 0.0004 + m.ph) * 0.0004;
          if (m.y < -0.02) {
            m.y = 1.02;
            m.x = 0.5 + (Math.random() - 0.5) * 0.7;
          }
        }
        const px = m.x * W;
        const py = m.y * H;
        // brighter near the top of the beam, fading toward the floor
        const beam = Math.max(0, 1 - Math.abs(m.x - 0.5) * 2.2) * (1 - m.y * 0.5);
        const alpha = m.a * beam * vis;
        if (alpha <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(px, py, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 236, 200, ${alpha})`;
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------
// 5. Recital player — programme insert card
// ------------------------------------------------------------
function initRecital(stage) {
  const piecesEl = document.getElementById('pieces');
  const statusEl = document.getElementById('insert-status');
  const mediaSlot = document.getElementById('media-slot');
  const playBtn = document.getElementById('play-btn');
  const hintEl = document.getElementById('insert-hint');

  const player = createRecitalPlayer({
    mediaContainer: mediaSlot,
    onNote: (midi, opts = {}) => {
      stage.piano.pressKey(midi, opts);
      stage.pulse(opts.velocity, opts.color);
      // A light extension point: lets other layers (or a test) observe strikes.
      document.dispatchEvent(new CustomEvent('recital:note', { detail: { midi, ...opts } }));
    },
    onStateChange: ({ playing }) => {
      setPlaying(playing);
    },
  });

  let currentSong = null;
  let loading = false;

  function setStatus(text, isLoading = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('is-loading', isLoading);
  }
  function setPlaying(isPlaying) {
    playBtn.textContent = isPlaying ? 'Pause' : 'Play';
    stage.layer.classList.toggle('is-performing', isPlaying);
    if (currentSong) {
      setStatus(
        isPlaying
          ? `Now playing — ${currentSong.title}`
          : `${currentSong.title} — ${currentSong.subtitle}`
      );
    }
  }

  // Build the three selectable pieces from SONGS (never hardcode titles).
  SONGS.forEach((song, i) => {
    const li = document.createElement('li');
    li.className = 'piece';
    li.dataset.songId = song.id;
    li.innerHTML = `
      <button class="piece-btn" type="button">
        <span class="piece-num">${ROMAN[i] || i + 1}</span>
        <span class="piece-meta">
          <span class="piece-title">${song.title}</span>
          <span class="piece-sub">${song.subtitle}</span>
        </span>
      </button>`;
    li.querySelector('.piece-btn').addEventListener('click', () => selectSong(song));
    piecesEl.appendChild(li);
  });

  function markActive(songId) {
    piecesEl.querySelectorAll('.piece').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.songId === songId);
    });
  }

  async function selectSong(song) {
    if (loading || (currentSong && currentSong.id === song.id)) return;
    loading = true;
    currentSong = song;
    markActive(song.id);
    playBtn.disabled = true;
    playBtn.textContent = 'Play';
    stage.layer.classList.remove('is-performing');
    const tuning = song.type === 'local' ? 'Setting the music…' : 'Tuning up…';
    setStatus(`${tuning} — ${song.title}`, true);
    try {
      await player.load(song.id);
      setStatus(`${song.title} — ${song.subtitle}`);
      playBtn.disabled = false;
      wireNativeAudio();
    } catch (err) {
      console.error('[recital] load failed', err);
      setStatus('This piece could not be loaded just now.');
    } finally {
      loading = false;
    }
  }

  // Keep the native <audio> controls (local piece) in sync with our button
  // so the piano reacts however the visitor chooses to press play.
  function wireNativeAudio() {
    const audioEl = mediaSlot.querySelector('audio');
    if (!audioEl) return;
    audioEl.addEventListener('play', () => {
      if (!player.isPlaying) player.play();
    });
    audioEl.addEventListener('pause', () => {
      if (player.isPlaying) player.pause();
    });
  }

  playBtn.addEventListener('click', () => {
    if (!currentSong || loading) return;
    if (player.isPlaying) player.pause();
    else player.play();
  });

  // Preload the first piece (the local recording — instant, no network)
  // so the programme opens ready to play.
  selectSong(SONGS[0]);

  return { player };
}

// ------------------------------------------------------------
// 6. Curtain entrance + reveals
// ------------------------------------------------------------
function initEntrance(stage) {
  const curtain = document.getElementById('curtain');
  const houselights = document.getElementById('houselights');
  const hero = document.querySelector('.hero');
  const left = curtain.querySelector('.curtain-left');
  const right = curtain.querySelector('.curtain-right');
  const valance = curtain.querySelector('.curtain-valance');
  const heroBits = gsap.utils.toArray('[data-hero]');
  const wordmark = document.querySelector('[data-wordmark]');
  const chromeNote = document.querySelector('.chrome-note');

  function showChrome() {
    ScrollTrigger.create({
      trigger: '#stage',
      start: 'top 80%',
      onEnter: () => {
        wordmark.classList.add('is-visible');
        chromeNote.classList.add('is-visible');
      },
      onLeaveBack: () => {
        wordmark.classList.remove('is-visible');
        chromeNote.classList.remove('is-visible');
      },
    });
  }

  if (prefersReduced) {
    // No parting animation — open the curtain instantly, no flashing.
    gsap.set([left], { xPercent: -100 });
    gsap.set([right], { xPercent: 100 });
    gsap.set(valance, { yPercent: -100 });
    gsap.set(curtain, { autoAlpha: 0 });
    gsap.set(houselights, { opacity: 0 });
    gsap.set(heroBits, { opacity: 1, y: 0, filter: 'none' });
    showChrome();
    return;
  }

  gsap.set(heroBits, { opacity: 0, y: 26, filter: 'blur(12px)' });

  const tl = gsap.timeline({ delay: 0.35 });
  // a held breath, then the house lights lower and the curtain parts
  tl.to(houselights, { opacity: 0.35, duration: 1.1, ease: 'power1.inOut' }, 0)
    .to(valance, { yPercent: -105, duration: 2.1, ease: 'expo.inOut' }, 0.5)
    .to(left, { xPercent: -100, duration: 2.4, ease: 'expo.inOut' }, 0.5)
    .to(right, { xPercent: 100, duration: 2.4, ease: 'expo.inOut' }, 0.5)
    // The payoff: as the curtain parts, let the lit stage (the 3D piano,
    // still in its FAR/wide "empty stage" framing at this point — the
    // scroll-driven approach/dolly hasn't started yet) show through where
    // the hero would otherwise just be flat black. It recedes again before
    // the hero text fully resolves, so the two "acts" (stage, then name)
    // still read as distinct beats rather than competing for attention.
    .add(() => hero.classList.add('is-revealing'), 0.5)
    .to(stage.layer, { opacity: 0.6, duration: 0.9, ease: 'power2.out' }, 0.5)
    .to(stage.layer, { opacity: 0, duration: 0.9, ease: 'power2.in' }, 1.75)
    .add(() => hero.classList.remove('is-revealing'), 2.65)
    .to(houselights, { opacity: 0, duration: 1.6, ease: 'power1.out' }, 1.4)
    .to(
      heroBits,
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5, ease: 'power2.out', stagger: 0.16 },
      1.2
    )
    .set(curtain, { display: 'none' });

  // Section reveals — quiet, restrained blur-rise
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 34, filter: 'blur(8px)' });
    gsap.to(el, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none none' },
    });
  });

  showChrome();
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
fillContent();
initGrain();
initScroll();
const stage = initStage();
initRecital(stage);
initEntrance(stage);

// Re-measure once fonts/content settle so triggers align to final layout.
window.addEventListener('load', () => ScrollTrigger.refresh());
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
