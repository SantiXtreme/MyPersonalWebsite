// =========================================================================
// Grace Atlas — main.js
// Concept: the whole site is an interactive constellation map of the Lands
// Between. Glowing "grace" waypoints are scattered across a dark starfield;
// clicking one pans/zooms the camera toward it (a "travel" across the map)
// and its content panel rises into view. Navigation is NOT a menu list.
//
// Architecture notes:
//   - Waypoints are HTML buttons at responsive % positions (always usable /
//     tappable on any viewport). The route lines connect them (SVG, traced
//     in with GSAP).
//   - The starfield is a 2D canvas with its own camera (x, y, zoom). On
//     "travel" the camera pans toward the target waypoint's screen point and
//     zooms in — this supplies the sense of motion across the map, decoupled
//     from waypoint layout so it stays robust across viewport sizes.
//   - Everything respects prefers-reduced-motion (checked live so Playwright's
//     emulateMedia toggles take effect).
// =========================================================================

import gsap from 'gsap';
import { person, projects, hobbies, links, pianoIntro } from '../../shared/content.js';
import { buildKeyboard, createPianoVoice, noteNameToMidi } from '../../shared/pianoEngine.js';
import { scheduleLiebestraum } from '../../shared/liebestraum.js';

const reduceMql = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reduceMql.matches;

const graceGlyph = '<svg viewBox="0 0 100 160"><use href="#grace-glyph" /></svg>';

// ---------------------------------------------------------------------------
// Waypoint definitions (positions are % of viewport, per orientation)
// ---------------------------------------------------------------------------
const WAYPOINTS = [
  {
    id: 'about',
    label: 'The First Step',
    sub: 'Origin',
    land: { x: 50, y: 52 },
    port: { x: 50, y: 16 },
  },
  {
    id: 'projects',
    label: 'Untitled Works',
    sub: 'Machine Learning',
    land: { x: 25, y: 30 },
    port: { x: 27, y: 35 },
  },
  {
    id: 'piano',
    label: 'The Resonance',
    sub: 'Piano',
    land: { x: 75, y: 33 },
    port: { x: 73, y: 44 },
  },
  {
    id: 'hobbies',
    label: 'Idle Pursuits',
    sub: 'Hobbies',
    land: { x: 29, y: 74 },
    port: { x: 31, y: 64 },
  },
  {
    id: 'contact',
    label: 'Send Word',
    sub: 'Contact',
    land: { x: 73, y: 72 },
    port: { x: 69, y: 83 },
  },
];

// route pairs (indices into WAYPOINTS) — a star radiating from the First Step
const ROUTES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [3, 4],
];

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const routesSvg = document.getElementById('routes');
const waypointsEl = document.getElementById('waypoints');
const panelsEl = document.getElementById('panels');
const introEl = document.getElementById('intro');
const beginBtn = document.getElementById('begin-btn');
const hintEl = document.getElementById('hint');
const returnBtn = document.getElementById('return-btn');
const announceEl = document.getElementById('announce');

let vw = window.innerWidth;
let vh = window.innerHeight;
let portrait = window.matchMedia('(max-width: 760px)').matches;

function pos(wp) {
  const p = portrait ? wp.port : wp.land;
  return { x: (p.x / 100) * vw, y: (p.y / 100) * vh };
}

// ---------------------------------------------------------------------------
// Camera (drives the starfield only)
// ---------------------------------------------------------------------------
const cam = { x: 0, y: 0, zoom: 1 };
function resetCamCenter() {
  cam.x = vw / 2;
  cam.y = vh / 2;
}

// pointer parallax target (world units), applied subtly to near layers
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

