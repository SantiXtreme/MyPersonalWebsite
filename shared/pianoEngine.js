// Shared, framework-agnostic piano engine used by every concept that
// includes a playable piano. Pure WebAudio synthesis (no sample assets):
// each note is a small stack of harmonic partials with independent decay
// rates (higher partials die faster, like a real struck string) plus a
// short filtered-noise "hammer" transient for attack character.

const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_LETTERS = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);

export function noteNameToMidi(name) {
  const m = name.match(/^([A-G])(b|#)?(-?\d+)$/);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const offset = m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + base + offset;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function buildKeyboard(startNote, endNote) {
  const startMidi = noteNameToMidi(startNote);
  const endMidi = noteNameToMidi(endNote);
  const whites = [];
  const blacks = [];
  for (let midi = startMidi; midi <= endMidi; midi++) {
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

let sharedCtx = null;
function getCtx() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

/**
 * createPianoVoice() -> { play(freqOrMidi, opts) }
 * opts: { sustain=1.6, velocity=1, isMidi=false }
 * Call play() on every note-on; there's no note-off (the envelope's decay
 * IS the release, matching how an un-pedalled acoustic piano note dies out
 * on its own regardless of how long the key is held).
 */
export function createPianoVoice({ outputGain = 0.9 } = {}) {
  const ctx = getCtx();
  const master = ctx.createGain();
  master.gain.value = outputGain;
  master.connect(ctx.destination);

  function play(freqOrMidi, { sustain = 1.6, velocity = 1, isMidi = false } = {}) {
    const audioCtx = getCtx();
    const freq = isMidi ? midiToFreq(freqOrMidi) : freqOrMidi;
    const now = audioCtx.currentTime;

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1;
    voiceGain.connect(master);

    const partials = [
      { mult: 1, amp: 1, decay: sustain },
      { mult: 2, amp: 0.35, decay: sustain * 0.7 },
      { mult: 3, amp: 0.16, decay: sustain * 0.45 },
      { mult: 4.2, amp: 0.07, decay: sustain * 0.3 }, // slightly inharmonic, like a real string
    ];

    partials.forEach((p) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p.mult;
      const g = audioCtx.createGain();
      const peak = Math.max(0.5 * p.amp * velocity, 0.0002);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
      osc.connect(g).connect(voiceGain);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    });

    // Hammer transient: a very short filtered noise burst for attack "thock".
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * 0.02));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = Math.min(freq * 2, 8000);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.12 * velocity;
    noise.connect(noiseFilter).connect(noiseGain).connect(voiceGain);
    noise.start(now);
  }

  return { play, context: ctx };
}
