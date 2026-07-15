const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export const motionPrefs = {
  get reduced() {
    return query.matches;
  },
  onChange(callback) {
    const handler = (e) => callback(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  },
};
