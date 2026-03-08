/**
 * LMP-Core v1 — Lean Musical Protocol compiler
 * Entry point: compile LMP text to MIDI buffer/blob.
 * Decompile: MIDI buffer to LMP text.
 *
 * Pipeline: Preprocess → Track/State → Event Expansion → MIDI Synthesis
 */
import { preprocess } from './preprocess.js';
import { buildState } from './state.js';
import { expand } from './expand.js';
import { eventsToMidi } from './midi.js';
import { decompile } from './decompile.js';
import { parseMidi } from 'midi-file';

/**
 * Compiles a raw LMP string into a MIDI buffer.
 * @param {string} lmpText - Raw LMP source
 * @param {{ loose?: boolean }} [options] - If loose: true, returns { midi, warnings } and emits warnings for recoverable violations
 * @returns {Uint8Array|Buffer|{ midi: Uint8Array, warnings: string[] }} MIDI file binary, or { midi, warnings } when loose
 */
export function compile(lmpText, options = {}) {
  const loose = options?.loose === true;
  const withSourceMap = options?.sourceMap === true;
  const warnings = loose ? [] : undefined;
  const opts = loose ? { loose: true, warnings } : {};

  const lines = preprocess(lmpText);
  const state = buildState(lines, opts);
  const events = expand(lines, state, opts);
  const midi = eventsToMidi(events, state);

  if (withSourceMap) {
    const sourceMap = new Map();
    for (const e of events) {
      if (e.type === 'note' && e.sourceLine != null) {
        const b = Math.round(e.beat * 1000) / 1000;
        const key = `${b}_${e.trackIndex}_${e.midi}`;
        sourceMap.set(key, e.sourceLine);
      }
    }
    if (loose) return { midi, warnings, sourceMap };
    return { midi, sourceMap };
  }
  if (loose) return { midi, warnings };
  return midi;
}

export { decompile, parseMidi };
export default { compile, decompile, parseMidi };
