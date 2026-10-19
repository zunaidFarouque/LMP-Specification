import { describe, test, expect } from 'bun:test';
import { lintLmpDocument } from '../src/core/linter';

describe('LMP Linter and Syntax Checker', () => {
  test('returns no errors for valid LMP document', () => {
    const validCode = `@LMP 2.0
@BPM 120
@TIMESIG 4/4
@DEFAULT_VEL 90
@DEFAULT_DUR 1.0

@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
1.0   C4   80   1.0
2.0   E4   80   1.0
`;
    const diagnostics = lintLmpDocument(validCode);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  test('flags unknown directives with helpful error message', () => {
    const code = `@BPM 120
@INVALID_DIRECTIVE 123
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.includes('@INVALID_DIRECTIVE'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(2);
  });

  test('accepts valid @DEFAULT_VEL and @DEFAULT_DUR directives', () => {
    const code = `@TRACK 1 Keys
@CHANNEL 1
@DEFAULT_VEL 95
@DEFAULT_DUR 0.5
1.0 C4 _ _`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  test('flags invalid @TRACK missing track name', () => {
    const code = `@TRACK 1\n@CHANNEL 1\n1.0 C4 80 1.0\n`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.includes('@TRACK requires a name') || d.line === 1);
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  test('flags invalid event line with non-beat first token', () => {
    const code = `@TRACK 1 Piano\n@CHANNEL 1\nfoobar C4 80 1.0\n`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.line === 3);
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.message.toLowerCase()).toContain('invalid event line');
  });

  test('correctly validates CC events and allows value 0 without duration error', () => {
    const code = `@TRACK 1 Synth
@CHANNEL 1
1.0 CC 7 0
2.0 CC 10 64
3.0 CC 7 127
`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  test('flags invalid CC controller number or value out of 0-127 range', () => {
    const code = `@TRACK 1 Synth\n@CHANNEL 1\n1.0 CC 200 64\n2.0 CC 7 300\n`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(2);
  });

  test('correctly validates PB pitch bend events with negative and positive semitones', () => {
    const code = `@TRACK 1 Lead
@CHANNEL 1
1.0 PB -2.0
2.0 PB 2.0
3.0 PB 0
`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  test('correctly validates TEMPO events with positive BPM', () => {
    const code = `@TRACK 1 Song
@CHANNEL 1
1.0 TEMPO 130
`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  test('flags invalid repeating range when start beat is greater than or equal to end beat', () => {
    const code = `@TRACK 1 Drums\n@CHANNEL 10\n5.0-1.0:1/4 36\n`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.line === 3);
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.message.toLowerCase()).toContain('repeating range');
  });

  test('flags invalid @BPM (non-numeric or negative)', () => {
    const code = `@BPM -20
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('bpm'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(1);
  });

  test('flags invalid @TIMESIG (bad fraction format)', () => {
    const code = `@TIMESIG invalid
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('time signature'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(1);
  });

  test('flags invalid @CHANNEL (out of 1-16 range)', () => {
    const code = `@TRACK 1 Piano
@CHANNEL 25
1.0 C4 80 1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('channel'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(2);
  });

  test('flags invalid @PROGRAM (out of 0-127 range)', () => {
    const code = `@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 200
1.0 C4 80 1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('program'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(3);
  });

  test('flags events that appear before any @TRACK declaration', () => {
    const code = `1.0 C4 80 1.0
@TRACK 1 Piano
@CHANNEL 1`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.includes('@TRACK'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(1);
  });

  test('flags invalid pitch token (e.g. H4, C12 out of range)', () => {
    const code = `@TRACK 1 Piano
@CHANNEL 1
1.0   H4   80   1.0
2.0   C12  80   1.0`;
    const diagnostics = lintLmpDocument(code);
    const h4Err = diagnostics.find((d) => d.line === 3);
    const c12Err = diagnostics.find((d) => d.line === 4);
    expect(h4Err).toBeDefined();
    expect(c12Err).toBeDefined();
  });

  test('flags invalid velocity (out of 0-127 range or non-number)', () => {
    const code = `@TRACK 1 Piano
@CHANNEL 1
1.0   C4   250   1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('velocity'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(3);
  });

  test('flags invalid duration (<= 0 or non-number)', () => {
    const code = `@TRACK 1 Piano
@CHANNEL 1
1.0   C4   80   -1.0`;
    const diagnostics = lintLmpDocument(code);
    const err = diagnostics.find((d) => d.message.toLowerCase().includes('duration'));
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.line).toBe(3);
  });

  test('provides exact character offsets from and to for CodeMirror decoration', () => {
    const code = `@TRACK 1 Piano\n@CHANNEL 1\n1.0  INVALID_PITCH  80  1.0`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.length).toBeGreaterThan(0);
    const d = diagnostics[0];
    expect(d.from).toBeGreaterThanOrEqual(0);
    expect(d.to).toBeGreaterThan(d.from);
  });

  test('accepts valid @MAP definitions and allows mapped alias note pitches', () => {
    const code = `@TRACK 1 Drums
@CHANNEL 10
@MAP kick=36
@MAP snare=38
1.0   kick   100   0.5
2.0   snare  95    0.5
3.0   kick,snare  100  0.5`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.length).toBe(0);
  });

  test('flags invalid @MAP definition (bad format or out-of-range MIDI number)', () => {
    const code = `@TRACK 1 Drums
@CHANNEL 10
@MAP invalid_format_without_number
@MAP bad_midi=199`;
    const diagnostics = lintLmpDocument(code);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0].message).toContain('@MAP');
    expect(diagnostics[1].message).toContain('MIDI number');
  });
});