// ---------------------------------------------------------------------------
// Starfield generation
// ---------------------------------------------------------------------------
let stars = [];
let motes = [];
let terrain = [];
let constellations = [];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function generateField() {
  const minX = -0.4 * vw;
  const maxX = 1.4 * vw;
  const minY = -0.4 * vh;
  const maxY = 1.4 * vh;
  const area = (maxX - minX) * (maxY - minY);
  const density = reduced() ? 0.00006 : 0.00012;
  const count = Math.min(520, Math.floor(area * density));

  stars = [];
  for (let i = 0; i < count; i++) {
    // depth: 0 far … 1 near
    const depth = Math.random();
    stars.push({
      x: rand(minX, maxX),
      y: rand(minY, maxY),
      r: rand(0.4, 1.7) * (0.6 + depth * 0.8),
      base: rand(0.15, 0.7) * (0.5 + depth),
      tw: rand(0, Math.PI * 2),
      twSpeed: rand(0.4, 1.4),
      factor: 0.35 + depth * 0.65, // parallax factor (near moves more)
      hue: Math.random() < 0.18 ? 'spirit' : 'star',
    });
  }

  // faint constellation links among the nearest, brightest stars
  constellations = [];
  const bright = stars.filter((s) => s.factor > 0.8 && s.base > 0.4);
  for (let i = 0; i < bright.length; i++) {
    let best = null;
    let bestD = Infinity;
    for (let j = i + 1; j < bright.length; j++) {
      const dx = bright[i].x - bright[j].x;
      const dy = bright[i].y - bright[j].y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = bright[j];
      }
    }
    if (best && bestD < (vw * 0.13) ** 2) {
      constellations.push([bright[i], best]);
    }
  }

  // drifting spirit motes (the blue graveglow motes)
  motes = [];
  const moteCount = reduced() ? 14 : 46;
  for (let i = 0; i < moteCount; i++) {
    motes.push({
      x: rand(minX, maxX),
      y: rand(minY, maxY),
      r: rand(0.8, 2.4),
      vy: rand(4, 14),
      sway: rand(0, Math.PI * 2),
      swayA: rand(6, 22),
      a: rand(0.25, 0.75),
      factor: rand(0.9, 1.15),
    });
  }

  // distant terrain silhouette (a jagged horizon ridge)
  terrain = [];
  const segs = 26;
  const baseY = vh * 0.82;
  let y = baseY;
  for (let i = 0; i <= segs; i++) {
    y += rand(-vh * 0.05, vh * 0.05);
    y = Math.max(vh * 0.7, Math.min(vh * 0.92, y));
    terrain.push({ x: (i / segs) * (maxX - minX) + minX, y });
  }
}

