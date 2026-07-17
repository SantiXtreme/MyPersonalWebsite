// Recital background reaction — replaces an earlier attempt at a literal
// visible spotlight-cone above the piano (the user's verdict: "the piano
// view closes up, which honestly looks great but the light does not").
// This is the replacement: a handful of DOM musical-note glyphs (♪ ♫ ♩ ♬)
// drifting slowly upward behind the piano panel, recolored per song via a
// CSS custom property, faded in only while a song is actually playing.
// Same "floating DOM glyph" technique as sections/equations.js (that one
// oscillates in place for a scroll-linked parallax float; this one drifts
// continuously upward and wraps, since "flowing" is the specific motion
// asked for here) — kept as a separate module because the trigger
// (song play/pause) and the wrap-and-respawn drift are different enough
// from equations.js's scroll-driven oscillation to not be worth forcing
// into one shared abstraction.
//
// Usage:
//   const notes = createNotesFlow(containerEl);
//   notes.setMood('#b98cff');       // recolor (or a numeric hex)
//   notes.setPlaying(true);         // fades the layer in/out
//   notes.dispose();

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GLYPHS = ['♪', '♫', '♩', '♬', '♪', '♫'];
const NOTE_COUNT = 9;

function toHex(color) {
  if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0')}`;
  return color;
}

export function createNotesFlow(container) {
  const layer = document.createElement('div');
  layer.className = 'notes-flow-layer';
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);

  const notes = Array.from({ length: NOTE_COUNT }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'notes-flow-glyph';
    el.textContent = GLYPHS[i % GLYPHS.length];
    layer.appendChild(el);
    return {
      el,
      // 6-90%, not the full 0-100 — keeps clear of the fixed section-nav
      // rail that sits along the right edge of the viewport.
      x: 6 + Math.random() * 84, // %
      y: 20 + Math.random() * 100, // % — seeded past 100 so they don't all start mid-screen
      speed: 0.01 + Math.random() * 0.018, // %/ms
      sway: 4 + Math.random() * 6,
      seed: Math.random() * 1000,
      scale: 0.7 + Math.random() * 0.9,
      baseOpacity: 0.28 + Math.random() * 0.34,
    };
  });

  let raf = null;
  let active = false;
  let t = 0;
  let last = 0;

  function step(now) {
    if (!active) {
      raf = null;
      return;
    }
    const dt = Math.min(48, now - last || 16);
    last = now;
    t += dt;
    notes.forEach((n) => {
      n.y -= n.speed * dt;
      if (n.y < -10) {
        n.y = 110 + Math.random() * 15;
        n.x = 6 + Math.random() * 84;
      }
      const sway = Math.sin(t * 0.0007 + n.seed) * n.sway;
      n.el.style.transform = `translate3d(${sway}px, 0, 0) scale(${n.scale})`;
      n.el.style.left = `${n.x}%`;
      n.el.style.top = `${n.y}%`;
    });
    raf = requestAnimationFrame(step);
  }

  function setMood(color) {
    const hex = toHex(color ?? '#e7b878');
    layer.style.setProperty('--notes-color', hex);
  }

  function setPlaying(playing) {
    if (playing) {
      gsap.to(layer, { opacity: 1, duration: 1.1, ease: 'power2.out' });
      notes.forEach((n) => {
        n.el.style.opacity = String(n.baseOpacity);
      });
    } else {
      gsap.to(layer, { opacity: 0, duration: 0.8, ease: 'power2.in' });
    }
    active = playing && !REDUCED;
    if (active && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  return {
    setMood,
    setPlaying,
    dispose() {
      active = false;
      gsap.killTweensOf(layer);
      layer.remove();
    },
  };
}
