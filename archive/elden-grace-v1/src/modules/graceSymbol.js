import gsap from 'gsap';
import { motionPrefs } from './motionPrefs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * Builds the glowing crescent-and-cross "grace" symbol (inspired by
 * Miquella's Cross) as an SVG, with a stroke draw-in intro, an idle glow
 * pulse, and a brief "flare" for interactions (menu open, level up, etc).
 */
export function mountGraceSymbol(container) {
  const svg = el('svg', {
    viewBox: '0 0 200 400',
    class: 'grace-symbol-svg',
    'aria-hidden': 'true',
  });

  const defs = el('defs');
  // userSpaceOnUse, not the default objectBoundingBox: a perfectly
  // vertical/horizontal line has a zero-width/zero-height bounding box,
  // which makes objectBoundingBox gradients degenerate (and invisible) for
  // exactly those two paths — cost an afternoon to track down once already.
  const gradient = el('linearGradient', {
    id: 'grace-grad',
    gradientUnits: 'userSpaceOnUse',
    x1: '100',
    y1: '8',
    x2: '100',
    y2: '392',
  });
  gradient.append(
    el('stop', { offset: '0%', 'stop-color': '#fff8e6' }),
    el('stop', { offset: '55%', 'stop-color': '#f3d489' }),
    el('stop', { offset: '100%', 'stop-color': '#c9a86a' }),
  );
  const glowFilter = el('filter', { id: 'grace-blur', x: '-120%', y: '-120%', width: '340%', height: '340%' });
  const blur = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '4.2', result: 'blur' });
  const merge = el('feMerge');
  merge.append(el('feMergeNode', { in: 'blur' }), el('feMergeNode', { in: 'SourceGraphic' }));
  glowFilter.append(blur, merge);
  defs.append(gradient, glowFilter);

  const glowGroup = el('g', { class: 'grace-glow-group', filter: 'url(#grace-blur)' });

  const vertical = el('path', { d: 'M100 8 L100 392' });
  const horizontal = el('path', { d: 'M50 150 L150 150' });
  const crescent = el('path', { d: 'M144.4 187.3 A 58 58 0 1 1 144.4 112.7' });

  [vertical, horizontal, crescent].forEach((p) => {
    p.setAttribute('stroke', 'url(#grace-grad)');
    p.setAttribute('stroke-width', '3.4');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
  });

  glowGroup.append(vertical, horizontal, crescent);
  svg.append(defs, glowGroup);
  container.appendChild(svg);

  const paths = [vertical, horizontal, crescent];
  const lengths = paths.map((p) => p.getTotalLength());
  paths.forEach((p, i) => {
    p.style.strokeDasharray = String(lengths[i]);
    p.style.strokeDashoffset = String(lengths[i]);
  });

  let pulseTween = null;

  function startPulse() {
    if (motionPrefs.reduced || pulseTween) return;
    pulseTween = gsap.to(glowGroup, {
      opacity: 0.72,
      duration: 1.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  function playIntro() {
    const tl = gsap.timeline();
    if (motionPrefs.reduced) {
      tl.set(paths, { strokeDashoffset: 0 }).set(glowGroup, { opacity: 1 }).call(startPulse);
      return tl;
    }
    tl.set(glowGroup, { opacity: 0 })
      .to(glowGroup, { opacity: 1, duration: 0.5 })
      .to(vertical, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' }, 0.15)
      .to(horizontal, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 0.75)
      .to(crescent, { strokeDashoffset: 0, duration: 1.05, ease: 'power2.inOut' }, 0.95)
      .call(startPulse);
    return tl;
  }

  function flare() {
    if (motionPrefs.reduced) return;
    gsap
      .timeline()
      .to(container, { filter: 'brightness(1.9)', duration: 0.16, ease: 'power1.out' })
      .to(container, { filter: 'brightness(1)', duration: 0.7, ease: 'power2.in' });
  }

  return { svg, playIntro, flare };
}
