import { links } from '../../data/content.js';
import { iconMarkup } from '../icons.js';

export function render(container) {
  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Summon Sign</span>
      <h2>Contacts</h2>
      <p class="panel-summary">Send a summon sign — GitHub, Instagram, or a plain email.</p>
    </header>
    <div class="contact-grid">
      <a class="contact-link" href="${links.github.url}" target="_blank" rel="noopener noreferrer">
        <div class="medallion">${iconMarkup('github')}</div>
        <span class="contact-text">
          <span class="label">GitHub</span>
          <span class="value">${links.github.handle}</span>
        </span>
      </a>
      <a class="contact-link" href="${links.instagram.url}" target="_blank" rel="noopener noreferrer">
        <div class="medallion">${iconMarkup('instagram')}</div>
        <span class="contact-text">
          <span class="label">Instagram</span>
          <span class="value">${links.instagram.handle}</span>
        </span>
      </a>
      <a class="contact-link" href="mailto:${links.email.address}">
        <div class="medallion">${iconMarkup('mail')}</div>
        <span class="contact-text">
          <span class="label">Email</span>
          <span class="value">${links.email.address}</span>
        </span>
      </a>
    </div>
  `;
}
