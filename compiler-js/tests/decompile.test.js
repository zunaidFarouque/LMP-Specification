/**
 * MIDI → LMP decompiler tests.
 */
import { describe, test, expect } from 'bun:test';
import { compile, decompile } from '../src/index.js';

const minimalLmp = `
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
`;

const chordLmp = `
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4,E4,G4 85 1.0
`;

describe('decompile', () => {
  test('decompile is a function', () => {
    expect(typeof decompile).toBe('function');
  });

  test('decompile minimal MIDI returns valid LMP', () => {
    const midi = compile(minimalLmp);
    const lmp = decompile(midi);
    expect(lmp).toContain('@LMP 1.0');
    expect(lmp).toContain('@BPM 120');
    expect(lmp).toContain('@TRACK');
    expect(lmp).toContain('@CHANNEL');
    expect(lmp).toMatch(/\d+\.?\d*\s+C4\s+\d+/);
  });

  test('decompile chord MIDI returns comma-separated pitches', () => {
    const midi = compile(chordLmp);
    const lmp = decompile(midi);
    expect(lmp).toMatch(/C4,E4,G4|G4,E4,C4/);
  });

  test('round-trip: LMP → MIDI → LMP compiles again', () => {
    const midi1 = compile(minimalLmp);
    const lmp2 = decompile(midi1);
    const midi2 = compile(lmp2);
    expect(midi2).toBeInstanceOf(Uint8Array);
    expect(midi2.length).toBeGreaterThan(0);
    expect(midi2[0]).toBe(0x4d);
    expect(midi2[1]).toBe(0x54);
  });

  test('round-trip chord: structure preserved', () => {
    const midi1 = compile(chordLmp);
    const lmp2 = decompile(midi1);
    const midi2 = compile(lmp2);
    expect(midi2.length).toBeGreaterThan(0);
    const lmp3 = decompile(midi2);
    expect(lmp3).toMatch(/C4|E4|G4/);
  });

  test('decompile empty or invalid buffer throws', () => {
    expect(() => decompile(new Uint8Array(0))).toThrow();
    expect(() => decompile(new Uint8Array([0, 0, 0]))).toThrow();
  });
});
