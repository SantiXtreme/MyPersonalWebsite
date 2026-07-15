import { projects, links } from '../../data/content.js';
import { iconMarkup } from '../icons.js';

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Great Runes</span>
      <h2>ML Projects</h2>
      <p class="panel-summary">Models, experiments, and things that (mostly) trained successfully.</p>
      <a class="rune-button-ghost projects-github-link" href="${links.github.url}" target="_blank" rel="noopener noreferrer">
        ${iconMarkup('github')} See all on GitHub
      </a>
    </header>
    <div class="projects-grid">
      ${projects
        .map(
          (p) => `
        <article class="card project-card">
          <div class="medallion">${iconMarkup('projects')}</div>
          <h3>${p.title}</h3>
          <p>${p.description}</p>
          <div class="tag-row">${p.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
          <div class="project-links">
            ${p.links.map((l) => `<a class="rune-button-ghost" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join('')}
          </div>
        </article>`,
        )
        .join('')}
    </div>
  `;
}
