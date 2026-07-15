import gsap from 'gsap';

import './style/tokens.css';
import './style/base.css';
import './style/scene.css';
import './style/intro.css';
import './style/menu.css';
import './style/panel.css';
import './style/sections.css';
import './style/responsive.css';

import { graceMenu, graceName, loadingTips } from './data/content.js';
import { initFlaskTheme } from './modules/flaskTheme.js';
import { initTimeOfDay } from './modules/timeOfDay.js';
import { getRunes } from './modules/levelupState.js';
import { createEmberField } from './modules/particles.js';
import { initSceneParallax } from './modules/scene.js';
import { mountGraceSymbol } from './modules/graceSymbol.js';
import { mountFigure } from './modules/figure.js';
import { playIntroSequence } from './modules/intro.js';
import { createGraceMenu } from './modules/menu.js';
import { createPanelRouter } from './modules/panels.js';
import { initAudio } from './modules/audio.js';

async function boot() {
  // Apply any saved flask theme / time of day before anything else is visible.
  initFlaskTheme();
  initTimeOfDay();

  const tipEl = document.getElementById('loading-tip');
  tipEl.textContent = loadingTips[Math.floor(Math.random() * loadingTips.length)];

  const minDelay = new Promise((resolve) => setTimeout(resolve, 900));
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  // Mount everything now, while the loading veil still covers the stage.
  const emberField = createEmberField(document.getElementById('ember-canvas'));
  emberField.start();
  initSceneParallax();

  const graceSymbol = mountGraceSymbol(document.getElementById('grace-symbol'));
  const figure = mountFigure(document.querySelector('.figure'));

  function updateEmberEmitter() {
    const plot = document.querySelector('.grace-plot');
    if (!plot) return;
    const rect = plot.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.bottom - rect.height * 0.12) / window.innerHeight;
    emberField.setEmitter(Math.min(Math.max(x, 0), 1), Math.min(Math.max(y, 0), 1));
  }
  window.addEventListener('resize', updateEmberEmitter);

  const runeCountEl = document.getElementById('rune-count');
  runeCountEl.textContent = String(getRunes());
  window.addEventListener('santiago:runes-changed', (e) => {
    runeCountEl.textContent = String(e.detail.runes);
  });
  window.addEventListener('santiago:flask-changed', () => graceSymbol.flare());
  window.addEventListener('santiago:time-changed', () => graceSymbol.flare());
  window.addEventListener('santiago:leveled-up', () => graceSymbol.flare());

  initAudio(document.getElementById('audio-toggle'));

  let lastSelectedId = graceMenu[0]?.id;

  // The corner nameplate reads "Santiago" — the same word the grace menu's
  // own header shows. Left visible while the menu/a panel is open, the two
  // labels sit right on top of each other, so hide it whenever either is up.
  const nameplateEl = document.getElementById('nameplate');
  function syncNameplate() {
    const hide = menu.isOpen() || panelRouter.isOpen();
    gsap.to(nameplateEl, { opacity: hide ? 0 : 1, duration: 0.25, overwrite: true });
    nameplateEl.style.pointerEvents = hide ? 'none' : '';
    nameplateEl.inert = hide;
  }

  const menu = createGraceMenu({
    items: graceMenu,
    title: graceName,
    onSelect: (id) => {
      lastSelectedId = id;
      menu.close();
      panelRouter.open(id);
      syncNameplate();
    },
    onLeave: () => {
      menu.close();
      syncNameplate();
    },
  });

  const panelRouter = createPanelRouter({
    onBack: () => {
      panelRouter.close();
      menu.open(lastSelectedId);
      syncNameplate();
    },
  });

  function openGraceMenu() {
    if (menu.isOpen() || panelRouter.isOpen()) return;
    graceSymbol.flare();
    menu.open(lastSelectedId);
    syncNameplate();
  }

  document.getElementById('rest-prompt').addEventListener('click', openGraceMenu);
  nameplateEl.addEventListener('click', () => {
    if (panelRouter.isOpen()) panelRouter.close();
    else if (menu.isOpen()) menu.close();
    else openGraceMenu();
    syncNameplate();
  });

  await Promise.all([minDelay, fontsReady]);

  document.getElementById('loading-screen').classList.add('is-hidden');
  updateEmberEmitter();
  playIntroSequence({ graceSymbol, figure });
}

boot();
