import { hobbies } from '../../data/content.js';
import { iconMarkup } from '../icons.js';

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Pass Time</span>
      <h2>Hobbies</h2>
      <p class="panel-summary">What fills the time between builds and boss fights.</p>
    </header>
    <div class="hobbies-grid">
      ${hobbies
        .map(
          (h) => `
        <article class="card hobby-card">
          <div class="medallion">${iconMarkup('hobbies')}</div>
          <div class="hobby-text">
            <h3>${h.title}</h3>
            <p>${h.description}</p>
          </div>
        </article>`,
        )
        .join('')}
    </div>
  `;
}
