import { arsenal } from '../../data/content.js';
import { iconMarkup } from '../icons.js';

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Ashes of War</span>
      <h2>Arsenal</h2>
      <p class="panel-summary">The tools and languages currently in rotation.</p>
    </header>
    <div class="hobbies-grid">
      ${arsenal
        .map(
          (a) => `
        <article class="card hobby-card">
          <div class="medallion">${iconMarkup('arsenal')}</div>
          <div class="hobby-text">
            <h3>${a.name}</h3>
            <p>${a.category}</p>
          </div>
        </article>`,
        )
        .join('')}
    </div>
  `;
}