// project a base (pixel-space) point through the camera, with a parallax factor
function project(px, py, factor) {
  const camEffX = vw / 2 + (cam.x - vw / 2) * factor + parallax.x * factor;
  const camEffY = vh / 2 + (cam.y - vh / 2) * factor + parallax.y * factor;
  return {
    x: (px - camEffX) * cam.zoom + vw / 2,
    y: (py - camEffY) * cam.zoom + vh / 2,
  };
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let last = performance.now();
let elapsed = 0;

function render(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  // ease parallax toward target
  const pl = reduced() ? 0 : 0.06;
  parallax.x += (parallax.tx - parallax.x) * pl;
  parallax.y += (parallax.ty - parallax.y) * pl;

  ctx.clearRect(0, 0, vw, vh);

  // distant golden guidance glow (very soft, parallax slow)
  const glow = project(vw * 0.72, vh * 0.16, 0.3);
  const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, vh * 0.6 * cam.zoom);
  g.addColorStop(0, 'rgba(240, 207, 142, 0.10)');
  g.addColorStop(0.5, 'rgba(200, 160, 90, 0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);

  // stars
  const twOn = reduced() ? 0 : 1;
  for (const s of stars) {
    const p = project(s.x, s.y, s.factor);
    if (p.x < -20 || p.x > vw + 20 || p.y < -20 || p.y > vh + 20) continue;
    const tw = s.base * (0.7 + 0.3 * Math.sin(elapsed * s.twSpeed + s.tw) * twOn);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.r * cam.zoom * 0.9, 0, Math.PI * 2);
    ctx.fillStyle =
      s.hue === 'spirit'
        ? `rgba(127, 182, 232, ${tw})`
        : `rgba(232, 226, 205, ${tw})`;
    ctx.fill();
  }

  // constellation links
  ctx.lineWidth = 1;
  for (const [a, b] of constellations) {
    const pa = project(a.x, a.y, a.factor);
    const pb = project(b.x, b.y, b.factor);
    ctx.strokeStyle = 'rgba(200, 180, 130, 0.06)';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // terrain silhouette
  if (terrain.length) {
    ctx.beginPath();
    const first = project(terrain[0].x, terrain[0].y, 0.55);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < terrain.length; i++) {
      const p = project(terrain[i].x, terrain[i].y, 0.55);
      ctx.lineTo(p.x, p.y);
    }
    const rightEnd = project(terrain[terrain.length - 1].x, terrain[terrain.length - 1].y, 0.55);
    const leftEnd = project(terrain[0].x, terrain[0].y, 0.55);
    ctx.lineTo(rightEnd.x, vh + 40);
    ctx.lineTo(leftEnd.x, vh + 40);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, vh * 0.6, 0, vh);
    tg.addColorStop(0, 'rgba(9, 12, 24, 0.5)');
    tg.addColorStop(1, 'rgba(3, 4, 10, 0.95)');
    ctx.fillStyle = tg;
    ctx.fill();
    // faint gold rim on the ridge
    ctx.strokeStyle = 'rgba(240, 207, 142, 0.10)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < terrain.length; i++) {
      const p = project(terrain[i].x, terrain[i].y, 0.55);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // spirit motes
  const moteDrift = reduced() ? 0.15 : 1;
  for (const m of motes) {
    m.y -= m.vy * dt * moteDrift;
    m.sway += dt * 0.6;
    if (m.y < -0.4 * vh) m.y = 1.4 * vh;
    const sx = m.x + Math.sin(m.sway) * m.swayA;
    const p = project(sx, m.y, m.factor);
    if (p.x < -20 || p.x > vw + 20) continue;
    const flick = reduced() ? m.a : m.a * (0.6 + 0.4 * Math.sin(elapsed * 1.6 + m.sway));
    ctx.beginPath();
    ctx.arc(p.x, p.y, m.r * cam.zoom, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(140, 190, 240, ${flick})`;
    ctx.shadowColor = 'rgba(120, 180, 240, 0.9)';
    ctx.shadowBlur = 8 * cam.zoom;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Build waypoints
// ---------------------------------------------------------------------------
const waypointEls = [];
function buildWaypoints() {
  waypointsEl.innerHTML = '';
  waypointEls.length = 0;
  WAYPOINTS.forEach((wp) => {
    const btn = document.createElement('button');
    btn.className = 'waypoint';
    btn.type = 'button';
    btn.dataset.id = wp.id;
    btn.setAttribute('aria-label', `Travel to ${wp.label} — ${wp.sub}`);
    btn.innerHTML = `
      <span class="waypoint__crest">
        <span class="waypoint__halo" aria-hidden="true"></span>
        ${graceGlyph}
      </span>
      <span class="waypoint__label">${wp.label}</span>
      <span class="waypoint__sub">${wp.sub}</span>`;
    btn.addEventListener('click', () => travelTo(wp.id));
    waypointsEl.appendChild(btn);
    waypointEls.push(btn);
  });
  layoutWaypoints();
}

function layoutWaypoints() {
  WAYPOINTS.forEach((wp, i) => {
    const p = pos(wp);
    waypointEls[i].style.left = `${p.x}px`;
    waypointEls[i].style.top = `${p.y}px`;
  });
  layoutRoutes();
}

// ---------------------------------------------------------------------------
// Route lines (SVG) traced between waypoints
// ---------------------------------------------------------------------------
const routeLines = [];
function buildRoutes() {
  routesSvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  routesSvg.innerHTML = '';
  routeLines.length = 0;
  ROUTES.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    routesSvg.appendChild(line);
    routeLines.push({ el: line, a, b });
  });
  layoutRoutes();
}

function layoutRoutes() {
  routesSvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  routeLines.forEach((r) => {
    const pa = pos(WAYPOINTS[r.a]);
    const pb = pos(WAYPOINTS[r.b]);
    r.el.setAttribute('x1', pa.x);
    r.el.setAttribute('y1', pa.y - 8);
    r.el.setAttribute('x2', pb.x);
    r.el.setAttribute('y2', pb.y - 8);
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    r.el.style.strokeDasharray = len;
    if (!routesTraced) r.el.style.strokeDashoffset = len;
    else r.el.style.strokeDashoffset = 0;
  });
}

let routesTraced = false;
function traceRoutes() {
  if (reduced()) {
    routeLines.forEach((r) => (r.el.style.strokeDashoffset = 0));
    routesTraced = true;
    return;
  }
  routeLines.forEach((r, i) => {
    gsap.to(r.el, {
      strokeDashoffset: 0,
      duration: 1.1,
      delay: 0.15 * i,
      ease: 'power2.inOut',
      onComplete: () => {
        if (i === routeLines.length - 1) routesTraced = true;
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Travel (camera pan/zoom) + panel reveal
// ---------------------------------------------------------------------------
let activePanel = null;
let lastTrigger = null;

function travelTo(id) {
  const wp = WAYPOINTS.find((w) => w.id === id);
  const idx = WAYPOINTS.findIndex((w) => w.id === id);
  const target = pos(wp);
  lastTrigger = waypointEls[idx];

  // fade the waypoint layer + routes; highlight the chosen one briefly
  gsap.killTweensOf([cam, waypointsEl, routesSvg]);
  hideHint();

  if (reduced()) {
    // in-place reveal — no theatrics
    cam.x = vw / 2;
    cam.y = vh / 2;
    cam.zoom = 1;
    gsap.set([waypointsEl, routesSvg], { opacity: 0 });
    waypointsEl.style.pointerEvents = 'none';
    openPanel(id, wp);
    return;
  }

  // pan the starfield toward the waypoint & zoom in
  gsap.to(cam, {
    x: target.x,
    y: target.y,
    zoom: 1.9,
    duration: 1.35,
    ease: 'power2.inOut',
  });
  gsap.to([waypointsEl, routesSvg], {
    opacity: 0,
    duration: 0.7,
    ease: 'power2.in',
  });
  waypointsEl.style.pointerEvents = 'none';

  gsap.delayedCall(0.85, () => openPanel(id, wp));
}

function openPanel(id, wp) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel) return;
  if (activePanel) activePanel.classList.remove('is-active');
  activePanel = panel;
  panel.classList.add('is-active');
  panel.scrollTop = 0;
  returnBtn.hidden = false;
  document.body.classList.add('panel-open');
  announceEl.textContent = `Arrived at ${wp.label}. ${wp.sub}.`;
  // move focus to the panel heading for keyboard/AT users
  const focusTarget = panel.querySelector('[data-autofocus]');
  if (focusTarget) {
    requestAnimationFrame(() => focusTarget.focus());
  }
}

function returnToMap() {
  if (!activePanel) return;
  const panelId = activePanel.id.replace('panel-', '');
  if (panelId === 'piano') stopLieb();
  activePanel.classList.remove('is-active');
  activePanel = null;
  returnBtn.hidden = true;
  document.body.classList.remove('panel-open');
  waypointsEl.style.pointerEvents = '';

  const dur = reduced() ? 0 : 1.2;
  gsap.killTweensOf(cam);
  gsap.to(cam, {
    x: vw / 2,
    y: vh / 2,
    zoom: 1,
    duration: dur,
    ease: 'power2.inOut',
  });
  gsap.to([waypointsEl, routesSvg], {
    opacity: 1,
    duration: reduced() ? 0.2 : 0.9,
    ease: 'power2.out',
  });
  showHint();
  announceEl.textContent = 'Returned to the map.';
  if (lastTrigger) lastTrigger.focus();
}

returnBtn.addEventListener('click', returnToMap);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activePanel) returnToMap();
});

// ---------------------------------------------------------------------------
// Hint helpers
// ---------------------------------------------------------------------------
function showHint() {
  hintEl.classList.add('is-visible');
}
function hideHint() {
  hintEl.classList.remove('is-visible');
}

// ---------------------------------------------------------------------------
// Panels — built from shared content
// ---------------------------------------------------------------------------
const divider = `<div class="divider" aria-hidden="true">${graceGlyph}</div>`;

function panelShell(id, eyebrow, title, lead, body) {
  return `
    <section id="panel-${id}" class="panel" role="dialog" aria-modal="false" aria-labelledby="h-${id}">
      <div class="panel__inner">
        <p class="panel__eyebrow">${eyebrow}</p>
        <h2 class="panel__title" id="h-${id}" tabindex="-1" data-autofocus>${title}</h2>
        ${lead ? `<p class="panel__lead">${lead}</p>` : ''}
        ${divider}
        ${body}
      </div>
    </section>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function buildPanels() {
  // About / First Step
  const about = panelShell(
    'about',
    'Origin',
    'The First Step',
    `I'm ${escapeHtml(person.name)}. This atlas gathers the works I build and the
     music I play into one dark, wandering map. There is no menu here — only
     graces. Follow the routes, and travel where you like.`,
    `<div class="cards">
        <div class="card"><h3 class="card__title">Untitled Works</h3><p class="card__desc">Studies in machine learning — a place of models and experiments.</p></div>
        <div class="card"><h3 class="card__title">The Resonance</h3><p class="card__desc">A real, playable piano. Strike a key, or let the Liebestraum play.</p></div>
        <div class="card"><h3 class="card__title">Idle Pursuits &amp; Send Word</h3><p class="card__desc">The hobbies that fill the hours, and the ways to reach me.</p></div>
     </div>`
  );

  // Projects
  const projectCards = projects
    .map(
      (p) => `
      <article class="card">
        <h3 class="card__title">${escapeHtml(p.title)}</h3>
        <p class="card__desc">${escapeHtml(p.description)}</p>
        <div class="card__tags">${p.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <a class="card__link" href="${escapeHtml(p.url)}">Enter →</a>
      </article>`
    )
    .join('');
  const projectsPanel = panelShell(
    'projects',
    'Machine Learning',
    'Untitled Works',
    'Sites of study, marked but not yet named. Each grace below will hold a project once its story is written.',
    `<div class="cards">${projectCards}</div>`
  );

  // Piano
  const pianoPanel = panelShell(
    'piano',
    'Piano',
    'The Resonance',
    escapeHtml(pianoIntro),
    `<div class="piano-wrap">
        <div class="piano-controls">
          <button id="lieb-btn" class="link-btn" type="button">Play &ldquo;Liebestraum&rdquo; excerpt</button>
          <span class="hint-inline">Click, tap or use your keyboard to play the keys.</span>
        </div>
        <div class="keyboard-scroll">
          <div id="keyboard" class="keyboard" role="group" aria-label="Playable piano keyboard"></div>
        </div>
     </div>`
  );

  // Hobbies
  const hobbyCards = hobbies
    .map(
      (h) => `
      <article class="card">
        <h3 class="card__title">${escapeHtml(h.title)}</h3>
        <p class="card__desc">${escapeHtml(h.description)}</p>
      </article>`
    )
    .join('');
  const hobbiesPanel = panelShell(
    'hobbies',
    'Hobbies',
    'Idle Pursuits',
    'What fills the hours between the works and the music.',
    `<div class="cards">${hobbyCards}</div>`
  );

  // Contact
  const contactRows = `
    <a class="contact-row" href="${escapeHtml(links.github.url)}" target="_blank" rel="noopener noreferrer">
      <span class="contact-row__label">GitHub</span>
      <span class="contact-row__value">${escapeHtml(links.github.handle)}</span>
    </a>
    <a class="contact-row" href="${escapeHtml(links.instagram.url)}" target="_blank" rel="noopener noreferrer">
      <span class="contact-row__label">Instagram</span>
      <span class="contact-row__value">${escapeHtml(links.instagram.handle)}</span>
    </a>
    <a class="contact-row" href="mailto:${escapeHtml(links.email.address)}">
      <span class="contact-row__label">Email</span>
      <span class="contact-row__value">${escapeHtml(links.email.address)}</span>
    </a>`;
  const contactPanel = panelShell(
    'contact',
    'Contact',
    'Send Word',
    'A grace at the edge of the map. Send word by any of these paths.',
    `<div class="contact-list">${contactRows}</div>`
  );

  panelsEl.innerHTML =
    about + projectsPanel + pianoPanel + hobbiesPanel + contactPanel;
}

// ---------------------------------------------------------------------------
// Piano
// ---------------------------------------------------------------------------
let voice = null;
function getVoice() {
  if (!voice) voice = createPianoVoice();
  return voice;
}

const keyByMidi = new Map();
function buildPiano() {
  const kb = document.getElementById('keyboard');
  const { whites, blacks } = buildKeyboard('C4', 'C6');

  const whiteWrap = document.createElement('div');
  whiteWrap.className = 'keys-white';
  whites.forEach((w) => {
    const key = document.createElement('button');
    key.className = 'key-white';
    key.type = 'button';
    key.dataset.midi = w.midi;
    key.setAttribute('aria-label', `Piano key ${w.note}`);
    whiteWrap.appendChild(key);
    keyByMidi.set(w.midi, key);
  });

  const blackWrap = document.createElement('div');
  blackWrap.className = 'keys-black';
  blacks.forEach((b) => {
    const key = document.createElement('button');
    key.className = 'key-black';
    key.type = 'button';
    key.dataset.midi = b.midi;
    key.setAttribute('aria-label', `Piano key ${b.note}`);
    // position over the gap after its white key
    key.style.left = `${((b.afterWhiteIndex + 1) / whites.length) * 100}%`;
    blackWrap.appendChild(key);
    keyByMidi.set(b.midi, key);
  });

  kb.appendChild(whiteWrap);
  kb.appendChild(blackWrap);

  // pointerdown handles mouse / touch / pen; keydown handles Enter/Space
  kb.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('[data-midi]');
    if (!key) return;
    e.preventDefault();
    playMidi(parseInt(key.dataset.midi, 10));
  });
  kb.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const key = e.target.closest('[data-midi]');
    if (!key) return;
    e.preventDefault();
    playMidi(parseInt(key.dataset.midi, 10));
  });

  // computer-keyboard mapping (a home row-ish layout starting at C4)
  const KEYMAP = {
    a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67,
    y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76,
  };
  window.addEventListener('keydown', (e) => {
    if (activePanel?.id !== 'panel-piano') return;
    if (e.repeat) return;
    const midi = KEYMAP[e.key.toLowerCase()];
    if (midi != null) {
      e.preventDefault();
      playMidi(midi);
    }
  });
}

