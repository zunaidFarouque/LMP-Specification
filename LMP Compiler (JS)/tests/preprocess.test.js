/**
 * LMP Pass 1: Preprocess — unit tests.
 * Strip // comments, blank/trailing mode, split on /\s+/.
 */
import { describe, test, expect } from 'bun:test';
import { preprocess } from '../src/preprocess.js';

describe('preprocess', () => {
  test('strip // and rest of line', () => {
    const out = preprocess('@LMP 1.0 // version\n1.0 C4 80 1.0 // note');
    expect(out).toHaveLength(2);
    expect(out[0].tokens).toEqual(['@LMP', '1.0']);
    expect(out[1].tokens).toEqual(['1.0', 'C4', '80', '1.0']);
  });

  test('split on one or more whitespace', () => {
    const out = preprocess('@BPM  120\t\t\n1.0   C4   80   1.0');
    expect(out[0].tokens).toEqual(['@BPM', '120']);
    expect(out[1].tokens).toEqual(['1.0', 'C4', '80', '1.0']);
  });

  test('blank line triggers trailing mode', () => {
    const out = preprocess('@LMP 1.0\n\nThis is ignored text\nAnd this too\n\n2.0 C4');
    expect(out.map((l) => l.tokens[0])).toEqual(['@LMP', '2.0']);
  });

  test('trailing mode resumes on @', () => {
    const out = preprocess('@LMP 1.0\n\ncomment\n@BPM 120');
    expect(out).toHaveLength(2);
    expect(out[1].tokens).toEqual(['@BPM', '120']);
  });

  test('trailing mode resumes on digit (event line)', () => {
    const out = preprocess('@LMP 1.0\n\ncomment\n1.0 C4');
    expect(out).toHaveLength(2);
    expect(out[1].tokens).toEqual(['1.0', 'C4']);
  });

  test('trailing mode resumes on +', () => {
    const out = preprocess('1.0 C4\n\ncomment\n+ E4');
    expect(out[1].tokens[0]).toBe('+');
  });

  test('trailing mode resumes on |', () => {
    const out = preprocess('1.0-2.0:1/2 42\n\ncomment\n| R 1.5');
    expect(out[1].tokens[0]).toBe('|');
  });

  test('line types: header, event, continuation, modifier', () => {
    const out = preprocess('@BPM 120\n1.0 C4\n+ E4\n1.0-2.0:1/2 42\n| R 1.5');
    expect(out[0].type).toBe('header');
    expect(out[1].type).toBe('event');
    expect(out[2].type).toBe('continuation');
    expect(out[3].type).toBe('event');
    expect(out[4].type).toBe('modifier');
  });

  test('empty or whitespace-only line is blank', () => {
    const out = preprocess('@LMP 1.0\n   \n\t\n2.0 C4');
    expect(out.map((l) => l.tokens[0])).toEqual(['@LMP', '2.0']);
  });
});
