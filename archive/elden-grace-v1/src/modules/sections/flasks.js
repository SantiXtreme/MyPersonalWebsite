import { flaskThemes } from '../../data/content.js';
import { FLASK_COLORS, getCurrentFlask, applyFlaskTheme } from '../flaskTheme.js';

function vialMarkup(color) {
  return `<svg viewBox="0 0 24 24" class="flask-vial" aria-hidden="true">
    <path d="M10 3H14M11 3V9L6.5 18A3 3 0 0 0 9.2 21.5H14.8A3 3 0 0 0 17.5 18L13 9V3" stroke="var(--stone-300)" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M8 16.2A5 5 0 0 0 16 16.2L13 9H11Z" fill="${color}"/>
  </svg>`;
}

let activeCleanup = null;

export function render(container) {
  const current = getCurrentFlask();

  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Mix Wondrous Physick</span>
      <h2>Adjust Flasks</h2>
      <p class="panel-summary">Choose a different accent for the whole page. It remembers your taste.</p>
    </header>
    <div class="flask-grid">
      ${flaskThemes
        .map(
          (f) => `
        <button type="button" class="flask-option ${f.id === current ? 'is-active' : ''}" data-flask-id="${f.id}">
          ${vialMarkup(FLASK_COLORS[f.id])}
          <span class="flask-label">${f.label}</span>
          <span class="flask-desc">${f.description}</span>
        </button>`,
        )
        .join('')}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll('.flask-option'));
  function handleClick(e) {
    const btn = e.currentTarget;
    applyFlaskTheme(btn.dataset.flaskId);
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