function playMidi(midi) {
  getVoice().play(midi, { isMidi: true, velocity: 0.9 });
  flashKey(midi);
}

function flashKey(midi) {
  const key = keyByMidi.get(midi);
  if (!key) return;
  key.classList.add('is-active');
  setTimeout(() => key.classList.remove('is-active'), 230);
}

// Liebestraum excerpt
let lieb = null;
function stopLieb() {
  if (lieb) {
    lieb.ctrl.stop();
    if (lieb.timeout) clearTimeout(lieb.timeout);
    const btn = document.getElementById('lieb-btn');
    if (btn) btn.innerHTML = 'Play &ldquo;Liebestraum&rdquo; excerpt';
    lieb = null;
  }
}
function toggleLieb() {
  const btn = document.getElementById('lieb-btn');
  if (lieb) {
    stopLieb();
    return;
  }
  const v = getVoice();
  const ctrl = scheduleLiebestraum({
    onNote: (note, opts) => {
      const midi = noteNameToMidi(note);
      v.play(midi, { isMidi: true, sustain: opts?.sustain });
      flashKey(midi);
    },
    eighthMs: 240,
  });
  const timeout = setTimeout(() => stopLieb(), ctrl.totalMs);
  lieb = { ctrl, timeout };
  btn.textContent = 'Stop';
}

