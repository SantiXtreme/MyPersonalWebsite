// Floating equation glyphs — a handful of absolutely-positioned DOM spans
// (derivatives, integrals, momentum, kinematics) drifting slowly with a
// scroll-linked 3D parallax (CSS perspective, not WebGL — plain text at an
// angle with depth-of-field-ish blur reads as "floating" without the cost of
// a real 3D scene). Reused by the About hero (sparse, ambient) and the Math
// & Physics hero (denser, more prominent) via `density`/`opacity`.
//
// Usage:
//   const eqs = createFloatingEquations(containerEl, { density: 'dense' });
//   eqs.activate();
//   eqs.dispose();

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SPARSE_SET = ['∫ f(x) dx', 'd/dx', 'Σ', 'π', 'lim', '∇'];
const DENSE_SET = [
  '∫ f(x) dx',
  'd/dx [x²] = 2x',
  'Σ mᵢvᵢ',
  'p = mv',
  'F = ma',
  '∇·E = ρ/ε₀',
  'd²x/dt²',
  '∫₀^∞ e⁻ˣ dx',
  'ΔKE = ½mv²',
  'π ≈ 3.14159',
];

export function createFloatingEquations(container, options = {}) {
  const { density = 'sparse', opacity = 0.34 } = options;
  const set = density === 'dense' ? DENSE_SET : SPARSE_SET;

  const layer = document.createElement('div');
  layer.className = 'equation-layer';
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);

  const nodes = set.map((text, i) => {
    const el = document.createElement('span');
    el.className = 'equation-glyph';
    el.textContent = text;
    el.style.left = `${8 + ((i * 37) % 84)}%`;
    el.style.top = `${10 + ((i * 53) % 80)}%`;
    el.style.opacity = String(opacity * (0.6 + Math.random() * 0.5));
    el.style.fontSize = `${14 + Math.random() * 16}px`;
    layer.appendChild(el);
    return { el, depth: 0.3 + Math.random() * 0.7, seed: Math.random() * 1000, driftX: (Math.random() - 0.5) * 30 };
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
    t += dt * 0.0002;
    nodes.forEach((n) => {
      const y = Math.sin(t * (0.5 + n.depth) + n.seed) * 14 * n.depth;
      const x = Math.cos(t * (0.4 + n.depth) + n.seed) * n.driftX * n.depth;
      const z = Math.sin(t * 0.3 + n.seed) * 40 * n.depth;
      n.el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${0.85 + n.depth * 0.3})`;
    });
    raf = requestAnimationFrame(step);
  }

  let scrollTween = null;
  function bindScroll(ScrollTrigger, trigger) {
    scrollTween = gsap.to(layer, {
      yPercent: -18,
      ease: 'none',
      scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
  }

  return {
    activate() {
      active = true;
      if (REDUCED) return;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    deactivate() {
      active = false;
    },
    bindScroll,
    dispose() {
      active = false;
      scrollTween?.scrollTrigger?.kill();
      layer.remove();
    },
  };
}
