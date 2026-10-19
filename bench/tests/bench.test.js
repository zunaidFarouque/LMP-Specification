import { describe, test, expect } from 'bun:test';
import { countTokens, measureTextStats } from '../src/token-counter.js';
import { midiToJson, midiToCsv } from '../src/formats.js';
import { computeNoteFidelity, evaluateCorpus } from '../src/metrics.js';
import { BENCHMARK_CORPUS } from '../src/corpus.js';
import { compile } from '../../compiler-js/src/index.js';

describe('Track D.1: LMP-Bench Evaluation Harness (SVR, TCR, Fidelity)', () => {
  test('Token counter correctly tokenizes code and musical tokens', () => {
    const text = '@LMP 1.0\n@TRACK 1 Lead\n1.0 C4 100 1.0';
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(5);
    const stats = measureTextStats(text);
    expect(stats.tokens).toBe(tokens);
    expect(stats.chars).toBe(text.length);
    expect(stats.lines).toBe(3);
  });

  test('Format converters generate valid JSON and CSV from compiled MIDI', () => {
    const lmp = '@LMP 1.0\n@TRACK 1 Piano\n@CHANNEL 1\n1.0 C4 100 1.0';
    const midiBytes = compile(lmp);

    const json = midiToJson(midiBytes);
    expect(typeof json).toBe('string');
    const parsedJson = JSON.parse(json);
    expect(parsedJson.tracks.length).toBe(1);
    expect(parsedJson.tracks[0].notes.length).toBe(1);

    const csv = midiToCsv(midiBytes);
    expect(csv).toContain('Header');
    expect(csv).toContain('Note_on_c');
    expect(csv).toContain('End_of_file');
  });

  test('computeNoteFidelity accurately matches identical and mismatched note streams', () => {
    const notesA = [
      { channel: 0, pitch: 60, startBeat: 1.0, durationBeats: 1.0 },
      { channel: 0, pitch: 64, startBeat: 2.0, durationBeats: 1.0 }
    ];
    const notesB = [
      { channel: 0, pitch: 60, startBeat: 1.0, durationBeats: 1.0 },
      { channel: 0, pitch: 64, startBeat: 2.0, durationBeats: 1.0 }
    ];

    const matchFid = computeNoteFidelity(notesA, notesB);
    expect(matchFid.precision).toBe(1.0);
    expect(matchFid.recall).toBe(1.0);
    expect(matchFid.f1).toBe(1.0);

    const notesC = [
      { channel: 0, pitch: 60, startBeat: 1.0, durationBeats: 1.0 },
      { channel: 0, pitch: 67, startBeat: 3.0, durationBeats: 1.0 } // Pitch and beat mismatch
    ];

    const partialFid = computeNoteFidelity(notesA, notesC);
    expect(partialFid.matched).toBe(1);
    expect(partialFid.f1).toBeLessThan(1.0);
  });

  test('Full Corpus Evaluation achieves 100% SVR and significant token compression', () => {
    const report = evaluateCorpus(BENCHMARK_CORPUS);

    // 1. SVR check
    expect(report.summary.syntaxValidityRateStrict).toBe(100);
    expect(report.summary.syntaxValidityRateLoose).toBe(100);

    // 2. Token compression checks
    expect(report.summary.averageTokenCompressionVsJson).toBeGreaterThan(2.5);
    expect(report.summary.averageTokenCompressionVsCsv).toBeGreaterThan(1.8);

    // 3. Reconstruction fidelity check
    expect(report.summary.averageNoteF1Fidelity).toBeGreaterThan(85);

    // Check individual piece results
    for (const r of report.results) {
      expect(r.strictValid).toBe(true);
      expect(r.tcr.vsJson).toBeGreaterThan(1.5);
      expect(r.fidelity.f1).toBeGreaterThan(0.7);
    }
  });
});
