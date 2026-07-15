import { links, instagramChannel } from '../../data/content.js';
import { iconMarkup } from '../icons.js';

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Cross Over</span>
      <h2>Instagram Channel</h2>
      <p class="panel-summary">Cross over to the visual side of the story.</p>
    </header>
    <div class="card instagram-card">
      <div class="medallion">${iconMarkup('instagram')}</div>
      <span class="instagram-handle">${links.instagram.handle}</span>
      <p>${instagramChannel.blurb}</p>
      <a class="rune-button" href="${links.instagram.url}" target="_blank" rel="noopener noreferrer">
        ${iconMarkup('instagram')} Open Instagram
      </a>
    </div>
  `;
}
