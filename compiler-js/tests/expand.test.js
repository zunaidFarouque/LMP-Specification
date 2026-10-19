/**
 * LMP Pass 3: Expand — event list from preprocessed lines + state.
 */
import { describe, test, expect } from 'bun:test';
import { preprocess } from '../src/preprocess.js';
import { buildState } from '../src/state.js';
import { expand } from '../src/expand.js';

function fullExpand(lmpText) {
  const lines = preprocess(lmpText);
  const state = buildState(lines);
  return expand(lines, state);
}

describe('expand', () => {
  test('basic note row: beat, pitch (SPN), vel, len', () => {
    const events = fullExpand(`
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ beat: 1, midi: 60, velocity: 80, duration: 1 });
  });

  test('C4 = 60 (SPN)', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
0.0 C4 100 0.5
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.midi).toBe(60);
  });

  test('GM integer pitch (percussive)', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0 36 100 0.25
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.midi).toBe(36);
  });

  test('negative beat invalid (skip or error)', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C4 80 1.0
`);
    expect(events.some((e) => e.beat < 0)).toBe(false);
  });

  test('omitted velocity/duration use track defaults', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@DEFAULT_VEL 90
@DEFAULT_DUR 2.0
1.0 C4
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.velocity).toBe(90);
    expect(n.duration).toBe(2);
  });

  test('underscore in column 3 triggers velocity fallback', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@DEFAULT_VEL 70
@DEFAULT_DUR 0.5
1.0 C4 _ 1.0
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.velocity).toBe(70);
    expect(n.duration).toBe(1);
  });

  test('Rest (R) emits rest event, no note', () => {
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

  test('CC emits control change event', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 CC 64 127
1.0 C4 80 1.0
`);
    const cc = events.find((e) => e.type === 'cc');
    expect(cc).toMatchObject({ beat: 1, number: 64, value: 127 });
    expect(events.findIndex((e) => e.type === 'cc')).toBeLessThan(events.findIndex((e) => e.type === 'note'));
  });

  test('PB emits pitch bend event', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 PB 1.5
1.0 C4 80 1.0
`);
    const pb = events.find((e) => e.type === 'pb');
    expect(pb).toMatchObject({ beat: 1, semitones: 1.5 });
  });

  test('TEMPO and TS emit meta events', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
0.0 TEMPO 140
4.0 TS 3 4
`);
    expect(events.find((e) => e.type === 'tempo')).toMatchObject({ beat: 0, bpm: 140 });
    expect(events.find((e) => e.type === 'ts')).toMatchObject({ beat: 4, num: 3, denom: 4 });
  });

  test('repeating note syntax expands to beat list (exclusive end)', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-3.0:1/2 42 110 0.25
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.beat)).toEqual([1, 1.5, 2, 2.5]);
  });

  test('modifier | R skips beats', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-4.0:1/2 42
| R 2.0 3.0
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes.map((n) => n.beat)).not.toContain(2);
    expect(notes.map((n) => n.beat)).not.toContain(3);
  });

  test('same-beat continuation + inherits beat', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C5 80 4.0
+ E5,G5 80 2.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.midi - b.midi);
    expect(notes).toHaveLength(3);
    expect(notes.every((n) => n.beat === 1)).toBe(true);
  });

  test('chordal polyphony (comma-separated) expands to multiple notes at same beat', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C4,E4,G4 85 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.midi - b.midi);
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    expect(notes.every((n) => n.beat === 1)).toBe(true);
  });

  test('@MAP name resolves to MIDI', () => {
    const events = fullExpand(`
@MAP kick=36
@TRACK 1 Drums
@CHANNEL 10
1.0 kick 100 0.25
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.midi).toBe(36);
  });

  test('@RULE Pitch DUR=x sets duration for that pitch', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@RULE 36 DUR=1.0
1.0 36
`);
    const n = events.find((e) => e.type === 'note');
    expect(n.duration).toBe(1);
  });

  test('TEMPO before any @TRACK throws', () => {
    const lmp = `
@LMP 1.0
0.0 TEMPO 120
@TRACK 1 P
@CHANNEL 1
1.0 C4
`;
    expect(() => fullExpand(lmp)).toThrow(/TEMPO|track|first/i);
  });

  test('_ in CC row throws', () => {
    const lmp = `
@TRACK 1 P
@CHANNEL 1
1.0 CC _ 127
`;
    expect(() => fullExpand(lmp)).toThrow(/CC|mandatory|invalid|_/i);
  });

  test('@RULE LEGATO=TRUE extends duration to next event minus gap', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
@RULE LEGATO=TRUE
@PPQN 480
1.0 C4
2.0 D4
3.0 E4 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.beat - b.beat);
    expect(notes).toHaveLength(3);
    const gapBeats = 2 / 480;
    expect(notes[0].duration).toBeCloseTo(1 - gapBeats, 5);
    expect(notes[1].duration).toBeCloseTo(1 - gapBeats, 5);
    expect(notes[2].duration).toBe(1);
  });

  test('whitespace in chords parses all notes into chord list', () => {
    const events = fullExpand(`
@TRACK 1 P
@CHANNEL 1
1.0 C4, E4, G4, B4 80 1.0
`);
    const notes = events.filter((e) => e.type === 'note').sort((a, b) => a.midi - b.midi);
    expect(notes).toHaveLength(4);
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67, 71]);
    expect(notes.every((n) => n.velocity === 80)).toBe(true);
    expect(notes.every((n) => n.duration === 1.0)).toBe(true);
  });

  test('bracketed modifier with commas (| V [1.5, 2.5, 3.5] 110)', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42 80 0.25
| V [1.5, 2.5, 3.5] 110
`);
    const notes = events.filter((e) => e.type === 'note');
    const accented = notes.filter((n) => n.velocity === 110);
    expect(accented.map((n) => n.beat)).toEqual([1.5, 2.5, 3.5]);
  });

  test('case-insensitive modifier kinds (| r, | v, | d)', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42 80 0.25
| r 2.0 4.0
| v [1.5 2.5] 115
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes.map((n) => n.beat)).not.toContain(2.0);
    expect(notes.map((n) => n.beat)).not.toContain(4.0);
    const v115 = notes.filter((n) => n.velocity === 115);
    expect(v115.map((n) => n.beat)).toEqual([1.5, 2.5]);
  });

  test('repeating range expansion on CC, PB, and R', () => {
    const events = fullExpand(`
@TRACK 1 Synth
@CHANNEL 1
1.0-3.0:1/2 CC 11 60
1.0-3.0:1/2 PB 1.5
1.0-3.0:1/2 R
`);
    const ccs = events.filter((e) => e.type === 'cc');
    const pbs = events.filter((e) => e.type === 'pb');
    const rests = events.filter((e) => e.type === 'rest');
    expect(ccs).toHaveLength(4);
    expect(ccs.map((c) => c.beat)).toEqual([1.0, 1.5, 2.0, 2.5]);
    expect(ccs.every((c) => c.number === 11 && c.value === 60)).toBe(true);

    expect(pbs).toHaveLength(4);
    expect(pbs.map((p) => p.beat)).toEqual([1.0, 1.5, 2.0, 2.5]);
    expect(pbs.every((p) => p.semitones === 1.5)).toBe(true);

    expect(rests).toHaveLength(4);
    expect(rests.map((r) => r.beat)).toEqual([1.0, 1.5, 2.0, 2.5]);
  });

  test('repeating notes immediately before header are flushed and preserved', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/4 42
| R 2.0
@TRACK 2 Bass
@CHANNEL 1
1.0 C2 100 1.0
`);
    const track1Notes = events.filter((e) => e.type === 'note' && e.trackIndex === 0);
    const track2Notes = events.filter((e) => e.type === 'note' && e.trackIndex === 1);
    expect(track1Notes).toHaveLength(15);
    expect(track2Notes).toHaveLength(1);
  });

  test('bracketed and comma-separated rest modifiers (| R [2.0, 4.0])', () => {
    const events = fullExpand(`
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42
| R [2.0, 4.0]
`);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(6);
    expect(notes.map((n) => n.beat)).not.toContain(2.0);
    expect(notes.map((n) => n.beat)).not.toContain(4.0);
  });

  test('chord tokens merged when comma is tokenized separately', () => {
    const lines = [
      { type: 'header', tokens: ['@TRACK', '1', 'Piano'] },
      { type: 'header', tokens: ['@CHANNEL', '1'] },
      { type: 'event', tokens: ['1.0', 'C4', ',', 'E4', '80', '1.0'] },
    ];
    const state = buildState(lines);
    const events = expand(lines, state);
    const notes = events.filter((e) => e.type === 'note');
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.midi)).toEqual([60, 64]);
  });
});
