import { timesOfDay } from '../../data/content.js';
import { getCurrentTime, applyTimeOfDay } from '../timeOfDay.js';

const SUN_Y = { morning: 15, afternoon: 4, evening: 14 };

function sunMarkup(id) {
  const y = SUN_Y[id];
  return `<svg viewBox="0 0 24 24" class="flask-vial" aria-hidden="true">
    <path d="M2 17h20" stroke="var(--stone-300)" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="12" cy="${y}" r="5" fill="var(--accent-300)"/>
  </svg>`;
}

let activeCleanup = null;

export function render(container) {
  const current = getCurrentTime();

  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Pass Time</span>
      <h2>Pass Time</h2>
      <p class="panel-summary">Let the light shift — morning, afternoon, or evening over the grass.</p>
    </header>
    <div class="flask-grid">
      ${timesOfDay
        .map(
          (t) => `
        <button type="button" class="flask-option ${t.id === current ? 'is-active' : ''}" data-time-id="${t.id}">
          ${sunMarkup(t.id)}
          <span class="flask-label">${t.label}</span>
          <span class="flask-desc">${t.description}</span>
        </button>`,
        )
        .join('')}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll('.flask-option'));
  function handleClick(e) {
    const btn = e.currentTarget;
    applyTimeOfDay(btn.dataset.timeId);
    buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
  }
  buttons.forEach((b) => b.addEventListener('click', handleClick));

  activeCleanup = () => {
    buttons.forEach((b) => b.removeEventListener('click', handleClick));
  };
}

export function cleanup() {
  activeCleanup?.();
  activeCleanup = null;
}
