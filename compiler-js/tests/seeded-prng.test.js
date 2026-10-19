import { describe, test, expect } from 'bun:test';
import { compile, parseMidi } from '../src/index.js';

describe('Track D.2: Seeded PRNG Humanization (@SEED & @RULE VEL=min-max)', () => {
  const baseLmp = `
@LMP 1.0
@BPM 120
@SEED 42
@TRACK 1 Drums
@CHANNEL 10
@RULE 36 VEL=60-80
@RULE 38 VEL=90-110
1.0 36 _ 0.5
1.5 38 _ 0.5
2.0 36 _ 0.5
2.5 38 _ 0.5
3.0 36 _ 0.5
3.5 38 _ 0.5
4.0 36 _ 0.5
4.5 38 _ 0.5
`;

  test('Deterministic reproduction: identical seed produces identical binary MIDI output', () => {
    const midi1 = compile(baseLmp);
    const midi2 = compile(baseLmp);

    expect(midi1).toEqual(midi2);

    const parsed1 = parseMidi(midi1);
    const parsed2 = parseMidi(midi2);

    const notes1 = parsed1.tracks[0].filter(e => e.type === 'noteOn');
    const notes2 = parsed2.tracks[0].filter(e => e.type === 'noteOn');

    expect(notes1.length).toBe(8);
    for (let i = 0; i < notes1.length; i++) {
      expect(notes1[i].velocity).toBe(notes2[i].velocity);
      expect(notes1[i].noteNumber).toBe(notes2[i].noteNumber);
    }
  });

  test('Different seeds produce different pseudo-random velocity sequences', () => {
    const lmpSeedA = baseLmp.replace('@SEED 42', '@SEED 100');
    const lmpSeedB = baseLmp.replace('@SEED 42', '@SEED 99999');

    const midiA = compile(lmpSeedA);
    const midiB = compile(lmpSeedB);

    const parsedA = parseMidi(midiA);
    const parsedB = parseMidi(midiB);

    const velsA = parsedA.tracks[0].filter(e => e.type === 'noteOn').map(e => e.velocity);
    const velsB = parsedB.tracks[0].filter(e => e.type === 'noteOn').map(e => e.velocity);

    expect(velsA).not.toEqual(velsB);
  });

  test('All generated velocities stay strictly within the specified [min, max] range', () => {
    const lmp = `
@LMP 1.0
@BPM 120
@SEED 777
@TRACK 1 Groove
@CHANNEL 10
@RULE 36 VEL=65-75
@RULE 38 VEL=100-105
1.0-9.0:1/2 36 _ 0.25
1.0-9.0:1/2 38 _ 0.25
`;
    const midi = compile(lmp);
    const parsed = parseMidi(midi);
    const notes = parsed.tracks[0].filter(e => e.type === 'noteOn');

    expect(notes.length).toBeGreaterThan(10);
    for (const note of notes) {
      if (note.noteNumber === 36) {
        expect(note.velocity).toBeGreaterThanOrEqual(65);
        expect(note.velocity).toBeLessThanOrEqual(75);
      } else if (note.noteNumber === 38) {
        expect(note.velocity).toBeGreaterThanOrEqual(100);
        expect(note.velocity).toBeLessThanOrEqual(105);
      }
    }
  });

  test('Explicit velocity overrides @RULE range even when seeded', () => {
    const lmp = `
@LMP 1.0
@BPM 120
@SEED 42
@TRACK 1 Groove
@CHANNEL 1
@RULE C4 VEL=40-50
1.0 C4 _ 1.0
2.0 C4 127 1.0
`;
    const midi = compile(lmp);
    const parsed = parseMidi(midi);
    const noteOns = parsed.tracks[0].filter(e => e.type === 'noteOn');

    expect(noteOns[0].velocity).toBeGreaterThanOrEqual(40);
    expect(noteOns[0].velocity).toBeLessThanOrEqual(50);
    // Explicit 127 must not be randomized
    expect(noteOns[1].velocity).toBe(127);
  });
});
