import { describe, test, expect } from 'bun:test';
import { compile, decompile, parseMidi } from '../src/index.js';
import { writeMidi } from 'midi-file';

describe('Track B: Decompiler & Lossless Roundtripping', () => {
  test('1. Preserve trackName meta-events from binary MIDI', () => {
    const midiData = {
      header: { format: 1, numTracks: 2, ticksPerBeat: 480 },
      tracks: [
        [
          { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 500000 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
        [
          { deltaTime: 0, type: 'trackName', text: 'Violin_Lead' },
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 40 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 90 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
      ],
    };
    const midiBuffer = new Uint8Array(writeMidi(midiData));
    const lmp = decompile(midiBuffer);

    expect(lmp).toContain('@TRACK 1 Violin_Lead');
    expect(lmp).not.toContain('Track_1');
  });

  test('2. Multi-line polyphony (+) when simultaneous notes differ in duration or velocity', () => {
    const lmpSource = `
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C2 100 4.0
+ C4,E4,G4 80 1.0
2.0 D4,F4,A4 80 1.0
`;
    const midi = compile(lmpSource);
    const decompiled = decompile(midi);

    // Should contain continuation syntax +
    expect(decompiled).toMatch(/\+ (C4,E4,G4|G4,E4,C4) 80 1/);

    // Roundtrip compiles cleanly and preserves notes
    const midi2 = compile(decompiled);
    const parsed = parseMidi(midi2);
    const noteOns = parsed.tracks[0].filter((e) => e.type === 'noteOn');
    expect(noteOns).toHaveLength(7); // C2, C4, E4, G4, D4, F4, A4
  });

  test('3. Skip conductor-only tracks (Track 0 with only tempo/timesig)', () => {
    const midiData = {
      header: { format: 1, numTracks: 2, ticksPerBeat: 480 },
      tracks: [
        // Track 0: Conductor only
        [
          { deltaTime: 0, type: 'trackName', text: 'Conductor' },
          { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: 428571 }, // ~140 BPM
          { deltaTime: 0, type: 'timeSignature', numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
        // Track 1: Acoustic Bass
        [
          { deltaTime: 0, type: 'trackName', text: 'Acoustic_Bass' },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 36, velocity: 100 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 36, velocity: 0 },
          { deltaTime: 0, type: 'endOfTrack' },
        ],
      ],
    };
    const midiBuffer = new Uint8Array(writeMidi(midiData));
    const lmp = decompile(midiBuffer);

    // Should only have 1 track in LMP (@TRACK 1 Acoustic_Bass), NOT 2 tracks
    expect(lmp).toContain('@BPM 140');
    expect(lmp).toContain('@TIMESIG 3/4');
    expect(lmp).toContain('@TRACK 1 Acoustic_Bass');
    expect(lmp).not.toContain('@TRACK 2');
    expect(lmp).not.toContain('Conductor');
  });

  test('4. Deduplicate tempo and time signature events between header and tick 0', () => {
    const lmpSource = `
@LMP 1.0
@BPM 128
@TIMESIG 4/4
@TRACK 1 Synth
@CHANNEL 1
1.0 C4 90 1.0
`;
    const midi = compile(lmpSource);
    const decompiled = decompile(midi);

    // Header has BPM and TIMESIG
    expect(decompiled).toContain('@BPM 128');
    expect(decompiled).toContain('@TIMESIG 4/4');

    // Body should NOT have redundant '1.0 TEMPO 128' or '1.0 TS 4 4'
    expect(decompiled).not.toMatch(/1\.0\s+TEMPO\s+128/);
    expect(decompiled).not.toMatch(/1\.0\s+TS\s+4\s+4/);
  });

  test('5. Smart quantization heuristics prevent legato tick gaps from cluttering decompiled text', () => {
    const lmpLegato = `
@LMP 1.0
@BPM 120
@TRACK 1 Flute
@CHANNEL 1
@DEFAULT_VEL 90
@RULE LEGATO=TRUE
1.0 C4
2.0 D4
3.0 E4 _ 1.0
`;
    const midi = compile(lmpLegato);
    const decompiled = decompile(midi);

    // Under legato, notes are generated with duration = 1.0 beat minus 2 ticks (478 ticks = 0.996 beats).
    // Smart quantization should quantize 478 ticks to 480 ticks (1.0 beats), avoiding '0.996'.
    expect(decompiled).not.toContain('0.996');
    expect(decompiled).toMatch(/1(\.0)?\s+C4\s+90\s+1/);
    expect(decompiled).toMatch(/2(\.0)?\s+D4\s+90\s+1/);
  });

  test('6. Complete round-trip compile-decompile-compile-decompile lossless equivalence', () => {
    const complexLmp = `
@LMP 1.0
@BPM 130
@TIMESIG 4/4
@PPQN 480
@TRACK 1 Bass
@CHANNEL 1
@PROGRAM 33
1.0 C2 105 0.5
1.5 D2 100 0.5
2.0 E2 110 1.0

@TRACK 2 Piano
@CHANNEL 2
@PROGRAM 0
1.0 C4,E4,G4 85 1.0
2.0 D4,F4,A4 90 2.0
`;
    const midi1 = compile(complexLmp);
    const lmp1 = decompile(midi1);
    const midi2 = compile(lmp1);
    const lmp2 = decompile(midi2);

    expect(lmp1).toBe(lmp2);

    // Verify parsed events match between midi1 and midi2
    const p1 = parseMidi(midi1);
    const p2 = parseMidi(midi2);
    expect(p1.tracks.length).toBe(p2.tracks.length);
  });

  test('7. Pitch bend and CC roundtrip lossless idempotency', () => {
    const lmpWithPB = `
@LMP 1.0
@BPM 140
@TIMESIG 4/4
@PPQN 480
@TRACK 1 Lead
@CHANNEL 1
@PBRANGE 12
1.0 PB 2.0
1.0 CC 64 127
1.0 C4 90 1.0
2.0 PB 0.0
2.0 D4 90 1.0
`;
    const m1 = compile(lmpWithPB);
    const l1 = decompile(m1);
    const m2 = compile(l1);
    const l2 = decompile(m2);

    expect(l1).toBe(l2);
    expect(l1).toContain('1 PB 2');
    expect(l1).toContain('1 CC 64 127');
    expect(l1).toContain('2 PB 0');
    // Ensure no duplicate PB at tick 0
    const matches = l1.match(/1\s+PB/g);
    expect(matches).toHaveLength(1);
  });

  test('8. Decompile respects custom precision options', () => {
    const lmpSource = `
@LMP 1.0
@BPM 120
@TRACK 1 Flute
@CHANNEL 1
1.333 C4 80 0.333
`;
    const midi = compile(lmpSource);
    const decompiled = decompile(midi, { precision: 2 });
    expect(decompiled).toContain('1.33 C4');
  });
});
