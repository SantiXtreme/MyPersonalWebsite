// Small, always-loaded (not lazy) so a returning visitor's chosen flask
// theme applies before first paint. The Adjust Flasks panel (a lazy section
// module) reuses these same functions rather than duplicating the logic.
const STORAGE_KEY = 'santiagoGrace.flaskTheme';

export const FLASK_COLORS = {
  gold: '#c9a86a',
  crimson: '#b8402e',
  cerulean: '#3d80b3',
  verdant: '#4e9349',
};

export function getCurrentFlask() {
  return document.documentElement.getAttribute('data-flask') || 'gold';
}

export function applyFlaskTheme(id) {
  if (id === 'gold') {
    document.documentElement.removeAttribute('data-flask');
  } else {
    document.documentElement.setAttribute('data-flask', id);
  }
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent('santiago:flask-changed', { detail: { id } }));
}

export function initFlaskTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved !== 'gold') {
    document.documentElement.setAttribute('data-flask', saved);
  }
}
