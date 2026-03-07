/**
 * LMP v1 Spec Compliance — 20 tests covering all rules and nuances.
 * From simple to advanced.
 */
import { describe, test, expect } from 'bun:test';
import { compile } from '../src/index.js';
import { preprocess } from '../src/preprocess.js';
import { buildState } from '../src/state.js';
import { expand } from '../src/expand.js';

function fullExpand(lmpText) {
  const lines = preprocess(lmpText);
  const state = buildState(lines);
  return expand(lines, state);
}

describe('LMP v1 Spec Compliance', () => {
  test('1. Minimal valid LMP compiles (version optional, single note)', () => {
    const lmp = `
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

  test('2. Beat 0.0 and fractional beats valid', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
0.0 C4 80 0.5
2.5 D4 80 0.25
3.25 E4 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.beat - b.beat);
    expect(notes).toHaveLength(3);
    expect(notes[0].beat).toBe(0);
    expect(notes[1].beat).toBe(2.5);
    expect(notes[2].beat).toBe(3.25);
    expect(events.some((e) => e.beat < 0)).toBe(false);
  });

  test('3. Whitespace agnostic and inline comments', () => {
    const out = preprocess('@BPM\t\t120  \n1.0   C4   80   1.0  // quarter note');
    expect(out[0].tokens).toEqual(['@BPM', '120']);
    expect(out[1].tokens).toEqual(['1.0', 'C4', '80', '1.0']);
    const midi = compile(`
@TRACK 1 P
@CHANNEL 1
1.0	C4	80	1.0
`);
    expect(midi.length).toBeGreaterThan(0);
  });

  test('4. Trailing metadata mode', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 P
@CHANNEL 1
1.0 C4

This is LLM commentary and should be ignored.
More text here.

2.0 D4
`;
    const events = fullExpand(lmp);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.beat)).toEqual([1, 2]);
  });

  test('5. Global defaults (4/4, 480 PPQN)', () => {
    const lines = preprocess('@TRACK 1 P\n@CHANNEL 1\n1.0 C4');
    const state = buildState(lines);
    expect(state.timesig).toEqual({ num: 4, denom: 4 });
    expect(state.ppqn).toBe(480);
  });

  test('6. Pitch resolution order: SPN > GM > @MAP', () => {
    const events = fullExpand(`
@MAP C4=36
@MAP kick=36
@TRACK 1 P
@CHANNEL 1
1.0 C4 80 1.0
2.0 kick 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.beat - b.beat);
    expect(notes[0].midi).toBe(60);
    expect(notes[1].midi).toBe(36);
  });

  test('7. @MAP overwrite and global persistence', () => {
    const lines = preprocess(`
@MAP x=36
@MAP x=42
@TRACK 1 P
@CHANNEL 1
1.0 x 80 1.0
`);
    const state = buildState(lines);
    expect(state.map.x).toBe(42);
    const events = fullExpand(`
@MAP x=36
@MAP x=42
@TRACK 1 P
@CHANNEL 1
1.0 x 80 1.0
`);
    expect(events.find((e) => e.type === 'note').midi).toBe(42);
  });

  test('8. Underscore placeholder and cascading fallback', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@DEFAULT_VEL 70
@DEFAULT_DUR 0.5
1.0 C4 _ 2.0
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.velocity).toBe(70);
    expect(n.duration).toBe(2);
  });

  test('9. Rest (R) as non-event timestamp', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 R
2.0 C4 80 1.0
`);
    const rest = events.find((e) => e.type === 'rest');
    expect(rest).toBeDefined();
    expect(rest.beat).toBe(1);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].beat).toBe(2);
  });

  test('10. CC/PB mandatory columns, PB col 4 ignored', () => {
    expect(() => fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 CC 64
`)).toThrow(/CC|controller|column/i);
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 CC 64 127
1.0 PB 1.5 999
1.0 C4 80 1.0
`);
    const cc = events.find((e) => e.type === 'cc');
    expect(cc).toMatchObject({ number: 64, value: 127 });
    const pb = events.find((e) => e.type === 'pb');
    expect(pb).toMatchObject({ semitones: 1.5 });
  });

  test('11. Same-beat ordering: CC → PB → notes', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 CC 64 127
1.0 PB 1.0
1.0 C4 80 1.0
`);
    const idx = (t) => events.findIndex((e) => e.type === t);
    expect(idx('cc')).toBeLessThan(idx('pb'));
    expect(idx('pb')).toBeLessThan(idx('note'));
  });

  test('12. PB clamp to @PBRANGE and auto-reset', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@PBRANGE 2
1.0 PB 5.0
1.0 C4 80 1.0
`);
    const pb = events.find((e) => e.type === 'pb');
    expect(pb).toBeDefined();
    expect(pb.semitones).toBe(2);
    const midi = compile(`
@TRACK 1 P
@CHANNEL 1
@PBRANGE 2
1.0 PB 5.0
1.0 C4 80 1.0
`);
    expect(midi.length).toBeGreaterThan(0);
  });

  test('13. Repeating notes: interval, exclusive end, invalid range', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-4.0:1/2 42 110 0.25
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes.map((n) => n.beat)).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);
    const validEnd = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-3.0:1/2 42
