// Ambient wind/ember drone, synthesized (no audio files). Muted by default;
// the user opts in via the HUD speaker toggle. If a returning visitor had
// it enabled, we honor that on their first interaction anywhere on the
// page rather than forcing a second click — browsers won't allow audio to
// start before a user gesture regardless.
const STORAGE_KEY = 'santiagoGrace.audio';

let ctx = null;
let masterGain = null;
let nodes = [];
let isOn = false;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function buildDrone() {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.connect(masterGain);

  [
    { freq: 72, type: 'sawtooth', gain: 0.5 },
    { freq: 108, type: 'sine', gain: 0.22 },
    { freq: 144.5, type: 'sine', gain: 0.18 },
  ].forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start();
    nodes.push(osc, g);
  });

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  nodes.push(lfo, lfoGain, filter);
}

function start() {
  ensureCtx();
  if (nodes.length === 0) buildDrone();
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.2);
}

function stop() {
  if (!ctx) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
}

export function initAudio(toggleBtn) {
  const saved = localStorage.getItem(STORAGE_KEY) === 'on';
  isOn = saved;
  toggleBtn.setAttribute('aria-pressed', String(saved));

  function firstGestureHandler() {
    if (isOn) start();
  }
  window.addEventListener('pointerdown', firstGestureHandler, { once: true });
  window.addEventListener('keydown', firstGestureHandler, { once: true });

  toggleBtn.addEventListener('click', () => {
    isOn = !isOn;
    toggleBtn.setAttribute('aria-pressed', String(isOn));
    localStorage.setItem(STORAGE_KEY, isOn ? 'on' : 'off');
    if (isOn) start();
    else stop();
  });
}
