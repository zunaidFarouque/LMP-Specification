/**
 * Utils: SPN ↔ MIDI, beat → ticks.
 */
import { describe, test, expect } from 'bun:test';
import { spnToMidi, beatToTicks, midiToSpn, ticksToBeat } from '../src/utils.js';

describe('spnToMidi', () => {
  test('C4 equals 60', () => {
    expect(spnToMidi('C4')).toBe(60);
  });

  test('F#3, Gb3 same pitch', () => {
    expect(spnToMidi('F#3')).toBe(54);
    expect(spnToMidi('Gb3')).toBe(54);
  });

  test('GM range 0-127', () => {
    expect(spnToMidi('C-1')).toBe(0);
    expect(spnToMidi('G9')).toBe(127);
  });
});

describe('beatToTicks', () => {
  test('1.0 beat at 120 BPM 480 PPQN = 480 ticks', () => {
    expect(beatToTicks(1.0, 120, 480)).toBe(480);
  });

  test('rounds to nearest integer', () => {
    const t = beatToTicks(1.333, 120, 480);
    expect(Number.isInteger(t)).toBe(true);
  });
});

describe('midiToSpn', () => {
  test('60 equals C4', () => {
    expect(midiToSpn(60)).toBe('C4');
  });

  test('36 equals C2', () => {
    expect(midiToSpn(36)).toBe('C2');
  });

  test('69 equals A4', () => {
    expect(midiToSpn(69)).toBe('A4');
  });

  test('invalid returns undefined', () => {
    expect(midiToSpn(-1)).toBeUndefined();
    expect(midiToSpn(128)).toBeUndefined();
    expect(midiToSpn('60')).toBeUndefined();
  });
});

describe('ticksToBeat', () => {
  test('480 ticks at 480 PPQN = 1 beat', () => {
    expect(ticksToBeat(480, 480)).toBe(1);
  });

  test('rounds to 3 decimals', () => {
    expect(ticksToBeat(160, 480)).toBe(0.333);
  });
});
