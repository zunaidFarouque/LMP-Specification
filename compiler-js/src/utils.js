/**
 * Shared helpers: SPN ↔ MIDI (C4=60), beat → ticks.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SPN_REGEX = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/i;

/**
 * Scientific Pitch Notation to MIDI note number. C4 = 60.
 * @param {string} spn - e.g. "C4", "F#3", "Bb2"
 * @returns {number|undefined} 0-127 or undefined if invalid
 */
export function spnToMidi(spn) {
  if (!spn || typeof spn !== 'string') return undefined;
  const m = spn.trim().match(SPN_REGEX);
  if (!m) return undefined;
  let noteIndex = NOTE_NAMES.indexOf(m[1].toUpperCase());
  if (noteIndex === -1) return undefined;
  const acc = m[2];
  if (acc) {
    if (acc.startsWith('b')) {
      noteIndex -= acc.length;
    } else {
      noteIndex += acc.length;
    }
  }
  noteIndex = ((noteIndex % 12) + 12) % 12;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + noteIndex;
  if (midi < 0 || midi > 127) return undefined;
  return midi;
}

/**
 * Beat to MIDI ticks. 1.0 beat = one quarter note at current BPM.
 * @param {number} beat - Beat position
 * @param {number} bpm - Beats per minute
 * @param {number} ppqn - Pulses per quarter note
 * @returns {number} Rounded ticks (Math.round)
 */
export function beatToTicks(beat, bpm, ppqn) {
  if (bpm <= 0) return 0;
  const beatsPerSec = bpm / 60;
  const secPerBeat = 1 / beatsPerSec;
  const ticksPerBeat = ppqn;
  const ticks = beat * ticksPerBeat;
  return Math.round(ticks);
}

/**
 * MIDI note number to Scientific Pitch Notation. C4 = 60.
 * Uses sharps (C#4, F#3) for consistency with LMP.
 * @param {number} midi - MIDI note 0-127
 * @returns {string|undefined} e.g. "C4", "F#3", or undefined if invalid
 */
export function midiToSpn(midi) {
  if (typeof midi !== 'number' || midi < 0 || midi > 127) return undefined;
  const n = Math.round(midi);
  const noteName = NOTE_NAMES[n % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * MIDI ticks to beat position. 1.0 beat = one quarter note.
 * Rounded to 3 decimal places per LMP spec.
 * @param {number} tick - Absolute tick position
 * @param {number} ppqn - Pulses per quarter note (from MIDI header)
 * @returns {number} Beat position
 */
export function ticksToBeat(tick, ppqn) {
  if (ppqn <= 0) return 0;
  const beat = tick / ppqn;
  return Math.round(beat * 1000) / 1000;
}
