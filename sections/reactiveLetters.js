// The hero's cursor reactivity: a soft blurred "cloud" follows the pointer
// with a light elastic lag, and any registered letter it drifts over lights
// up (color shift + glow) via a `.lit` class — proximity-checked per
// character span, not a blend-mode trick, so it works identically whatever
// sits behind it. Reused by the ending section per the user's request to
// keep "Let's make something move" pixel-identical except for its cursor
// reactivity, which should be this same mechanism instead of the old
// grace-sigil gather effect.
//
// Usage:
//   const cloud = createReactiveCloud();
//   cloud.mount(document.body);
//   cloud.registerLetters(charSpans);   // e.g. from splitChars()
//   cloud.setActive(true);
//   cloud.updatePointer(x, y);

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RADIUS = 130;

export function createReactiveCloud() {
  const el = document.createElement('div');
  el.className = 'reactive-cloud';
  el.setAttribute('aria-hidden', 'true');

  let active = false;
  let letters = [];
  const moveX = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
  const moveY = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

  function mount(parent) {
    parent.appendChild(el);
  }

  function registerLetters(spans) {
    letters = spans;
  }

  function updatePointer(x, y) {
    if (!active) return;
    moveX(x);
    moveY(y);
    if (REDUCED) return;
    for (const span of letters) {
      const r = span.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      span.classList.toggle('lit', d < RADIUS);
    }
  }

  function setActive(v) {
    active = v;
    gsap.to(el, { opacity: v ? 1 : 0, duration: 0.4, ease: 'power2.out' });
    if (!v) letters.forEach((s) => s.classList.remove('lit'));
  }

  return { mount, registerLetters, updatePointer, setActive, el };
}
