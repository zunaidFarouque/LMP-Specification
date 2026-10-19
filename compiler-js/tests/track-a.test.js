import { describe, test, expect } from 'bun:test';
import { compile, parseMidi } from '../src/index.js';
import { preprocess } from '../src/preprocess.js';
import { buildState, LMPError } from '../src/state.js';
import { expand } from '../src/expand.js';

describe('Track A: Compiler Core & Bug Fixes', () => {
  test('1. b - 1 vs 0.0 origin timeline mapping and @ORIGIN [0|1]', () => {
    // With @ORIGIN 0: beat 0.0 is tick 0, beat 1.0 is tick 480
    const lmp0 = `
@LMP 1.0
@ORIGIN 0
@TRACK 1 Piano
@CHANNEL 1
0.0 C4 80 1.0
1.0 D4 80 1.0
`;
    const midi0 = parseMidi(compile(lmp0));
    const track0Events = midi0.tracks[0].filter((e) => e.type === 'noteOn');
    expect(track0Events).toHaveLength(2);

    // Calculate absolute ticks
    let t = 0;
    const ticks0 = [];
    for (const ev of midi0.tracks[0]) {
      t += ev.deltaTime;
      if (ev.type === 'noteOn') ticks0.push({ note: ev.noteNumber, tick: t });
    }
    expect(ticks0[0].tick).toBe(0);
    expect(ticks0[1].tick).toBe(480);

    // Auto-origin detection: when beat < 1.0 is used without @ORIGIN header, origin defaults to 0
    const lmpAuto0 = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
0.0 C4 80 0.5
1.0 D4 80 0.5
`;
    const midiAuto = parseMidi(compile(lmpAuto0));
    t = 0;
    const ticksAuto = [];
    for (const ev of midiAuto.tracks[0]) {
      t += ev.deltaTime;
      if (ev.type === 'noteOn') ticksAuto.push({ note: ev.noteNumber, tick: t });
    }
    expect(ticksAuto[0].tick).toBe(0);
    expect(ticksAuto[1].tick).toBe(480);

    // With @ORIGIN 1: beat 1.0 is tick 0
    const lmp1 = `
@LMP 1.0
@ORIGIN 1
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
2.0 D4 80 1.0
`;
    const midi1 = parseMidi(compile(lmp1));
    t = 0;
    const ticks1 = [];
    for (const ev of midi1.tracks[0]) {
      t += ev.deltaTime;
      if (ev.type === 'noteOn') ticks1.push({ note: ev.noteNumber, tick: t });
    }
    expect(ticks1[0].tick).toBe(0);
    expect(ticks1[1].tick).toBe(480);
  });

  test('2. flatEvents.sort order [Tempo/TS, CC, PB, NoteOff, NoteOn] and chord low-to-high pitch', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
1.0 CC 64 127
1.0 PB 1.0
1.0 G4,C4,E4 80 1.0
2.0 C4 80 1.0
`;
    const parsed = parseMidi(compile(lmp));
    const eventsAtZero = [];
    let t = 0;
    for (const ev of parsed.tracks[0]) {
      t += ev.deltaTime;
      if (t === 0) eventsAtZero.push(ev);
    }
    // Expected order at tick 0: Tempo, TS, RPN CCs, CC 64, PB, then noteOn C4, E4, G4 in pitch order
    const types = eventsAtZero.map((e) => e.type);
    const firstNoteOnIndex = types.indexOf('noteOn');
    const ccIndex = types.lastIndexOf('controller');
    const pbIndex = types.indexOf('pitchBend');

    expect(ccIndex).toBeLessThan(firstNoteOnIndex);
    expect(pbIndex).toBeLessThan(firstNoteOnIndex);

    // Chords are sorted low to high pitch (C4=60, E4=64, G4=67)
    const noteOnsAtZero = eventsAtZero.filter((e) => e.type === 'noteOn');
    expect(noteOnsAtZero.map((e) => e.noteNumber)).toEqual([60, 64, 67]);

    // Check NoteOff before NoteOn at same tick (at tick 480: noteOff from beat 1.0 notes, noteOn for beat 2.0 note)
    const eventsAt480 = [];
    t = 0;
    for (const ev of parsed.tracks[0]) {
      t += ev.deltaTime;
      if (t === 480) eventsAt480.push(ev);
    }
    const typesAt480 = eventsAt480.map((e) => e.type);
    const lastNoteOffIdx = typesAt480.lastIndexOf('noteOff');
    const firstNoteOnIdxAt480 = typesAt480.indexOf('noteOn');
    expect(lastNoteOffIdx).toBeLessThan(firstNoteOnIdxAt480);
  });

  test('3. Fix pitch bend auto-reset to account for note durations', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 Lead
@CHANNEL 1
1.0 PB 1.0
1.0 C4 80 2.0
`;
    // Note ends at tick 480 * 2 = 960. Auto-reset PB 0.0 must be placed at maxTick + 1 = 961.
    const parsed = parseMidi(compile(lmp));
    let t = 0;
    let autoResetPbTick = null;
    let noteOffTick = null;
    for (const ev of parsed.tracks[0]) {
      t += ev.deltaTime;
      if (ev.type === 'noteOff') noteOffTick = t;
      if (ev.type === 'pitchBend' && t > 0) autoResetPbTick = t;
    }
    expect(noteOffTick).toBe(960);
    expect(autoResetPbTick).toBe(961);
    expect(autoResetPbTick).toBeGreaterThan(noteOffTick);
  });

  test('4. Modifier V and D fuzzy beat matching using beatsMatch', () => {
    // Repeating triplets: 1.0, 1.333, 1.667...
    const lmp = `
@LMP 1.0
@TRACK 1 Drums
@CHANNEL 10
1.0-3.0:1/3 42 70 0.25
| V 1.333 115, [1.667-2.5] 95
| D 1.333 0.1
`;
    const lines = preprocess(lmp);
    const state = buildState(lines);
    const events = expand(lines, state);
    const notes = events.filter((e) => e.type === 'note');

    // 1.333 note should have velocity 115 and duration 0.1
    const n1333 = notes.find((n) => Math.abs(n.beat - 1.333) < 0.02);
    expect(n1333).toBeDefined();
    expect(n1333.velocity).toBe(115);
    expect(n1333.duration).toBe(0.1);

    // Note at 1.667 and 2.0 should be covered by range [1.667-2.5] -> velocity 95
    const n1667 = notes.find((n) => Math.abs(n.beat - 1.667) < 0.02);
    expect(n1667).toBeDefined();
    expect(n1667.velocity).toBe(95);
  });

  test('5. Harmonize state inheritance: @DEFAULT_VEL, @DEFAULT_DUR, and @RULE persist across tracks', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
@DEFAULT_VEL 85
@DEFAULT_DUR 1.5
@RULE 42 VEL=70-80

@TRACK 2 Strings
@CHANNEL 2
1.0 C4
2.0 42
`;
    const lines = preprocess(lmp);
    const state = buildState(lines);
    expect(state.tracks[1].defaultVel).toBe(85);
    expect(state.tracks[1].defaultDur).toBe(1.5);
    expect(state.tracks[1].rules).toHaveLength(1);

    const events = expand(lines, state);
    const track2Notes = events.filter((e) => e.type === 'note' && e.trackIndex === 1);
    expect(track2Notes[0].velocity).toBe(85);
    expect(track2Notes[0].duration).toBe(1.5);
    expect(track2Notes[1].velocity).toBe(75); // midpoint of 70-80

    // @RESET_TRACK clears them
    const lmpReset = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
@DEFAULT_VEL 85
@DEFAULT_DUR 1.5
@RULE 42 VEL=70-80

@TRACK 2 ResetTrack
@RESET_TRACK
@CHANNEL 2
1.0 C4
`;
    const linesReset = preprocess(lmpReset);
    const stateReset = buildState(linesReset);
    expect(stateReset.tracks[1].defaultVel).toBeUndefined();
    expect(stateReset.tracks[1].defaultDur).toBeUndefined();
    expect(stateReset.tracks[1].rules).toHaveLength(0);
  });

  test('6. Ensure blank lines terminate continuations and modifiers per spec', () => {
    // Blank line before continuation -> orphaned error
    const lmpCont = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0

+ E4 80 1.0
`;
    expect(() => compile(lmpCont)).toThrow(/orphaned.*continuation/i);

    // Comment line does NOT terminate continuation
    const lmpCommentCont = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
// comment visual spacing
+ E4 80 1.0
`;
    expect(() => compile(lmpCommentCont)).not.toThrow();

    // Blank line before modifier -> orphaned error
    const lmpMod = `
@LMP 1.0
@TRACK 1 Drums
@CHANNEL 10
1.0-4.0:1/2 42

| R 2.0
`;
    expect(() => compile(lmpMod)).toThrow(/orphaned.*modifier/i);
  });

  test('7. Filter out markdown numbered list prefixes from trailing mode', () => {
    const lmpWithMarkdown = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0

Here is what I did:
1. First note was C4
2) Second note was great
3. Final note
`;
    const lines = preprocess(lmpWithMarkdown);
    const state = buildState(lines);
    const events = expand(lines, state);
    const notes = events.filter((e) => e.type === 'note');
    // Only C4 should exist; the markdown numbered lists should not produce phantom notes
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
  });

  test('8. Attach { line, col } to compiler error diagnostics', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 Piano
@CHANNEL 1
   1.0 CC _ 127
`;
    try {
      compile(lmp);
      expect(true).toBe(false); // Should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.line).toBe(5);
      expect(err.col).toBe(4);
    }
  });

  test('9. compiler-js package.json does not contain midi-writer-js', async () => {
    const pkg = await import('../package.json');
    expect(pkg.dependencies['midi-writer-js']).toBeUndefined();
  });

  test('10. Emit RPN 00 00 pitch bend range sensitivity configuration', () => {
    const lmp = `
@LMP 1.0
@TRACK 1 Lead
@CHANNEL 1
@PBRANGE 12
1.0 PB 2.0
1.0 C4 80 1.0
`;
    const parsed = parseMidi(compile(lmp));
    const ccs = parsed.tracks[0].filter((e) => e.type === 'controller');
    // RPN sequence: CC 101 = 0, CC 100 = 0, CC 6 = 12, CC 38 = 0
    const cc101 = ccs.find((e) => e.controllerType === 101 && e.value === 0);
    const cc100 = ccs.find((e) => e.controllerType === 100 && e.value === 0);
    const cc6 = ccs.find((e) => e.controllerType === 6 && e.value === 12);
    const cc38 = ccs.find((e) => e.controllerType === 38 && e.value === 0);

    expect(cc101).toBeDefined();
    expect(cc100).toBeDefined();
    expect(cc6).toBeDefined();
    expect(cc38).toBeDefined();
  });
});
