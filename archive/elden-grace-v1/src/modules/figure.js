import gsap from 'gsap';
import { motionPrefs } from './motionPrefs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// A low-poly, ball-jointed stickman (original construction, in the spirit
// of a simple geometric avatar — not traced from any reference) sitting
// cross-legged at the grace, with one accent of armor (a helmet cap, nose
// guard, and a shoulder pauldron) picking up the current flask accent
// color. Deliberately not a skeleton.
export function mountFigure(container) {
  const svg = el('svg', { viewBox: '0 0 200 220', class: 'figure-svg', 'aria-hidden': 'true' });

  const limbGroup = el('g', { class: 'figure-limbs' });
  const armorGroup = el('g', { class: 'figure-armor' });

  const limbs = [
    // [x1, y1, x2, y2]
    [88, 106, 62, 132], // right thigh
    [62, 132, 96, 150], // right shin (crosses back to center)
    [112, 106, 140, 132], // left thigh
    [140, 132, 104, 150], // left shin (crosses back to center)
    [80, 60, 66, 86], // right upper arm
    [66, 86, 72, 110], // right forearm, resting on knee
    [122, 60, 136, 84], // left upper arm
    [136, 84, 130, 106], // left forearm
  ];
  limbs.forEach(([x1, y1, x2, y2]) => {
    limbGroup.appendChild(
      el('line', {
        x1,
        y1,
        x2,
        y2,
        class: 'figure-bone',
        'stroke-width': 10,
        'stroke-linecap': 'round',
      }),
    );
  });

  const joints = [
    [88, 106, 6.5], // right hip
    [62, 132, 5.5], // right knee
    [96, 150, 5], // right foot
    [112, 106, 6.5], // left hip
    [140, 132, 5.5], // left knee
    [104, 150, 5], // left foot
    [80, 60, 6.5], // right shoulder
    [66, 86, 5], // right elbow
    [72, 110, 4.5], // right hand
    [136, 84, 5], // left elbow
    [130, 106, 4.5], // left hand
  ];
  joints.forEach(([cx, cy, r]) => {
    limbGroup.appendChild(el('circle', { cx, cy, r, class: 'figure-joint' }));
  });

  const torso = el('rect', { x: 76, y: 52, width: 48, height: 58, rx: 15, class: 'figure-torso' });
  const head = el('circle', { cx: 100, cy: 30, r: 17, class: 'figure-head' });
  const neck = el('rect', { x: 94, y: 42, width: 12, height: 12, class: 'figure-torso' });

  const helmet = el('path', {
    d: 'M83 29 Q100 4 117 29 L117 32 Q100 15 83 32 Z',
    class: 'figure-helmet',
  });
  const noseguard = el('rect', { x: 97.5, y: 28, width: 5, height: 14, rx: 1.5, class: 'figure-helmet' });
  const pauldron = el('circle', { cx: 122, cy: 60, r: 11, class: 'figure-helmet' });

  armorGroup.append(helmet, noseguard, pauldron);

  svg.append(limbGroup, torso, neck, head, armorGroup);
  container.appendChild(svg);

  let idleTween = null;

  function startIdle() {
    if (motionPrefs.reduced || idleTween) return;
    idleTween = gsap.to(svg, {
      y: -3,
      duration: 2.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  function playIntro() {
    if (motionPrefs.reduced) {
      gsap.set(svg, { opacity: 1, y: 0 });
      startIdle();
      return gsap.timeline();
    }
    return gsap.fromTo(
      svg,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out', onComplete: startIdle },
    );
  }

  return { svg, playIntro };
}
