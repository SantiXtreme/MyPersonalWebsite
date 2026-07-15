// Always-loaded (not lazy) so the HUD rune counter reflects saved progress
// immediately on load. The Level Up panel (a lazy section module) reuses
// these functions rather than duplicating the persistence logic.
const STORAGE_KEY = 'santiagoGrace.levelup';

export const STAT_MAX_POINTS = 10;
export const POINT_COST_RUNES = 8;
const REFUND_RUNES = 4;
const STARTING_RUNES = 20;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupted save, fall through to defaults */
  }
  return { runes: STARTING_RUNES, stats: {} };
}

let state = loadState();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('santiago:runes-changed', { detail: { runes: state.runes } }));
}

export function getRunes() {
  return state.runes;
}

export function getStatPoints(id) {
  return state.stats[id] || 0;
}

export function getTotalLevel() {
  return 1 + Object.values(state.stats).reduce((sum, v) => sum + v, 0);
}

export function meditate() {
  const gained = 4 + Math.floor(Math.random() * 6);
  state.runes += gained;
  persist();
  return gained;
}

export function increaseStat(id) {
  const current = state.stats[id] || 0;
  if (current >= STAT_MAX_POINTS || state.runes < POINT_COST_RUNES) return false;
  state.runes -= POINT_COST_RUNES;
  state.stats[id] = current + 1;
  persist();
  return true;
}

export function decreaseStat(id) {
  const current = state.stats[id] || 0;
  if (current <= 0) return false;
  state.stats[id] = current - 1;
  state.runes += REFUND_RUNES;
  persist();
  return true;
}

export function resetProgress() {
  state = { runes: STARTING_RUNES, stats: {} };
  persist();
}
