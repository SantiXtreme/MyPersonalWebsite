import { motionPrefs } from './motionPrefs.js';

/**
 * Subtle pointer-parallax on the distant mountain silhouette. Only the
 * mountains move — the tree groups rely on an SVG `transform="translate(...)"`
 * attribute for their base position, and setting an inline CSS transform on
 * them would replace (not add to) that attribute, snapping them out of place.
 */
export function initSceneParallax() {
  if (motionPrefs.reduced) return () => {};

  const mountains = document.querySelector('.mountains');
  if (!mountains) return () => {};

  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let raf = null;

  function handlePointerMove(e) {
    targetX = e.clientX / window.innerWidth - 0.5;
    targetY = e.clientY / window.innerHeight - 0.5;
  }
  window.addEventListener('pointermove', handlePointerMove);

  function tick() {
    curX += (targetX - curX) * 0.045;
    curY += (targetY - curY) * 0.045;
    mountains.style.transform = `translate3d(${curX * -6}px, ${curY * -3}px, 0)`;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    window.removeEventListener('pointermove', handlePointerMove);
    if (raf) cancelAnimationFrame(raf);
  };
}
