// Alternative "Recital" visual — Concept B, a completely different
// treatment from piano3d.js's procedural 3D scene. The user's verdict on
// the 3D piano was that it doesn't hold up ("barely a piano," and free
// detailed 3D piano models are all paid) — this sidesteps 3D modeling
// altogether with a flat, elegant illustrated grand-piano silhouette: a
// simple side-profile SVG shape (angular wedge body + propped lid,
// straight-line geometry only — deliberately no attempt at a photoreal
// curve, a clean faceted silhouette reads correctly at a glance and can't
// go "subtly wrong" the way a hand-tuned bezier curve can), gold linework,
// individually reactive keys, no camera/geometry to get wrong.
//
// (First draft of this reused piano3d.js's top-down body outline filled
// solid — that reads as an abstract blob, not a piano, once you're not
// looking at it as a 3D-extruded shape from an angle. A recognizable
// "piano" needs the classic side-profile silhouette, which is what this is.)
//
// Usage:
//   const piano = createIllustratedPiano(containerEl);
//   piano.pressKey(midi, { velocity, sustain, color });
//   piano.setPlaying(true);   // subtle zoom-in while a song plays
//   piano.setMood('#b98cff'); // or setMood(null) to clear
//   piano.dispose();

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Side-profile wedge: short/flat at the keyboard end (left), rising to a
// rounded tail (right) — the classic grand-piano silhouette, straight
// lines only.
const BODY_PATH =
  'M 20 170 L 20 130 L 70 126 L 145 100 L 225 78 L 300 65 L 345 68 L 338 105 L 318 170 Z';
// The propped-open lid, hinged near the body's rising back edge.
const LID_PATH = 'M 215 84 L 335 45 L 350 35 L 255 12 Z';

