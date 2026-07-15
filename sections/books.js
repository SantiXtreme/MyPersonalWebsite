// Reading hero — a small shelf of books drops in from above and settles
// into place, spines catching a warm rim-light. DOM + GSAP (a handful of
// rectangles with gradient "spines"), not canvas/WebGL — this is a one-shot
// settle-in, not a continuous simulation, so the simplest tool wins.
//
// Usage:
//   const shelf = createBookDrop(containerEl, books); // books from content.js
//   shelf.play();     // scrolled into view — drops + settles once
//   shelf.dispose();

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SPINE_COLORS = [
  ['#8a5a3a', '#5c3a22'],
  ['#3a5a6a', '#20323c'],
  ['#6a3a4a', '#3c2028'],
  ['#5a6a3a', '#323c20'],
  ['#7a6a3a', '#4a3f20'],
];

export function createBookDrop(container, books = []) {
  const shelf = document.createElement('div');
  shelf.className = 'book-shelf';
  container.appendChild(shelf);

  const items = books.map((b, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'book-item';
    const [c1, c2] = SPINE_COLORS[i % SPINE_COLORS.length];
    wrap.style.setProperty('--spine-a', c1);
    wrap.style.setProperty('--spine-b', c2);
    wrap.innerHTML = `
      <div class="book-spine">
        <span class="book-title">${b.title}</span>
      </div>
      <p class="book-author">${b.author}</p>`;
    shelf.appendChild(wrap);
    return wrap;
  });

  let played = false;

  function play() {
    if (played) return;
    played = true;
    if (REDUCED) {
      gsap.set(items, { y: 0, opacity: 1, rotate: 0 });
      return;
    }
    gsap.set(items, { y: -220, opacity: 0, rotate: () => gsap.utils.random(-14, 14) });
    gsap.to(items, {
      y: 0,
      opacity: 1,
      rotate: 0,
      duration: 1.1,
      ease: 'bounce.out',
      stagger: 0.14,
    });
  }

  return {
    play,
    dispose() {
      shelf.remove();
    },
  };
}