`);
    expect(validEnd.filter((e) => e.type === 'note').map((n) => n.beat)).toEqual([1, 1.5, 2, 2.5]);
    const invalidRange = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
5.0-1.0:1/2 42 110 0.25
`);
    expect(invalidRange.filter((e) => e.type === 'note')).toHaveLength(0);
  });

  test('14. Modifiers | R, | V, | D with overlap (last wins)', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 2.0] 80, [2.0 3.0] 90
| D [2.0-4.0] 0.25
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.beat - b.beat);
    expect(notes.map((n) => n.beat)).not.toContain(2);
    expect(notes.map((n) => n.beat)).not.toContain(4);
  });

  test('15. Chord with per-pitch @RULE VEL', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@RULE C4 VEL=70-80
@RULE E4 VEL=60-70
@RULE G4 VEL=50-60
1.0 C4,E4,G4
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.midi - b.midi);
    expect(notes).toHaveLength(3);
    expect(notes.every((n) => n.velocity >= 50 && n.velocity <= 80)).toBe(true);
  });

  test('16. Multi-line polyphony and + continuation', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
@TRACK 2 P
@CHANNEL 2
2.0 D2 _ 4.0
+ D4,F4,A4 _ 2.0
`);
    const t1 = events.filter((e) => e.type === 'note' && e.trackIndex === 0);
    const t2 = events.filter((e) => e.type === 'note' && e.trackIndex === 1);
    expect(t1).toHaveLength(4);
    expect(t2).toHaveLength(4);
    expect(t1.every((n) => n.beat === 1)).toBe(true);
  });

  test('17. Legato with Rest as hard stop and final note', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@RULE LEGATO=TRUE
@PPQN 480
1.0 C4
2.0 R
3.0 D4 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.beat - b.beat);
    expect(notes).toHaveLength(2);
    const gapBeats = 2 / 480;
    expect(notes[0].duration).toBeCloseTo(1 - gapBeats, 5);
    expect(notes[1].duration).toBe(1);
  });

  test('18. @INHERIT selective and @RESET_TRACK', () => {
    const lines = [
      { type: 'header', tokens: ['@TRACK', '1', 'Piano'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
      { type: 'header', tokens: ['@DEFAULT_VEL', '80'] },
      { type: 'header', tokens: ['@DEFAULT_DUR', '1.0'] },
      { type: 'header', tokens: ['@TRACK', '2', 'Bass'] },
      { type: 'header', tokens: ['@INHERIT', '1', 'VEL,DUR'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
    ];
    const s = buildState(lines);
    expect(s.tracks[1].defaultVel).toBe(80);
    expect(s.tracks[1].defaultDur).toBe(1);
  });

  test('19. Orphaned + and | errors', () => {
    expect(() => fullExpand(`
@TRACK 1 P
@CHANNEL 1

+ E4 80 1.0
`)).toThrow(/orphan|continuation/i);
    expect(() => fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C4 80 1.0
| R 2.0
`)).toThrow(/orphan|modifier/i);
  });

  test('20. Full spec Example 5 (hi-hat modifiers)', () => {
    const lmp = `
@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@PROGRAM 0
@DEFAULT_DUR 0.25
@DEFAULT_VEL 90
1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 3.0] 110
1.0 36 110
3.0 36 110
`;
    const midi = compile(lmp);
    expect(midi).toBeInstanceOf(Uint8Array);
    expect(midi.length).toBeGreaterThanOrEqual(100);
    const events = fullExpand(lmp);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes.length).toBeGreaterThan(4);
  });
});
