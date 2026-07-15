import gsap from 'gsap';
import { levelupStats } from '../../data/content.js';
import {
  getRunes,
  getStatPoints,
  getTotalLevel,
  meditate,
  increaseStat,
  decreaseStat,
  resetProgress,
  STAT_MAX_POINTS,
  POINT_COST_RUNES,
} from '../levelupState.js';
import { motionPrefs } from '../motionPrefs.js';

let activeCleanup = null;
let flashEl = null;
let toastEl = null;

function ensureFxElements() {
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.className = 'levelup-flash';
    document.body.appendChild(flashEl);
  }
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'levelup-toast';
    document.body.appendChild(toastEl);
  }
}

function flashLevelUp(label) {
  ensureFxElements();
  toastEl.textContent = `${label} +1`;
  window.dispatchEvent(new CustomEvent('santiago:leveled-up', { detail: { label } }));

  if (motionPrefs.reduced) {
    gsap.set(toastEl, { opacity: 1 });
    setTimeout(() => gsap.set(toastEl, { opacity: 0 }), 700);
    return;
  }
  gsap
    .timeline()
    .set(toastEl, { opacity: 0, y: -8 })
    .to(flashEl, { opacity: 1, duration: 0.08 }, 0)
    .to(flashEl, { opacity: 0, duration: 0.6 }, 0.06)
    .to(toastEl, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0)
    .to(toastEl, { opacity: 0, duration: 0.5 }, '+=0.9');
}

function statRowMarkup(stat) {
  const points = getStatPoints(stat.id);
  const pct = (points / STAT_MAX_POINTS) * 100;
  return `
    <div class="stat-row" data-stat-id="${stat.id}">
      <span class="stat-name">${stat.label}</span>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <div class="stat-controls">
        <button type="button" class="stat-btn" data-action="dec" ${points <= 0 ? 'disabled' : ''} aria-label="Decrease ${stat.label}">&minus;</button>
        <span class="stat-points">${points}</span>
        <button type="button" class="stat-btn" data-action="inc" ${points >= STAT_MAX_POINTS ? 'disabled' : ''} aria-label="Increase ${stat.label}">+</button>
      </div>
      <span class="stat-flavor">${stat.flavor}</span>
    </div>`;
}

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Rest And Reflect</span>
      <h2>Level Up</h2>
      <p class="panel-summary">Spend runes on entirely fictional stats — ${POINT_COST_RUNES} runes a point, half back on regret.</p>
    </header>
    <div class="levelup-summary">
      <span class="levelup-runes"><strong id="levelup-runes-value">${getRunes()}</strong>Runes &middot; Level <strong id="levelup-level-value">${getTotalLevel()}</strong></span>
      <button type="button" class="rune-button" id="meditate-btn">Meditate (+Runes)</button>
    </div>
    <div class="stat-list">
      ${levelupStats.map(statRowMarkup).join('')}
    </div>
    <div class="levelup-reset">
      <button type="button" class="rune-button-ghost" id="reset-btn">Reset to Level 1</button>
    </div>
  `;

  const statListEl = container.querySelector('.stat-list');
  const meditateBtn = container.querySelector('#meditate-btn');
  const resetBtn = container.querySelector('#reset-btn');
  const runesValueEl = container.querySelector('#levelup-runes-value');
  const levelValueEl = container.querySelector('#levelup-level-value');

  function refreshSummary() {
    runesValueEl.textContent = getRunes();
    levelValueEl.textContent = getTotalLevel();
  }

  function refreshStatRow(id) {
    const row = statListEl.querySelector(`[data-stat-id="${id}"]`);
    const stat = levelupStats.find((s) => s.id === id);
    if (row && stat) row.outerHTML = statRowMarkup(stat);
  }

  function handleStatClick(e) {
    const btn = e.target.closest('.stat-btn');
    if (!btn) return;
    const row = btn.closest('.stat-row');
    const id = row.dataset.statId;
    const stat = levelupStats.find((s) => s.id === id);
    const action = btn.dataset.action;
    const changed = action === 'inc' ? increaseStat(id) : decreaseStat(id);
    if (!changed) return;
    refreshStatRow(id);
    refreshSummary();
    if (action === 'inc') flashLevelUp(stat.label);
  }

  let meditateCooldown = false;
  function handleMeditate() {
    if (meditateCooldown) return;
    meditateCooldown = true;
    meditate();
    refreshSummary();
    setTimeout(() => {
      meditateCooldown = false;
    }, 700);
  }

  function handleReset() {
    resetProgress();
    levelupStats.forEach((s) => refreshStatRow(s.id));
    refreshSummary();
  }

  statListEl.addEventListener('click', handleStatClick);
  meditateBtn.addEventListener('click', handleMeditate);
  resetBtn.addEventListener('click', handleReset);

  activeCleanup = () => {
    statListEl.removeEventListener('click', handleStatClick);
    meditateBtn.removeEventListener('click', handleMeditate);
    resetBtn.removeEventListener('click', handleReset);
  };
}

export function cleanup() {
  activeCleanup?.();
  activeCleanup = null;
}
