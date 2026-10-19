import { describe, test, expect } from 'bun:test';
import {
  parseLmpDocument,
  patchNote,
  insertNote,
  deleteNote,
  patchTrackHeader,
  createNewTrackBlock,
  midiToSpn,
  spnToMidi,
  parseDrumMapText,
  extractTrackDrumMaps,
  patchTrackDrumMap,
} from '../src/core/sourceMapBridge';
import type { StudioNote } from '../src/core/types';

describe('sourceMapBridge', () => {
  describe('MIDI <-> SPN conversions', () => {
    test('converts MIDI note numbers to SPN pitches accurately', () => {
      expect(midiToSpn(60)).toBe('C4');
      expect(midiToSpn(69)).toBe('A4');
      expect(midiToSpn(36)).toBe('C2');
      expect(midiToSpn(127)).toBe('G9');
      expect(midiToSpn(-1)).toBe('C4'); // clamped / safe fallback
    });

    test('converts SPN pitch strings to MIDI numbers accurately', () => {
      expect(spnToMidi('C4')).toBe(60);
      expect(spnToMidi('A4')).toBe(69);
      expect(spnToMidi('C#4')).toBe(61);
      expect(spnToMidi('Db4')).toBe(61);
      expect(spnToMidi('36')).toBe(36); // GM drum integer
      expect(spnToMidi('')).toBe(60);
    });
  });

  describe('parseLmpDocument', () => {
    test('parses single track with chords and notes correctly', () => {
      const code = `@LMP 2.0
@BPM 120
@TIMESIG 4/4

@TRACK 1 Chords
@CHANNEL 1
@PROGRAM 4
1.0   C4,E4,G4   80   2.0
3.0   D4         90   1.0
`;
      const parsed = parseLmpDocument(code);
      expect(parsed.bpm).toBe(120);
      expect(parsed.timeSig).toEqual([4, 4]);
      expect(parsed.tracks.length).toBe(1);
      expect(parsed.tracks[0].id).toBe(1);
      expect(parsed.tracks[0].name).toBe('Chords');
      expect(parsed.tracks[0].channel).toBe(1);
      expect(parsed.tracks[0].program).toBe(4);
      // Chords are expanded into multiple notes
      expect(parsed.tracks[0].notes.length).toBe(4);
      expect(parsed.tracks[0].notes.map((n) => n.pitch)).toContain('C4');
      expect(parsed.tracks[0].notes.map((n) => n.pitch)).toContain('E4');
      expect(parsed.tracks[0].notes.map((n) => n.pitch)).toContain('G4');
      expect(parsed.tracks[0].notes.map((n) => n.pitch)).toContain('D4');
    });

    test('parses multiple tracks correctly', () => {
      const code = `@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0

@TRACK 2 Bass
@CHANNEL 2
@PROGRAM 36
1.0 C2 100 0.5
`;
      const parsed = parseLmpDocument(code);
      expect(parsed.tracks.length).toBe(2);
      expect(parsed.tracks[0].id).toBe(1);
      expect(parsed.tracks[1].id).toBe(2);
      expect(parsed.tracks[1].program).toBe(36);
    });
  });

  describe('patchNote - Chronological Re-ordering on Drag', () => {
    test('maintains chronological order when dragging a note forward past other notes', () => {
      const code = `@LMP 2.0
@TRACK 1 Keys
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0
4.0   E4   80   1.0
5.0   F4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_62',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 5, // line 5 is "2.0   D4   80   1.0"
        colStart: 0,
        colEnd: 17,
      };

      // Drag note from beat 2.0 to 5.5 (after 5.0)
      const patched = patchNote(code, note, { beat: 5.5 });
      const lines = patched.trim().split('\n');

      // The line with D4 should now appear AFTER 5.0 F4
      const d4LineIdx = lines.findIndex((l) => l.includes('D4'));
      const f4LineIdx = lines.findIndex((l) => l.includes('F4'));
      const e4LineIdx = lines.findIndex((l) => l.includes('E4'));
      const c4LineIdx = lines.findIndex((l) => l.includes('C4'));

      expect(c4LineIdx).toBeLessThan(e4LineIdx);
      expect(e4LineIdx).toBeLessThan(f4LineIdx);
      expect(f4LineIdx).toBeLessThan(d4LineIdx);
      expect(lines[d4LineIdx]).toMatch(/^5\.5\s+D4/);
    });

    test('maintains chronological order when dragging a note backward before other notes', () => {
      const code = `@TRACK 1 Keys
@CHANNEL 1
2.0   D4   80   1.0
4.0   E4   80   1.0
6.0   G4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_6.0_67',
        trackId: 1,
        pitch: 'G4',
        midiNumber: 67,
        beat: 6.0,
        duration: 1.0,
        velocity: 80,
        line: 5, // line 5 is "6.0   G4   80   1.0"
        colStart: 0,
        colEnd: 17,
      };

      // Drag note from beat 6.0 to 3.0 (between 2.0 and 4.0)
      const patched = patchNote(code, note, { beat: 3.0 });
      const lines = patched.trim().split('\n');

      const d4LineIdx = lines.findIndex((l) => l.includes('D4'));
      const g4LineIdx = lines.findIndex((l) => l.includes('G4'));
      const e4LineIdx = lines.findIndex((l) => l.includes('E4'));

      expect(d4LineIdx).toBeLessThan(g4LineIdx);
      expect(g4LineIdx).toBeLessThan(e4LineIdx);
      expect(lines[g4LineIdx]).toMatch(/^3\.0\s+G4/);
    });

    test('dragging one note out of a chord extracts it to its own line at the new beat', () => {
      const code = `@TRACK 1 Chords
@CHANNEL 1
1.0   C4,E4,G4   80   2.0
4.0   D4,F4,A4   80   2.0
`;
      const note: StudioNote = {
        id: 'note_1_3_1.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 1.0,
        duration: 2.0,
        velocity: 80,
        line: 3,
        colStart: 0,
        colEnd: 25,
      };

      // Drag E4 to beat 2.5
      const patched = patchNote(code, note, { beat: 2.5 });
      const lines = patched.trim().split('\n');

      // Original chord line should retain C4,G4
      const chordLine = lines.find((l) => l.includes('1.0') && l.includes('C4'));
      expect(chordLine).toBeDefined();
      expect(chordLine).toContain('C4,G4');
      expect(chordLine).not.toContain('E4');

      // A new line for E4 should appear at 2.5 before 4.0
      const e4LineIdx = lines.findIndex((l) => l.includes('2.5') && l.includes('E4'));
      const d4LineIdx = lines.findIndex((l) => l.includes('4.0'));
      expect(e4LineIdx).toBeGreaterThan(-1);
      expect(e4LineIdx).toBeLessThan(d4LineIdx);
    });

    test('updates pitch and velocity in place without changing chronological line order', () => {
      const code = `@TRACK 1 Melody
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0
3.0   E4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_62',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 17,
      };

      const patched = patchNote(code, note, { pitch: 'D#4', velocity: 105 });
      const lines = patched.trim().split('\n');

      expect(lines[3]).toMatch(/^2\.0\s+D#4\s+105\s+1\.0/);
    });

    test('updates duration in place when resizing note', () => {
      const code = `@TRACK 1 Melody
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_3_1.0_60',
        trackId: 1,
        pitch: 'C4',
        midiNumber: 60,
        beat: 1.0,
        duration: 1.0,
        velocity: 80,
        line: 3,
        colStart: 0,
        colEnd: 17,
      };

      const patched = patchNote(code, note, { duration: 2.5 });
      const lines = patched.trim().split('\n');
      expect(lines[2]).toMatch(/^1\.0\s+C4\s+80\s+2\.5/);
    });

    test('preserves inline comments when moving a note', () => {
      const code = `@TRACK 1 Melody
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0 // Lead entrance
4.0   E4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_62',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 35,
      };

      const patched = patchNote(code, note, { beat: 5.0 });
      expect(patched).toContain('5.0   D4   80   1.0 // Lead entrance');
    });

    test('does not break continuation (+) lines when moving anchor line', () => {
      const code = `@TRACK 1 Harmonies
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0
+     F4   80   1.0
4.0   G4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_62',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 17,
      };

      // Moving D4 from 2.0 to 5.0 should convert the orphan "+" line of F4 to explicit beat 2.0
      const patched = patchNote(code, note, { beat: 5.0 });
      const lines = patched.trim().split('\n');

      const f4Line = lines.find((l) => l.includes('F4'));
      expect(f4Line).toBeDefined();
      expect(f4Line).toMatch(/^2\.0\s+F4/);
    });

    test('preserves continuation (+) token when modifying duration or velocity without changing beat', () => {
      const code = `@TRACK 1 Harmonies
@CHANNEL 1
2.0   D4   80   1.0
+     F4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_65',
        trackId: 1,
        pitch: 'F4',
        midiNumber: 65,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 17,
      };

      const patched = patchNote(code, note, { duration: 2.0 });
      expect(patched).toMatch(/\+\s+F4\s+80\s+2\.0/);
    });

    test('re-orders chronologically strictly within target track without affecting other tracks', () => {
      const code = `@TRACK 1 Chords
@CHANNEL 1
1.0 C4 80 1.0
3.0 E4 80 1.0

@TRACK 2 Bass
@CHANNEL 2
1.0 C2 100 1.0
2.0 D2 100 1.0
4.0 E2 100 1.0

@TRACK 3 Lead
@CHANNEL 3
1.0 C5 90 1.0
`;
      const note: StudioNote = {
        id: 'note_2_8_2.0_38',
        trackId: 2,
        pitch: 'D2',
        midiNumber: 38,
        beat: 2.0,
        duration: 1.0,
        velocity: 100,
        line: 9,
        colStart: 0,
        colEnd: 15,
      };

      // Move D2 in Track 2 to beat 5.0 (after 4.0 in Track 2, before Track 3)
      const patched = patchNote(code, note, { beat: 5.0 });
      const lines = patched.trim().split('\n');

      const trk1Idx = lines.findIndex((l) => l.startsWith('@TRACK 1'));
      const trk2Idx = lines.findIndex((l) => l.startsWith('@TRACK 2'));
      const trk3Idx = lines.findIndex((l) => l.startsWith('@TRACK 3'));
      const d2Idx = lines.findIndex((l) => l.includes('D2'));
      const e2Idx = lines.findIndex((l) => l.includes('E2'));

      expect(d2Idx).toBeGreaterThan(trk2Idx);
      expect(d2Idx).toBeGreaterThan(e2Idx);
      expect(d2Idx).toBeLessThan(trk3Idx);
    });

    test('supports consecutive drag updates simulating mousemove events', () => {
      let code = `@TRACK 1 Keys
@CHANNEL 1
1.0 C4 80 1.0
3.0 E4 80 1.0
5.0 G4 80 1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_3.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 3.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      // Step 1: Drag to 4.0 (between 3.0 and 5.0)
      code = patchNote(code, note, { beat: 4.0 });
      expect(code).toContain('4.0   E4   80   1.0');

      // Step 2: Drag further to 6.0 (past 5.0)
      const noteStep2 = { ...note, beat: 4.0 };
      code = patchNote(code, noteStep2, { beat: 6.0 });
      const lines = code.trim().split('\n');
      const g4Idx = lines.findIndex((l) => l.includes('G4'));
      const e4Idx = lines.findIndex((l) => l.includes('E4'));
      expect(e4Idx).toBeGreaterThan(g4Idx);
      expect(lines[e4Idx]).toMatch(/^6\.0\s+E4/);
    });

    test('supports consecutive drag updates with pitch changes simulating mousemove events', () => {
      let code = `@TRACK 1 Keys\n@CHANNEL 1\n1.0 C4 80 1.0\n3.0 D4 80 1.0\n5.0 G4 80 1.0\n`;
      let note: StudioNote = {
        id: 'test',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 3.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      // Frame 1: dragged diagonally up to E4 at beat 3.5
      code = patchNote(code, note, { pitch: 'E4', beat: 3.5 });
      note = { ...note, pitch: 'E4', midiNumber: 64, beat: 3.5 };
      expect(code).toContain('3.5   E4   80   1.0');

      // Frame 2: dragged further to F4 at beat 5.5 (past 5.0 G4)
      code = patchNote(code, note, { pitch: 'F4', beat: 5.5 });
      const lines = code.trim().split('\n');
      const g4Idx = lines.findIndex((l) => l.includes('G4'));
      const f4Idx = lines.findIndex((l) => l.includes('F4'));
      expect(f4Idx).toBeGreaterThan(g4Idx);
      expect(lines[f4Idx]).toMatch(/^5\.5\s+F4/);
    });

    test('preserves blank line separation before next track when dragging note past all notes in track', () => {
      const initial = `@TRACK 1 Keys
@CHANNEL 1
2.0 C4 80 1.0
3.0 D4 80 1.0
4.0 E4 80 1.0

@TRACK 2 Bass
@CHANNEL 2
1.0 C2 80 1.0
`;
      const note: StudioNote = {
        id: 'test',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 3.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      const dragged = patchNote(initial, note, { beat: 5.5 });
      const lines = dragged.split('\n');
      const d4Idx = lines.findIndex((l) => l.includes('D4'));
      const trk2Idx = lines.findIndex((l) => l.startsWith('@TRACK 2'));

      // The line right before @TRACK 2 should be blank, not the moved note!
      expect(lines[trk2Idx - 1].trim()).toBe('');
      expect(d4Idx).toBeLessThan(trk2Idx - 1);
    });
  });

  describe('insertNote', () => {
    test('inserts note at correct chronological position in existing track', () => {
      const code = `@TRACK 1 Keys
@CHANNEL 1
1.0   C4   80   1.0
3.0   E4   80   1.0
`;
      const updated = insertNote(code, 1, 'D4', 2.0, 1.0, 85);
      const lines = updated.trim().split('\n');

      const c4Idx = lines.findIndex((l) => l.includes('C4'));
      const d4Idx = lines.findIndex((l) => l.includes('D4'));
      const e4Idx = lines.findIndex((l) => l.includes('E4'));

      expect(c4Idx).toBeLessThan(d4Idx);
      expect(d4Idx).toBeLessThan(e4Idx);
      expect(lines[d4Idx]).toMatch(/^2\.0\s+D4\s+85\s+1\.0/);
    });

    test('creates new track block with clean spacing when track does not exist', () => {
      const code = `@TRACK 1 Keys
@CHANNEL 1
1.0   C4   80   1.0`;

      const updated = insertNote(code, 2, 'C2', 1.0, 0.5, 90);
      expect(updated).toContain('\n\n@TRACK 2 Track_2');
      expect(updated).toContain('@CHANNEL 2');
      expect(updated).toContain('1.0   C2   90   0.5');
    });

    test('preserves blank line separation before next track when inserting note at end of track', () => {
      const initial = `@TRACK 1 Keys
@CHANNEL 1
2.0 C4 80 1.0

@TRACK 2 Bass
@CHANNEL 2
1.0 C2 80 1.0
`;
      const updated = insertNote(initial, 1, 'D4', 6.0, 1.0, 80);
      const lines = updated.split('\n');
      const d4Idx = lines.findIndex((l) => l.includes('D4'));
      const trk2Idx = lines.findIndex((l) => l.startsWith('@TRACK 2'));

      expect(lines[trk2Idx - 1].trim()).toBe('');
      expect(d4Idx).toBeLessThan(trk2Idx - 1);
    });
  });

  describe('deleteNote', () => {
    test('deletes single note line cleanly', () => {
      const code = `@TRACK 1 Keys
@CHANNEL 1
1.0   C4   80   1.0
2.0   D4   80   1.0
3.0   E4   80   1.0
`;
      const note: StudioNote = {
        id: 'note_1_4_2.0_62',
        trackId: 1,
        pitch: 'D4',
        midiNumber: 62,
        beat: 2.0,
        duration: 1.0,
        velocity: 80,
        line: 4,
        colStart: 0,
        colEnd: 17,
      };

      const result = deleteNote(code, note);
      expect(result).not.toContain('D4');
      expect(result).toContain('C4');
      expect(result).toContain('E4');
    });

    test('deletes single pitch from chord without removing entire chord line', () => {
      const code = `@TRACK 1 Chords
@CHANNEL 1
1.0   C4,E4,G4   80   2.0
`;
      const note: StudioNote = {
        id: 'note_1_3_1.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 1.0,
        duration: 2.0,
        velocity: 80,
        line: 3,
        colStart: 0,
        colEnd: 25,
      };

      const result = deleteNote(code, note);
      expect(result).toContain('1.0   C4,G4   80   2.0');
      expect(result).not.toContain('E4');
    });
  });

  describe('patchTrackHeader', () => {
    test('patches track name in header', () => {
      const code = `@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0`;
      const updated = patchTrackHeader(code, 1, { name: 'Acoustic Grand' });
      expect(updated).toContain('@TRACK 1 Acoustic_Grand');
    });

    test('sanitizes track name and falls back if empty or whitespace only', () => {
      const code = `@TRACK 1 Piano\n@CHANNEL 1\n1.0 C4 80 1.0`;
      const updated = patchTrackHeader(code, 1, { name: '   ' });
      expect(updated).toContain('@TRACK 1 Track_1');
    });

    test('updates existing @PROGRAM in header', () => {
      const code = `@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
1.0 C4 80 1.0`;
      const updated = patchTrackHeader(code, 1, { program: 4 });
      expect(updated).toContain('@PROGRAM 4');
      expect(updated).not.toContain('@PROGRAM 0');
    });

    test('inserts @PROGRAM before event lines if track did not have @PROGRAM', () => {
      const code = `@TRACK 3 Drums
@CHANNEL 10
// comment
1.0 36 80 1.0`;
      const updated = patchTrackHeader(code, 3, { program: 0, channel: 10 });
      const lines = updated.split('\n');

      const trackIdx = lines.findIndex((l) => l.startsWith('@TRACK 3'));
      const progIdx = lines.findIndex((l) => l.startsWith('@PROGRAM'));
      const noteIdx = lines.findIndex((l) => l.startsWith('1.0'));

      expect(trackIdx).toBeLessThan(progIdx);
      expect(progIdx).toBeLessThan(noteIdx);
    });

    test('switches track channel and program cleanly (e.g. to drums)', () => {
      const code = `@TRACK 2 Synth
@CHANNEL 2
@PROGRAM 38
1.0 C2 80 1.0`;
      const updated = patchTrackHeader(code, 2, { channel: 10, program: 0 });
      expect(updated).toContain('@CHANNEL 10');
      expect(updated).toContain('@PROGRAM 0');
    });
  });

  describe('createNewTrackBlock', () => {
    test('formats new track with clean double line break separation', () => {
      const block = createNewTrackBlock(3, 'Synth Lead', 4, 80);
      expect(block.startsWith('\n\n@TRACK 3 Synth_Lead\n')).toBe(true);
      expect(block).toContain('@CHANNEL 4\n');
      expect(block).toContain('@PROGRAM 80\n');
    });
  });

  describe('Drum Map / @MAP Manager', () => {
    test('parseDrumMapText parses key=value, : and whitespace lines', () => {
      const text = `
        kick=36
        snare: 38
        hihat 42
        # comment line
        // another comment
        @MAP clap=39
      `;
      const res = parseDrumMapText(text);
      expect(res.length).toBe(4);
      expect(res.find((m) => m.name === 'kick')?.midi).toBe(36);
      expect(res.find((m) => m.name === 'snare')?.midi).toBe(38);
      expect(res.find((m) => m.name === 'hihat')?.midi).toBe(42);
      expect(res.find((m) => m.name === 'clap')?.midi).toBe(39);
    });

    test('parseDrumMapText parses reversed 36=kick format and CSV/TSV format', () => {
      const text = `
        36 = kick
        38, snare
        42\topen_hat
      `;
      const res = parseDrumMapText(text);
      expect(res.length).toBe(3);
      expect(res.find((m) => m.name === 'kick')?.midi).toBe(36);
      expect(res.find((m) => m.name === 'snare')?.midi).toBe(38);
      expect(res.find((m) => m.name === 'open_hat')?.midi).toBe(42);
    });

    test('parseDrumMapText parses Cubase .drm XML snippets', () => {
      const xml = `
        <DrumMap>
          <DrumMapEntry InNote="36" Name="Bass Drum 1" />
          <DrumMapEntry InNote="38" Name="Acoustic Snare" />
        </DrumMap>
      `;
      const res = parseDrumMapText(xml);
      expect(res.length).toBe(2);
      expect(res[0].name).toBe('Bass_Drum_1');
      expect(res[0].midi).toBe(36);
      expect(res[1].name).toBe('Acoustic_Snare');
      expect(res[1].midi).toBe(38);
    });

    test('parseDrumMapText parses real Steinberg Cubase .drm XML item list format', () => {
      const steinbergXml = `
        <?xml version="1.0" encoding="utf-8"?>
        <DrumMap>
          <string name="Name" value="Tablas 2.0" wide="true"/>
          <list name="Map" type="list">
            <item>
              <int name="INote" value="36"/>
              <int name="ONote" value="36"/>
              <string name="Name" value="ge_open" wide="true"/>
            </item>
            <item>
              <int name="INote" value="38"/>
              <int name="ONote" value="38"/>
              <string name="Name" value="ge_slide_up" wide="true"/>
            </item>
            <item>
              <int name="INote" value="39"/>
              <string name="Name" value="" wide="true"/>
            </item>
          </list>
        </DrumMap>
      `;
      const res = parseDrumMapText(steinbergXml);
      expect(res.length).toBe(2);
      expect(res[0].name).toBe('ge_open');
      expect(res[0].midi).toBe(36);
      expect(res[1].name).toBe('ge_slide_up');
      expect(res[1].midi).toBe(38);
    });

    test('parseDrumMapText parses workspace Indian Tablas .drm file correctly', () => {
      const fs = require('fs');
      const path = require('path');
      const drmPath = path.resolve(__dirname, '../../specs/ai/Custom Drummap Examples/Indian Tablas/Tablas 2.0 - FINAL.drm');
      if (fs.existsSync(drmPath)) {
        const fileContent = fs.readFileSync(drmPath, 'utf8');
        const res = parseDrumMapText(fileContent);
        expect(res.length).toBeGreaterThan(20);
        expect(res.some((e) => e.name === 'ge_open' && e.midi === 36)).toBe(true);
        expect(res.some((e) => e.name === 'ge_slide_up' && e.midi === 38)).toBe(true);
      }
    });

    test('extractTrackDrumMaps extracts existing @MAP lines for a specific track', () => {
      const code = `@TRACK 1 Chords
1.0 C4 80 1.0

@TRACK 2 Drums
@CHANNEL 10
@PROGRAM 0
@MAP kick=36
@MAP snare=38
1.0 kick 100 0.5
2.0 snare 100 0.5`;

      const maps = extractTrackDrumMaps(code, 2);
      expect(maps.length).toBe(2);
      expect(maps[0]).toEqual({ name: 'kick', midi: 36 });
      expect(maps[1]).toEqual({ name: 'snare', midi: 38 });

      // Track 1 has none
      expect(extractTrackDrumMaps(code, 1).length).toBe(0);
    });

    test('patchTrackDrumMap inserts new @MAP directives into track header', () => {
      const code = `@TRACK 2 Drums
@CHANNEL 10
@PROGRAM 0
1.0 36 100 0.5`;

      const patched = patchTrackDrumMap(code, 2, [
        { name: 'kick', midi: 36 },
        { name: 'snare', midi: 38 },
      ]);

      expect(patched).toContain('@MAP kick=36');
      expect(patched).toContain('@MAP snare=38');
      const lines = patched.split('\n');
      const trackIdx = lines.findIndex((l) => l.startsWith('@TRACK 2'));
      const mapIdx = lines.findIndex((l) => l.startsWith('@MAP kick'));
      const noteIdx = lines.findIndex((l) => l.startsWith('1.0'));
      expect(trackIdx).toBeLessThan(mapIdx);
      expect(mapIdx).toBeLessThan(noteIdx);
    });

    test('patchTrackDrumMap replaces existing @MAP directives cleanly', () => {
      const code = `@TRACK 2 Drums
@CHANNEL 10
@MAP old_kick=35
1.0 35 100 0.5`;

      const patched = patchTrackDrumMap(code, 2, 'kick=36\nsnare=38');
      expect(patched).not.toContain('old_kick');
      expect(patched).toContain('@MAP kick=36');
      expect(patched).toContain('@MAP snare=38');
    });

    test('parseLmpDocument resolves @MAP aliases to their mapped MIDI pitch', () => {
      const code = `@TRACK 1 Drums
@CHANNEL 10
@MAP kick=36
@MAP snare=38
1.0 kick 100 0.5
2.0 snare 95 0.5`;

      const parsed = parseLmpDocument(code);
      expect(parsed.tracks[0].notes.length).toBe(2);
      expect(parsed.tracks[0].notes[0].pitch).toBe('kick');
      expect(parsed.tracks[0].notes[0].midiNumber).toBe(36);
      expect(parsed.tracks[0].notes[1].pitch).toBe('snare');
      expect(parsed.tracks[0].notes[1].midiNumber).toBe(38);
    });

    test('parseLmpDocument expands repeating ranges (e.g. 1.0-5.0:1) with aliases', () => {
      const code = `@TRACK 1 Drums
@CHANNEL 10
@MAP kick=36
1.0-5.0:1 kick 100 0.5`;

      const parsed = parseLmpDocument(code);
      const notes = parsed.tracks[0].notes;
      expect(notes.length).toBe(4);
      expect(notes.map((n) => n.beat)).toEqual([1.0, 2.0, 3.0, 4.0]);
      expect(notes.every((n) => n.midiNumber === 36)).toBe(true);
      expect(notes.every((n) => n.pitch === 'kick')).toBe(true);
    });

    test('parseLmpDocument resolves custom aliases inside chords', () => {
      const code = `@TRACK 1 Kit
@CHANNEL 10
@MAP kick=36
@MAP crash=49
1.0 kick,crash 110 1.0`;

      const parsed = parseLmpDocument(code);
      const notes = parsed.tracks[0].notes;
      expect(notes.length).toBe(2);
      expect(notes.map((n) => n.midiNumber)).toContain(36);
      expect(notes.map((n) => n.midiNumber)).toContain(49);
    });

    test('parseDrumMapText handles malformed lines, out of range values, and empty input', () => {
      expect(parseDrumMapText('')).toEqual([]);
      expect(parseDrumMapText('invalid text without any number')).toEqual([]);
      // Out of range (200 is > 127)
      expect(parseDrumMapText('bad_note=200')).toEqual([]);
      // Negative (-5)
      expect(parseDrumMapText('bad_note=-5')).toEqual([]);
      // Duplicate names deduplicate
      const dup = parseDrumMapText('kick=36\nKICK=35');
      expect(dup.length).toBe(1);
      expect(dup[0].name.toLowerCase()).toBe('kick');
      expect(dup[0].midi).toBe(36);
    });
  });

  describe('collapseCommons - Common Chord Merging', () => {
    test('collapses dragged note into existing chord when beat, velocity, and duration match', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
1.0   F3,A3,C4,E4   85   2.0
3.0   D3,F3,A3,C4   80   2.0
5.0   G3,B3   88   2.0
6.0   E4   88   2.0
7.0   C3,G3,B3,E3   82   2.0`;

      const note: StudioNote = {
        id: 'note_1_6_6.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 6.0,
        duration: 2.0,
        velocity: 88,
        line: 6,
        colStart: 0,
        colEnd: 15,
      };

      // Drag E4 from 6.0 to 5.0 where G3,B3 exists with same velocity (88) and duration (2.0)
      const patched = patchNote(code, note, { beat: 5.0 });

      expect(patched).toContain('5.0   G3,B3,E4   88   2.0');
      // Old line 6.0 E4 should no longer exist
      expect(patched).not.toContain('6.0   E4');
      // Other chords preserved
      expect(patched).toContain('1.0   F3,A3,C4,E4   85   2.0');
      expect(patched).toContain('3.0   D3,F3,A3,C4   80   2.0');
      expect(patched).toContain('7.0   C3,G3,B3,E3   82   2.0');
    });

    test('re-sorts pitches low-to-high when merging into existing chord', () => {
      const code = `@TRACK 1 Keys
@CHANNEL 1
1.0   E4,G4   90   1.0
2.0   C4      90   1.0`;

      const note: StudioNote = {
        id: 'note_1_4_2.0_60',
        trackId: 1,
        pitch: 'C4',
        midiNumber: 60,
        beat: 2.0,
        duration: 1.0,
        velocity: 90,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      // Moving C4 (60) to beat 1.0 where E4 (64), G4 (67) exist -> should sort as C4,E4,G4
      const patched = patchNote(code, note, { beat: 1.0 });
      expect(patched).toContain('1.0   C4,E4,G4   90   1.0');
      expect(patched).not.toContain('2.0   C4');
    });

    test('keeps separate lines when velocity differs even if beat and duration match', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
5.0   G3,B3   88   2.0
6.0   E4      70   2.0`;

      const note: StudioNote = {
        id: 'note_1_4_6.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 6.0,
        duration: 2.0,
        velocity: 70, // Different velocity than 88!
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      const patched = patchNote(code, note, { beat: 5.0 });
      // Should NOT merge into G3,B3 chord because velocity is 70 vs 88
      expect(patched).toContain('5.0   G3,B3   88   2.0');
      expect(patched).toContain('5.0   E4   70   2.0');
    });

    test('keeps separate lines when duration differs even if beat and velocity match', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
5.0   G3,B3   88   2.0
6.0   E4      88   1.0`;

      const note: StudioNote = {
        id: 'note_1_4_6.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 6.0,
        duration: 1.0, // Different duration than 2.0!
        velocity: 88,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      const patched = patchNote(code, note, { beat: 5.0 });
      // Should NOT merge into G3,B3 chord because duration is 1.0 vs 2.0
      expect(patched).toContain('5.0   G3,B3   88   2.0');
      expect(patched).toContain('5.0   E4   88   1.0');
    });

    test('keeps separate lines when collapseCommons is toggled false', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
5.0   G3,B3   88   2.0
6.0   E4      88   2.0`;

      const note: StudioNote = {
        id: 'note_1_4_6.0_64',
        trackId: 1,
        pitch: 'E4',
        midiNumber: 64,
        beat: 6.0,
        duration: 2.0,
        velocity: 88,
        line: 4,
        colStart: 0,
        colEnd: 15,
      };

      const patched = patchNote(code, note, { beat: 5.0 }, { collapseCommons: false });
      // With collapseCommons false, should create separate line
      expect(patched).toContain('5.0   G3,B3   88   2.0');
      expect(patched).toContain('5.0   E4   88   2.0');
      expect(patched).not.toContain('G3,B3,E4');
    });

    test('insertNote merges into existing chord when collapseCommons is true', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
1.0   C4,E4   80   2.0`;

      const updated = insertNote(code, 1, 'G4', 1.0, 2.0, 80);
      expect(updated).toContain('1.0   C4,E4,G4   80   2.0');
    });

    test('insertNote keeps separate line when collapseCommons is false', () => {
      const code = `@TRACK 1 Progression
@CHANNEL 1
1.0   C4,E4   80   2.0`;

      const updated = insertNote(code, 1, 'G4', 1.0, 2.0, 80, { collapseCommons: false });
      expect(updated).toContain('1.0   C4,E4   80   2.0');
      expect(updated).toContain('1.0   G4   80   2.0');
      expect(updated).not.toContain('C4,E4,G4');
    });
  });
});

