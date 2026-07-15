// Transcribed from the user's own Liebestraum No. 3 (Liszt) sheet music
// (design-reference/LIEBESTRAUM SHEET.svg), measures 1-9, by parsing the
// SVG's notehead coordinates against the staff-line positions — not from
// memory. Ab major, 6/4, "Poco allegro, con affetto". The right-hand
// arpeggiated figure carries the tune; left hand holds one root note per
// half-measure. Shared across every concept that wants to offer it as an
// autoplay/demo piece on its piano.
export const LIEBESTRAUM = [
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

/**
 * Schedules the piece via setTimeout with light manual rubato (lingering on
 * the first/last note of each 5-note figure, easing into the middle "peak"
 * note, and a ritardando on the final two cells) rather than a metronome.
 * Returns a stop() function that cancels every pending timer — always call
 * it from your section's cleanup to avoid ghost notes firing after
 * navigation away.
 */
export function scheduleLiebestraum({ onNote, eighthMs = 200 }) {
  const timers = [];
  let t = 0;

  LIEBESTRAUM.forEach((cell, cellIndex) => {
    const ritardando = cell.ritardando ?? 1;
    timers.push(
      setTimeout(() => onNote(cell.lh, { sustain: cellIndex === 0 ? 1.6 : 1.5 }), t),
    );

    if (cell.rh.length === 0) {
      t += eighthMs * 3 * ritardando;
      return;
    }

    t += eighthMs * ritardando;
    cell.rh.forEach((note, i) => {
      const edge = i === 0 || i === cell.rh.length - 1 ? 1.15 : i === 2 ? 0.92 : 1;
      const stepMs = eighthMs * edge * ritardando;
      timers.push(setTimeout(() => onNote(note, { sustain: 0.9 }), t));
      t += stepMs;
    });
  });

  const totalMs = t + 400;
  const stop = () => timers.forEach(clearTimeout);
  return { stop, totalMs };
}
