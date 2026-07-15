// Always-loaded (not lazy) so a returning visitor's chosen time of day
// applies before first paint — same pattern as flaskTheme.js.
const STORAGE_KEY = 'santiagoGrace.timeOfDay';

export function getCurrentTime() {
  return document.documentElement.getAttribute('data-time') || 'afternoon';
}

export function applyTimeOfDay(id) {
  if (id === 'afternoon') {
    document.documentElement.removeAttribute('data-time');
  } else {
    document.documentElement.setAttribute('data-time', id);
  }
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent('santiago:time-changed', { detail: { id } }));
}

export function initTimeOfDay() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved !== 'afternoon') {
    document.documentElement.setAttribute('data-time', saved);
  }
}
