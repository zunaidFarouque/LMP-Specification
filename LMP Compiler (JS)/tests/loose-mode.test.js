/**
 * LMP Loose Mode — tests for compile(lmp, { loose: true })
 * Per spec: warnings instead of errors for recoverable violations.
 */
import { describe, test, expect } from 'bun:test';
import { compile } from '../src/index.js';
import { preprocess } from '../src/preprocess.js';
import { buildState } from '../src/state.js';
import { expand } from '../src/expand.js';

function fullExpand(lmpText, options = {}) {
  const lines = preprocess(lmpText);
  const opts = options?.loose ? { ...options, warnings: options.warnings ?? [] } : options;
  const state = buildState(lines, opts);
  return expand(lines, state, opts);
}

const minimalLmp = `
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
`;

describe('Loose Mode API', () => {
  test('compile(lmp) without options returns Uint8Array (backward compat)', () => {
    const result = compile(minimalLmp);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(0x4d);
    expect(result[1]).toBe(0x54);
  });

  test('compile(lmp, { loose: true }) returns { midi, warnings }', () => {
    const result = compile(minimalLmp, { loose: true });
    expect(result).toHaveProperty('midi');
    expect(result).toHaveProperty('warnings');
    expect(result.midi).toBeInstanceOf(Uint8Array);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test('loose mode with valid LMP returns empty warnings', () => {
    const result = compile(minimalLmp, { loose: true });
    expect(result.warnings).toHaveLength(0);
    expect(result.midi.length).toBeGreaterThan(0);
  });
});

describe('Loose Mode — missing @CHANNEL', () => {
  test('loose mode: @TRACK without @CHANNEL compiles, warns, uses channel 1', () => {
    const lmp = `
@TRACK 1 Piano
1.0 C4 80 1.0
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi).toBeInstanceOf(Uint8Array);
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /missing.*@CHANNEL|assuming channel 1/i.test(w))).toBe(true);
    const events = fullExpand(lmp, { loose: true });
    const note = events.find((e) => e.type === 'note');
    expect(note?.channel).toBe(1);
  });
});

describe('Loose Mode — invalid CC', () => {
  test('loose mode: CC with missing value (1.0 CC 64) warns and skips', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 CC 64
1.0 C4 80 1.0
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /CC|controller|value/i.test(w))).toBe(true);
    const events = fullExpand(lmp, { loose: true });
    expect(events.filter((e) => e.type === 'cc')).toHaveLength(0);
  });

  test('loose mode: CC with underscore (1.0 CC _ 127) warns and skips', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 CC _ 127
1.0 C4 80 1.0
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /CC|underscore|invalid/i.test(w))).toBe(true);
    const events = fullExpand(lmp, { loose: true });
    expect(events.filter((e) => e.type === 'cc')).toHaveLength(0);
  });
});

describe('Loose Mode — invalid PB', () => {
  test('loose mode: PB with missing col 3 (1.0 PB) warns and skips', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 PB
1.0 C4 80 1.0
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /PB|bend|invalid/i.test(w))).toBe(true);
    const events = fullExpand(lmp, { loose: true });
    expect(events.filter((e) => e.type === 'pb')).toHaveLength(0);
  });

  test('strict mode: PB with missing col 3 throws', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 PB
1.0 C4 80 1.0
`;
    expect(() => compile(lmp)).toThrow(/PB|bend|invalid/i);
  });
});

describe('Loose Mode — invalid repeating range', () => {
  test('loose mode: invalid range (5.0-1.0:1/2) warns and produces no notes', () => {
    const lmp = `
@TRACK 1 Drums
@CHANNEL 10
5.0-1.0:1/2 42 110 0.25
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /invalid.*range|start.*end|5\.0-1\.0/i.test(w))).toBe(true);
    const events = fullExpand(lmp, { loose: true });
    expect(events.filter((e) => e.type === 'note')).toHaveLength(0);
  });
});

describe('Loose Mode — @INHERIT from non-existent', () => {
  test('loose mode: @INHERIT from non-existent track warns and skips', () => {
    const lmp = `
@TRACK 1 Piano
@CHANNEL 1
@TRACK 2 Bass
@INHERIT 99
@CHANNEL 1
1.0 C2 80 1.0
`;
    const result = compile(lmp, { loose: true });
    expect(result.midi.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /INHERIT|non-existent|99/i.test(w))).toBe(true);
  });
});