// ---------------------------------------------------------------------------
// Pointer parallax (motion-safe)
// ---------------------------------------------------------------------------
window.addEventListener('pointermove', (e) => {
  if (reduced() || activePanel) {
    parallax.tx = 0;
    parallax.ty = 0;
    return;
  }
  const nx = (e.clientX / vw - 0.5) * 2;
  const ny = (e.clientY / vh - 0.5) * 2;
  parallax.tx = nx * 26;
  parallax.ty = ny * 20;
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(vw * dpr);
  canvas.height = Math.floor(vh * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let resizeTimer = null;
function onResize() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  portrait = window.matchMedia('(max-width: 760px)').matches;
  sizeCanvas();
  if (!activePanel) resetCamCenter();
  layoutWaypoints();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => generateField(), 180);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Intro / begin
// ---------------------------------------------------------------------------
let started = false;
function begin() {
  if (started) return;
  started = true;
  // resume audio on this gesture (first key press will also resume)
  try {
    getVoice();
  } catch (_) {
    /* AudioContext may need a later gesture; keys still work */
  }
  introEl.classList.add('is-hidden');

  if (reduced()) {
    routeLines.forEach((r) => (r.el.style.strokeDashoffset = 0));
    routesTraced = true;
    showHint();
    return;
  }

  // waypoints fade/rise in with a stagger; routes trace
  gsap.from(waypointEls, {
    opacity: 0,
    y: 26,
    duration: 1.1,
    stagger: 0.12,
    ease: 'power2.out',
    delay: 0.2,
  });
  traceRoutes();
  gsap.delayedCall(1.1, showHint);
}
beginBtn.addEventListener('click', begin);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function init() {
  resetCamCenter();
  sizeCanvas();
  generateField();
  buildWaypoints();
  buildRoutes();
  buildPanels();
  buildPiano();
  document.getElementById('lieb-btn')?.addEventListener('click', toggleLieb);

  // keep prefers-reduced-motion responsive to live changes
  reduceMql.addEventListener?.('change', () => {
    generateField();
  });

  requestAnimationFrame((t) => {
    last = t;
    render(t);
  });
}

init();
