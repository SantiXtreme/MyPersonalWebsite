import { piano } from '../../data/content.js';

const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_LETTERS = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);
const KEY_BINDS = { C4: 'a', D4: 's', E4: 'd', F4: 'f', G4: 'g', A4: 'h', B4: 'j', C5: 'k' };
const BLACK_KEY_BINDS = { 'C#4': 'w', 'D#4': 'e', 'F#4': 't', 'G#4': 'y', 'A#4': 'u' };

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteNameToMidi(name) {
  const m = name.match(/^([A-G])(b|#)?(-?\d+)$/);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const offset = m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + base + offset;
}

// C2 -> C5, three octaves — enough range to both noodle around and to play
// the Liebestraum No. 3 excerpt below.
const START_MIDI = noteNameToMidi('C2');
const END_MIDI = noteNameToMidi('C5');

function buildKeyboard() {
  const whites = [];
  const blacks = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const letter = NOTE_ORDER[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    const note = `${letter}${octave}`;
    if (BLACK_LETTERS.has(letter)) {
      blacks.push({ note, midi, afterWhiteIndex: whites.length - 1 });
    } else {
      whites.push({ note, midi });
    }
  }
  return { whites, blacks };
}

const { whites: WHITE_NOTES, blacks: BLACK_NOTES } = buildKeyboard();
// Keyed by MIDI number, not note-name string — the autoplay data below
// spells notes with flats (Db4, Eb3...) while the keyboard is generated
// with sharps (C#4...); a string-keyed lookup would silently miss every
// flat-spelled note.
const KEY_BIND_MAP = Object.fromEntries(
  Object.entries({ ...KEY_BINDS, ...BLACK_KEY_BINDS }).map(([note, key]) => [key, noteNameToMidi(note)]),
);

// Transcribed from the user's own Liebestraum No. 3 (Liszt) sheet, measures
// 1-9: the arpeggiated right-hand figure carries the tune, left hand holds
// one root note per half-measure. Ab major, 6/4, "Poco allegro, con affetto".
const LIEBESTRAUM = [
  { lh: 'Eb3', rh: [] },
  { lh: 'Ab2', rh: ['Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'Ab2', rh: ['Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'G2', rh: ['E4', 'Bb4', 'C5', 'Bb4', 'Eb4'] },
  { lh: 'G2', rh: ['Eb4', 'Bb4', 'C5', 'Bb4', 'Eb4'] },
  { lh: 'F2', rh: ['E4', 'A4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'F2', rh: ['Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'F3', rh: ['D4', 'A4', 'C5', 'Ab4', 'Db4'] },
  { lh: 'F3', rh: ['Db4', 'Ab4', 'C5', 'Ab4', 'Db4'] },
  { lh: 'Eb2', rh: ['D4', 'Eb4', 'C5', 'Eb4', 'Db4'] },
  { lh: 'Bb2', rh: ['Db4', 'Eb4', 'G4', 'Eb4', 'Db4'] },
  { lh: 'Ab2', rh: ['C4', 'Eb4', 'Ab4', 'Eb4', 'C4'] },
  { lh: 'Ab2', rh: ['Ab3', 'C4', 'Ab4', 'Eb4', 'Ab3'] },
  { lh: 'Ab2', rh: ['Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'Ab2', rh: ['Eb4', 'Ab4', 'C5', 'Ab4', 'Eb4'] },
  { lh: 'G2', rh: ['E4', 'Bb4', 'C5', 'Bb4', 'Eb4'], ritardando: 1.08 },
  { lh: 'G2', rh: ['Eb4', 'Bb4', 'C5', 'Bb4', 'Eb4'], ritardando: 1.3 },
];

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function pluck(freq, sustain = 1.3) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const overtone = ctx.createOscillator();
  overtone.type = 'sine';
  overtone.frequency.value = freq * 2;
  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = 0.15;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + sustain);

  osc.connect(gain);
  overtone.connect(overtoneGain).connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  overtone.start(now);
  osc.stop(now + sustain + 0.05);
  overtone.stop(now + sustain + 0.05);
}

let activeCleanup = null;
let scheduledTimers = [];
let isPlaying = false;

function stopLiebestraum(playBtn) {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers = [];
  isPlaying = false;
  if (playBtn) playBtn.textContent = 'Play Liebestraum No. 3';
}

export function render(container) {
  const whiteWidthPct = 100 / WHITE_NOTES.length;
  const blackWidthPct = whiteWidthPct * 0.56;

  container.innerHTML = `
    <header class="panel-header">
      <span class="eyebrow">Mix Wondrous Melody</span>
      <h2>Piano</h2>
      <p class="panel-summary">${piano.intro}</p>
      <button type="button" class="rune-button piano-play-btn" id="play-liebestraum">Play Liebestraum No. 3</button>
    </header>
    <div class="piano-wrap">
      <div class="piano-scroll">
        <div class="piano-keys" id="piano-keys">
          ${WHITE_NOTES.map((n) => `<button type="button" class="piano-key white" data-midi="${n.midi}" aria-label="Play ${n.note}"></button>`).join('')}
          ${BLACK_NOTES.map(
            (n) =>
              `<button type="button" class="piano-key black" data-midi="${n.midi}" aria-label="Play ${n.note}" style="left:calc(${(n.afterWhiteIndex + 1) * whiteWidthPct}% - ${blackWidthPct / 2}%); width:${blackWidthPct}%"></button>`,
          ).join('')}
        </div>
      </div>
      <p class="piano-hint">
        Click or tap the keys, or play with your keyboard:
        <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><kbd>F</kbd><kbd>G</kbd><kbd>H</kbd><kbd>J</kbd><kbd>K</kbd> for the middle white keys,
        <kbd>W</kbd><kbd>E</kbd><kbd>T</kbd><kbd>Y</kbd><kbd>U</kbd> for black — or scroll for the full three octaves.
      </p>
    </div>
  `;

  const keysEl = container.querySelector('#piano-keys');
  const playBtn = container.querySelector('#play-liebestraum');
  let pointerActive = false;
  let lastMidi = null;

  function keyEl(midi) {
    return keysEl.querySelector(`[data-midi="${midi}"]`);
  }
  function keyElByName(name) {
    return keyEl(noteNameToMidi(name));
  }

  function activate(btn, sustain) {
    if (!btn) return;
    pluck(midiToFreq(+btn.dataset.midi), sustain);
    btn.classList.add('is-active');
    setTimeout(() => btn.classList.remove('is-active'), Math.min(160, (sustain ?? 1.3) * 1000));
  }

  function activateByClick(btn) {
    if (!btn) return;
    const midi = +btn.dataset.midi;
    if (midi === lastMidi) return;
    lastMidi = midi;
    activate(btn);
  }

  function handlePointerDown(e) {
    const btn = e.target.closest('.piano-key');
    if (!btn) return;
    pointerActive = true;
    activateByClick(btn);
  }
  function handlePointerOver(e) {
    if (!pointerActive) return;
    activateByClick(e.target.closest('.piano-key'));
  }
  function handlePointerUp() {
    pointerActive = false;
    lastMidi = null;
  }
  function handleKeydown(e) {
    if (e.repeat) return;
    const midi = KEY_BIND_MAP[e.key.toLowerCase()];
    if (midi === undefined) return;
    activate(keyEl(midi));
  }
  function handleKeyup(e) {
    if (KEY_BIND_MAP[e.key.toLowerCase()] !== undefined) lastMidi = null;
  }

  keysEl.addEventListener('pointerdown', handlePointerDown);
  keysEl.addEventListener('pointerover', handlePointerOver);
  window.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', handleKeyup);

  function playLiebestraum() {
    if (isPlaying) {
      stopLiebestraum(playBtn);
      return;
    }
    isPlaying = true;
    playBtn.textContent = 'Stop';

    const EIGHTH = 200; // ms, nominal at q=150 — rubato adjusts this below
    let t = 0;

    LIEBESTRAUM.forEach((cell, cellIndex) => {
      const ritardando = cell.ritardando ?? 1;
      scheduledTimers.push(
        setTimeout(() => {
          activate(keyElByName(cell.lh), cellIndex === 0 ? 1.6 : 1.5);
        }, t),
      );

      if (cell.rh.length === 0) {
        t += EIGHTH * 3 * ritardando; // the solo pickup, held
        return;
      }

      t += EIGHTH * ritardando; // the eighth rest before the RH figure enters
      cell.rh.forEach((note, i) => {
        // gentle rubato: linger on the first/last note of each 5-note
        // figure and on the very final phrase, rather than a metronome.
        const edge = i === 0 || i === cell.rh.length - 1 ? 1.15 : i === 2 ? 0.92 : 1;
        const stepMs = EIGHTH * edge * ritardando;
        scheduledTimers.push(
          setTimeout(() => {
            activate(keyElByName(note), 0.9);
          }, t),
        );
        t += stepMs;
      });
    });

    scheduledTimers.push(setTimeout(() => stopLiebestraum(playBtn), t + 400));
  }

  playBtn.addEventListener('click', playLiebestraum);

  activeCleanup = () => {
    stopLiebestraum();
    keysEl.removeEventListener('pointerdown', handlePointerDown);
    keysEl.removeEventListener('pointerover', handlePointerOver);
    window.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keyup', handleKeyup);
    playBtn.removeEventListener('click', playLiebestraum);
  };
}

export function cleanup() {
  activeCleanup?.();
  activeCleanup = null;
}