const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_LETTERS = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);
const START_MIDI = 48; // C3 — a narrower, more legible illustrated range than the full 88 keys
const END_MIDI = 84; // C6

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createIllustratedPiano(container, options = {}) {
  const { accentColor = '#e7b878' } = options;

  const svgNS = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div');
  wrap.className = 'piano-illustrated';
  container.appendChild(wrap);

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 380 230');
  svg.setAttribute('class', 'pi-svg');
  wrap.appendChild(svg);

  const defs = document.createElementNS(svgNS, 'defs');
  defs.innerHTML = `
    <linearGradient id="pi-body-fill" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#050405"/>
      <stop offset="55%" stop-color="#141118"/>
      <stop offset="100%" stop-color="#221d26"/>
    </linearGradient>
    <linearGradient id="pi-lid-fill" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0a0810"/>
      <stop offset="100%" stop-color="#2c2530"/>
    </linearGradient>
    <radialGradient id="pi-mood" cx="60%" cy="35%" r="65%">
      <stop offset="0%" stop-color="var(--pi-mood-color, #e7b878)" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="var(--pi-mood-color, #e7b878)" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);

  const moodGlow = document.createElementNS(svgNS, 'ellipse');
  moodGlow.setAttribute('cx', '220');
  moodGlow.setAttribute('cy', '90');
  moodGlow.setAttribute('rx', '260');
  moodGlow.setAttribute('ry', '200');
  moodGlow.setAttribute('fill', 'url(#pi-mood)');
  moodGlow.setAttribute('class', 'pi-mood-glow');
  moodGlow.style.opacity = '0';
  svg.appendChild(moodGlow);

  const bodyGroup = document.createElementNS(svgNS, 'g');
  bodyGroup.setAttribute('class', 'pi-body-group');
  svg.appendChild(bodyGroup);

  // Three thin legs, floor level at y=170.
  [35, 272, 322].forEach((x) => {
    const leg = document.createElementNS(svgNS, 'rect');
    leg.setAttribute('x', x);
    leg.setAttribute('y', 168);
    leg.setAttribute('width', 8);
    leg.setAttribute('height', 40);
    leg.setAttribute('rx', 2);
    leg.setAttribute('class', 'pi-leg');
    bodyGroup.appendChild(leg);
  });

  const body = document.createElementNS(svgNS, 'path');
  body.setAttribute('d', BODY_PATH);
  body.setAttribute('fill', 'url(#pi-body-fill)');
  body.setAttribute('stroke', accentColor);
  body.setAttribute('stroke-width', '1.6');
  body.setAttribute('stroke-linejoin', 'round');
  body.setAttribute('class', 'pi-body');
  bodyGroup.appendChild(body);

  const lid = document.createElementNS(svgNS, 'path');
  lid.setAttribute('d', LID_PATH);
  lid.setAttribute('fill', 'url(#pi-lid-fill)');
  lid.setAttribute('stroke', accentColor);
  lid.setAttribute('stroke-width', '1.3');
  lid.setAttribute('stroke-linejoin', 'round');
  lid.setAttribute('class', 'pi-lid');
  bodyGroup.appendChild(lid);

  // A soft highlight sweep across the lid, echoing the 3D version's
  // glossy-lacquer read without needing real reflections.
  const sheen = document.createElementNS(svgNS, 'path');
  sheen.setAttribute('d', LID_PATH);
  sheen.setAttribute('fill', 'none');
  sheen.setAttribute('stroke', 'rgba(255,255,255,0.35)');
  sheen.setAttribute('stroke-width', '3');
  sheen.setAttribute('stroke-dasharray', '30 220');
  sheen.setAttribute('class', 'pi-sheen');
  bodyGroup.appendChild(sheen);

  // ---- keyboard, inset along the body's front-left face ----
  const keysGroup = document.createElementNS(svgNS, 'g');
  keysGroup.setAttribute('class', 'pi-keys');
  bodyGroup.appendChild(keysGroup);

  const keyMeshes = new Map();
  const whites = [];
  const blacks = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const letter = NOTE_ORDER[midi % 12];
    if (BLACK_LETTERS.has(letter)) blacks.push({ midi, afterWhiteIndex: whites.length - 1 });
    else whites.push({ midi });
  }
  const KB_X0 = 24;
  const KB_X1 = 138;
  const KB_Y = 131;
  const WHITE_H = 38;
  const BLACK_H = 23;
  const wCount = whites.length;
  const whiteW = (KB_X1 - KB_X0) / wCount;

  whites.forEach((w, i) => {
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', KB_X0 + i * whiteW + 0.4);
    rect.setAttribute('y', KB_Y);
    rect.setAttribute('width', Math.max(whiteW - 0.8, 1));
    rect.setAttribute('height', WHITE_H);
    rect.setAttribute('rx', '0.6');
    rect.setAttribute('class', 'pi-key pi-key-white');
    keysGroup.appendChild(rect);
    keyMeshes.set(w.midi, rect);
  });
  blacks.forEach((b) => {
    const x = KB_X0 + (b.afterWhiteIndex + 1) * whiteW - whiteW * 0.28;
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', KB_Y);
    rect.setAttribute('width', whiteW * 0.56);
    rect.setAttribute('height', BLACK_H);
    rect.setAttribute('rx', '0.5');
    rect.setAttribute('class', 'pi-key pi-key-black');
    keysGroup.appendChild(rect);
    keyMeshes.set(b.midi, rect);
  });

  // ---- reactive behaviour ----
  function pressKey(midi, { velocity = 0.9, sustain = 1, color } = {}) {
    const mesh = keyMeshes.get(Math.round(midi));
    if (!mesh) return;
    const holdTime = 0.28 * clamp(sustain, 0.6, 2.4);
    gsap.killTweensOf(mesh);
    const glowColor = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : accentColor;
    gsap.set(mesh, { transformOrigin: '50% 0%' });
    gsap.timeline()
      .to(mesh, {
        scaleY: 1 - 0.14 * clamp(velocity, 0.3, 1),
        fill: glowColor,
        duration: REDUCED ? 0 : 0.06,
        ease: 'power1.out',
      })
      .to(mesh, {
        scaleY: 1,
        duration: REDUCED ? 0 : holdTime,
        ease: 'power2.out',
        onComplete: () => {
          mesh.style.fill = ''; // GSAP tweens fill via style, not the SVG attribute
        },
      });
  }

  function setPlaying(playing) {
    if (REDUCED) return;
    gsap.to(bodyGroup, {
      scale: playing ? 1.12 : 1,
      x: playing ? -12 : 0,
      duration: 1.3,
      ease: 'power2.inOut',
      transformOrigin: '10% 90%',
    });
  }

  function setMood(hexColor) {
    if (hexColor == null) {
      gsap.to(moodGlow, { opacity: 0, duration: 0.7, ease: 'power2.in' });
      return;
    }
    const hex = typeof hexColor === 'number' ? `#${hexColor.toString(16).padStart(6, '0')}` : hexColor;
    svg.style.setProperty('--pi-mood-color', hex);
    gsap.to(moodGlow, { opacity: 1, duration: 0.9, ease: 'power2.out' });
  }

  let sheenTween = null;
  function activate() {
    if (REDUCED || sheenTween) return;
    sheenTween = gsap.to(sheen, {
      strokeDashoffset: -250,
      duration: 4.5,
      ease: 'sine.inOut',
      repeat: -1,
    });
  }
  function deactivate() {
    sheenTween?.kill();
    sheenTween = null;
  }

  return {
    pressKey,
    setPlaying,
    setMood,
    activate,
    deactivate,
    dispose() {
      deactivate();
      wrap.remove();
    },
  };
}
