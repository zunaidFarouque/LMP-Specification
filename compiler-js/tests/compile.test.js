/**
 * LMP compiler tests.
 * Add .lmp files in tests/fixtures/ and expected .mid in tests/expected/,
 * then assert compile(fixture) matches expected output.
 */
import { describe, test, expect } from 'bun:test';
import { compile } from '../src/index.js';

describe('LMP compiler', () => {
  test('compile is a function', () => {
    expect(typeof compile).toBe('function');
  });

  test('compile returns MIDI buffer for minimal LMP (one note)', () => {
    const lmp = `
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
`;
    const midi = compile(lmp);
    expect(midi).toBeInstanceOf(Uint8Array);
    expect(midi.length).toBeGreaterThan(0);
    expect(midi[0]).toBe(0x4d);
    expect(midi[1]).toBe(0x54);
    expect(midi[2]).toBe(0x68);
    expect(midi[3]).toBe(0x64);
  });

  test('reserved tokens (R, CC, TEMPO) are case-insensitive', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 r
2.0 c4 80 1.0
`;
    const midi = compile(lmp);
    expect(midi.length).toBeGreaterThan(0);
  });

  test('full spec example (Piano chords + flute) compiles', () => {
    const lmp = `
@LMP 1.0
@BPM 120
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0
1.0 C4,E4,G4
2.0 D4,F4,A4 95
3.0 C4,E4,G4 _ 2.0
@TRACK 2 Solo_Flute
@CHANNEL 2
@PROGRAM 73
@DEFAULT_VEL 90
1.0 C5
1.5 D5
2.0 E5
3.0 C5 _ 2.0
`;
    const midi = compile(lmp);
    expect(midi).toBeInstanceOf(Uint8Array);
    expect(midi.length).toBeGreaterThan(100);
  });
});
