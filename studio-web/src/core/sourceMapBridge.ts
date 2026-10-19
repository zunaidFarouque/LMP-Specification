import type { StudioNote, StudioTrack } from './types';

export interface DrumMapEntry {
  name: string;
  midi: number;
}

/**
 * Parses drum map / alias definitions from plain text, @MAP directives, key=val lines,
 * CSV/TSV, or Cubase .drm XML snippets.
 */
export function parseDrumMapText(text: string): DrumMapEntry[] {
  if (!text || typeof text !== 'string') return [];

  const entries: DrumMapEntry[] = [];
  const seenNames = new Set<string>();

  // Check if text is Cubase XML format with DrumMap / item / INote / ONote
  if (text.includes('<DrumMap') || text.includes('<item') || text.includes('InNote') || text.includes('INote')) {
    let foundXml = false;

    // Pattern A: Cubase Steinberg XML list items:
    // <item> ... <int name="INote" value="36"/> ... <string name="Name" value="Kick" .../> ... </item>
    const itemBlockRegex = /<item>([\s\S]*?)<\/item>/gi;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = itemBlockRegex.exec(text)) !== null) {
      const block = blockMatch[1];
      const noteMatch =
        block.match(/<int\s+name=["']I?Note["']\s+value=["'](\d+)["']/i) ||
        block.match(/<int\s+name=["']ONote["']\s+value=["'](\d+)["']/i);
      const nameMatch = block.match(/<string\s+name=["']Name["']\s+value=["']([^"']*)["']/i);
      if (noteMatch && nameMatch && nameMatch[1].trim()) {
        const midi = parseInt(noteMatch[1], 10);
        const rawName = nameMatch[1].trim();
        const cleanName = rawName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
        if (cleanName && midi >= 0 && midi <= 127 && !seenNames.has(cleanName.toLowerCase())) {
          seenNames.add(cleanName.toLowerCase());
          entries.push({ name: cleanName, midi });
          foundXml = true;
        }
      }
    }

    // Pattern B: Attribute-based XML: <DrumMapEntry InNote="36" Name="Kick" /> or <item InNote="36" Name="Kick" />
    const attrRegex =
      /<(?:DrumMapEntry|item)[^>]*\b(?:InNote|INote|ONote|Note|Pitch)=["'](\d+)["'][^>]*\bName=["']([^"']+)["']|<(?:DrumMapEntry|item)[^>]*\bName=["']([^"']+)["'][^>]*\b(?:InNote|INote|ONote|Note|Pitch)=["'](\d+)["']/gi;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(text)) !== null) {
      const midiStr = attrMatch[1] || attrMatch[4];
      const nameStr = attrMatch[2] || attrMatch[3];
      if (midiStr && nameStr && nameStr.trim()) {
        const midi = parseInt(midiStr, 10);
        const cleanName = nameStr.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
        if (cleanName && midi >= 0 && midi <= 127 && !seenNames.has(cleanName.toLowerCase())) {
          seenNames.add(cleanName.toLowerCase());
          entries.push({ name: cleanName, midi });
          foundXml = true;
        }
      }
    }

    if (foundXml && entries.length > 0) return entries;
  }

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const stripped = rawLine.split('//')[0].trim();
    if (!stripped || stripped.startsWith('#')) continue;

    // Remove leading @MAP or @DRUM if present
    const cleanLine = stripped.replace(/^@(MAP|DRUM)\s+/i, '').trim();

    // Try format: name=midi or name: midi or name 36 or name, 36
    let name: string | null = null;
    let midi: number | null = null;

    // Pattern 1: name = 36 or name: 36
    const p1 = cleanLine.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(\d+)$/);
    if (p1) {
      name = p1[1];
      midi = parseInt(p1[2], 10);
    } else {
      // Pattern 2: 36 = name or 36: name
      const p2 = cleanLine.match(/^(\d+)\s*[:=]\s*([A-Za-z0-9_]+)$/);
      if (p2) {
        midi = parseInt(p2[1], 10);
        name = p2[2];
      } else {
        // Pattern 3: name, 36 or 36, name
        const p3 = cleanLine.split(/[,;\t]+/);
        if (p3.length >= 2) {
          const t0 = p3[0].trim();
          const t1 = p3[1].trim();
          if (/^\d+$/.test(t0) && /^[A-Za-z0-9_]+$/.test(t1)) {
            midi = parseInt(t0, 10);
            name = t1;
          } else if (/^[A-Za-z0-9_]+$/.test(t0) && /^\d+$/.test(t1)) {
            name = t0;
            midi = parseInt(t1, 10);
          }
        } else {
          // Pattern 4: whitespace separated name 36 or 36 name
          const tokens = cleanLine.split(/\s+/);
          if (tokens.length >= 2) {
            if (/^[A-Za-z0-9_]+$/.test(tokens[0]) && /^\d+$/.test(tokens[1])) {
              name = tokens[0];
              midi = parseInt(tokens[1], 10);
            } else if (/^\d+$/.test(tokens[0]) && /^[A-Za-z0-9_]+$/.test(tokens[1])) {
              midi = parseInt(tokens[0], 10);
              name = tokens[1];
            }
          }
        }
      }
    }

    if (name && midi !== null && midi >= 0 && midi <= 127) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
      if (sanitizedName && !seenNames.has(sanitizedName.toLowerCase())) {
        seenNames.add(sanitizedName.toLowerCase());
        entries.push({ name: sanitizedName, midi });
      }
    }
  }

  return entries;
}

/**
 * Extracts all @MAP definitions belonging to a specific track header in code.
 */
export function extractTrackDrumMaps(code: string, trackId: number): DrumMapEntry[] {
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, trackId);
  if (trackRange.start === -1) return [];

  const entries: DrumMapEntry[] = [];
  const seen = new Set<string>();

  for (let i = trackRange.start + 1; i < trackRange.end; i++) {
    const trimmed = lines[i].split('//')[0].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@TRACK')) break;
    if (!trimmed.startsWith('@')) break; // Reached events

    if (trimmed.startsWith('@MAP')) {
      const rest = trimmed.replace(/^@MAP\s+/i, '').trim();
      const match = rest.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(\d+)$/) || rest.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);
      if (match) {
        const name = match[1];
        const midi = parseInt(match[2], 10);
        if (!seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          entries.push({ name, midi });
        }
      }
    }
  }

  return entries;
}

/**
 * Inserts or updates @MAP definitions inside a track header.
 * Replaces existing @MAP lines for that track with the new definitions.
 */
export function patchTrackDrumMap(
  code: string,
  trackId: number,
  maps: DrumMapEntry[] | string
): string {
  const parsedMaps: DrumMapEntry[] = Array.isArray(maps) ? maps : parseDrumMapText(maps);
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, trackId);

  if (trackRange.start === -1) return code;

  // 1. Remove any existing @MAP lines in this track block header
  let insertPos = trackRange.start + 1;
  let i = trackRange.start + 1;
  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.split('//')[0].trim();
    if (stripped.startsWith('@TRACK')) break;
    if (stripped && !stripped.startsWith('@')) break; // Reached events

    if (stripped.startsWith('@MAP')) {
      lines.splice(i, 1);
      continue;
    } else if (stripped.startsWith('@CHANNEL') || stripped.startsWith('@PROGRAM') || stripped.startsWith('@PBRANGE')) {
      insertPos = i + 1;
    }
    i++;
  }

  // 2. Insert new @MAP lines
  if (parsedMaps.length > 0) {
    const mapLines = parsedMaps.map((m) => `@MAP ${m.name}=${m.midi}`);
    lines.splice(insertPos, 0, ...mapLines);
  }

  return lines.join('\n');
}

// MIDI Pitch Utilities
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToSpn(midi: number): string {
  if (midi < 0 || midi > 127) return 'C4';
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function spnToMidi(spn: string): number {
  if (!spn) return 60;
  // If already an integer (GM drum or midi number)
  if (/^\d+$/.test(spn)) {
    return parseInt(spn, 10);
  }
  const match = spn.trim().match(/^([A-Ga-g])([#b♭♯]?)(-?\d+)$/);
  if (!match) return 60;
  const letter = match[1].toUpperCase();
  const acc = match[2];
  const oct = parseInt(match[3], 10);

  const baseOffsets: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let semitone = baseOffsets[letter] ?? 0;
  if (acc === '#' || acc === '♯') semitone += 1;
  if (acc === 'b' || acc === '♭') semitone -= 1;

  return (oct + 1) * 12 + semitone;
}

export const TRACK_COLORS = [
  '#f59e0b', // Amber (Track 1)
  '#8b5cf6', // Violet (Track 2)
  '#10b981', // Emerald (Track 3)
  '#3b82f6', // Blue (Track 4)
  '#ec4899', // Pink (Track 5)
  '#06b6d4', // Cyan (Track 6)
  '#f97316', // Orange (Track 7)
  '#a855f7', // Purple (Track 8)
];

/**
 * Creates a clean, well-spaced new track block with blank line separation.
 */
export function createNewTrackBlock(
  trackId: number,
  name: string,
  channel: number,
  program: number
): string {
  const cleanName = name.replace(/\s+/g, '_');
  return `\n\n@TRACK ${trackId} ${cleanName}\n@CHANNEL ${channel}\n@PROGRAM ${program}\n`;
}

function formatBeatOrDur(val: number): string {
  const s = val.toFixed(2);
  if (s.endsWith('.00')) return s.slice(0, -1); // e.g. 5.0
  if (s.endsWith('0')) return s.slice(0, -1);   // e.g. 5.5
  return s;
}

/**
 * Finds the line range for a track: [trackHeaderIndex, nextTrackHeaderIndex].
 */
function findTrackRange(lines: string[], trackId: number): { start: number; end: number } {
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].split('//')[0].trim();
    if (trimmed.startsWith('@TRACK')) {
      const tid = parseInt(trimmed.split(/\s+/)[1], 10);
      if (tid === trackId) {
        start = i;
      } else if (start !== -1 && end === lines.length) {
        end = i;
        break;
      }
    }
  }

  return { start, end };
}

/**
 * Finds the index of the line representing a note within a track.
 */
function findNoteLineIndex(
  lines: string[],
  trackRange: { start: number; end: number },
  note: StudioNote
): number {
  // 1. Try direct line hint from note.line
  const directIdx = note.line - 1;
  if (directIdx >= trackRange.start && directIdx < trackRange.end) {
    const rawLine = lines[directIdx];
    const codePart = rawLine.split('//')[0].trim();
    if (codePart && !codePart.startsWith('@')) {
      const tokens = codePart.split(/\s+/);
      const pitchToken = tokens[0] === '+' ? tokens[1] : tokens[1];
      if (pitchToken) {
        const pitches = pitchToken.split(',').map((p) => p.trim());
        if (
          pitches.some(
            (p) => spnToMidi(p) === note.midiNumber || p.toLowerCase() === note.pitch.toLowerCase()
          )
        ) {
          return directIdx;
        }
      }
    }
  }

  // 2. Fallback: Search within track range for line with matching pitch and closest beat
  let bestIdx = -1;
  let minBeatDiff = Infinity;
  let lastBeatSeen = 1.0;

  for (let i = trackRange.start + 1; i < trackRange.end; i++) {
    const rawLine = lines[i];
    const codePart = rawLine.split('//')[0].trim();
    if (!codePart || codePart.startsWith('@')) continue;

    const tokens = codePart.split(/\s+/);
    const first = tokens[0];
    let lineBeat: number;
    if (first === '+') {
      lineBeat = lastBeatSeen;
    } else {
      lineBeat = parseFloat(first);
      if (!isNaN(lineBeat)) lastBeatSeen = lineBeat;
    }

    const pitchToken = tokens[1];
    if (!pitchToken) continue;

    const pitches = pitchToken.split(',').map((p) => p.trim());
    const matchesPitch = pitches.some(
      (p) => spnToMidi(p) === note.midiNumber || p.toLowerCase() === note.pitch.toLowerCase()
    );

    if (matchesPitch) {
      const diff = Math.abs((isNaN(lineBeat) ? note.beat : lineBeat) - note.beat);
      if (diff < minBeatDiff) {
        minBeatDiff = diff;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}

/**
 * Extracts tracks, headers, and notes from compiled sourceMap or text
 */
export function parseLmpDocument(
  code: string,
  sourceMapData?: any
): {
  tracks: StudioTrack[];
  bpm: number;
  timeSig: [number, number];
  totalBeats: number;
} {
  const lines = code.split('\n');
  let bpm = 120;
  let timeSig: [number, number] = [4, 4];
  let maxBeat = 4.0;

  const tracksMap = new Map<number, StudioTrack>();
  const trackMaps = new Map<number, Map<string, number>>();
  let currentTrackId = 1;

  // First pass: scan headers, track declarations, and @MAP mappings
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = rawLine.split('//')[0].trim();
    if (!stripped) continue;

    if (stripped.startsWith('@BPM')) {
      const parts = stripped.split(/\s+/);
      if (parts[1]) bpm = parseFloat(parts[1]) || 120;
    } else if (stripped.startsWith('@TIMESIG')) {
      const parts = stripped.split(/\s+/);
      if (parts[1]) {
        const [n, d] = parts[1].split('/').map(Number);
        if (n && d) timeSig = [n, d];
      }
    } else if (stripped.startsWith('@TRACK')) {
      const parts = stripped.split(/\s+/);
      const tid = parseInt(parts[1], 10) || (tracksMap.size + 1);
      const name = parts.slice(2).join(' ') || `Track ${tid}`;
      currentTrackId = tid;

      if (!tracksMap.has(tid)) {
        tracksMap.set(tid, {
          id: tid,
          name,
          channel: tid === 10 ? 10 : ((tid - 1) % 15) + 1,
          program: 0,
          volume: 100,
          pan: 64,
          isMuted: false,
          isSolo: false,
          color: TRACK_COLORS[(tid - 1) % TRACK_COLORS.length],
          notes: [],
        });
      } else {
        const trk = tracksMap.get(tid)!;
        trk.name = name;
      }
    } else if (stripped.startsWith('@CHANNEL')) {
      const parts = stripped.split(/\s+/);
      const ch = parseInt(parts[1], 10);
      const trk = tracksMap.get(currentTrackId);
      if (trk && ch) trk.channel = ch;
    } else if (stripped.startsWith('@PROGRAM')) {
      const parts = stripped.split(/\s+/);
      const prg = parseInt(parts[1], 10);
      const trk = tracksMap.get(currentTrackId);
      if (trk && !isNaN(prg)) trk.program = prg;
    } else if (stripped.startsWith('@MAP')) {
      const rest = stripped.replace(/^@MAP\s+/i, '').trim();
      const match = rest.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(\d+)$/) || rest.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);
      if (match) {
        const alias = match[1].toLowerCase();
        const midiNum = parseInt(match[2], 10);
        if (!trackMaps.has(currentTrackId)) {
          trackMaps.set(currentTrackId, new Map());
        }
        trackMaps.get(currentTrackId)!.set(alias, midiNum);
      }
    }
  }

  // Ensure default track 1 if none declared
  if (tracksMap.size === 0) {
    tracksMap.set(1, {
      id: 1,
      name: 'Track 1',
      channel: 1,
      program: 0,
      volume: 100,
      pan: 64,
      isMuted: false,
      isSolo: false,
      color: TRACK_COLORS[0],
      notes: [],
    });
  }

  // Parse notes from source map or fallback line parser
  if (sourceMapData && Array.isArray(sourceMapData.notes)) {
    for (const smNote of sourceMapData.notes) {
      const tid = smNote.track || 1;
      let trk = tracksMap.get(tid);
      if (!trk) {
        trk = {
          id: tid,
          name: `Track ${tid}`,
          channel: tid === 10 ? 10 : tid,
          program: 0,
          volume: 100,
          pan: 64,
          isMuted: false,
          isSolo: false,
          color: TRACK_COLORS[(tid - 1) % TRACK_COLORS.length],
          notes: [],
        };
        tracksMap.set(tid, trk);
      }

      const noteEnd = (smNote.beat || 1.0) + (smNote.duration || 1.0);
      if (noteEnd > maxBeat) maxBeat = noteEnd;

      trk.notes.push({
        id: `note_${tid}_${smNote.line}_${smNote.beat}_${smNote.midi}`,
        trackId: tid,
        pitch: smNote.pitch || midiToSpn(smNote.midi),
        midiNumber: smNote.midi,
        beat: smNote.beat,
        duration: smNote.duration || 1.0,
        velocity: smNote.velocity || 80,
        line: smNote.line,
        colStart: smNote.colStart || 0,
        colEnd: smNote.colEnd || 0,
        rawText: smNote.rawText,
      });
    }
  } else {
    // Fallback: parse note lines
    let activeTrackId = 1;
    let lastBeat = 1.0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const commentIdx = rawLine.indexOf('//');
      const textWithoutComment = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
      const trimmed = textWithoutComment.trim();

      if (!trimmed) continue;
      if (trimmed.startsWith('@TRACK')) {
        const parts = trimmed.split(/\s+/);
        activeTrackId = parseInt(parts[1], 10) || 1;
        continue;
      }
      if (trimmed.startsWith('@')) continue;

      const tokens = trimmed.split(/\s+/);
      const firstToken = tokens[0];

      let beatsToEmit: number[] = [];
      const rangeMatch = firstToken.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?):(\d+(?:\.\d+)?(?:\/\d+)?)$/);
      if (rangeMatch) {
        const start = parseFloat(rangeMatch[1]);
        const end = parseFloat(rangeMatch[2]);
        let step = 1.0;
        if (rangeMatch[3].includes('/')) {
          const [n, d] = rangeMatch[3].split('/').map(Number);
          step = d ? n / d : 1.0;
        } else {
          step = parseFloat(rangeMatch[3]) || 1.0;
        }
        for (let b = start; b < end - 0.0001; b += step) {
          beatsToEmit.push(Number(b.toFixed(3)));
        }
        if (beatsToEmit.length > 0) {
          lastBeat = beatsToEmit[beatsToEmit.length - 1];
        }
      } else if (firstToken === '+') {
        beatsToEmit = [lastBeat];
      } else if (!isNaN(parseFloat(firstToken))) {
        const b = parseFloat(firstToken);
        lastBeat = b;
        beatsToEmit = [b];
      } else {
        continue;
      }

      const pitchTokensStartIndex = 1;
      const pitchToken = tokens[pitchTokensStartIndex];
      if (!pitchToken || ['R', 'CC', 'PB', 'TEMPO', 'TS', '|'].includes(pitchToken.toUpperCase())) {
        continue;
      }

      const velToken = tokens[pitchTokensStartIndex + 1];
      const durToken = tokens[pitchTokensStartIndex + 2];

      const velocity = velToken && velToken !== '_' && !isNaN(parseInt(velToken, 10)) ? parseInt(velToken, 10) : 80;
      const duration = durToken && !isNaN(parseFloat(durToken)) ? parseFloat(durToken) : 1.0;

      const pitches = pitchToken.split(',').filter(Boolean);
      const trk = tracksMap.get(activeTrackId);
      if (!trk) continue;

      for (const b of beatsToEmit) {
        for (const p of pitches) {
          let midi = spnToMidi(p);
          const map = trackMaps.get(activeTrackId);
          if (map && map.has(p.toLowerCase())) {
            midi = map.get(p.toLowerCase())!;
          }
          const noteEnd = b + duration;
          if (noteEnd > maxBeat) maxBeat = noteEnd;

          trk.notes.push({
            id: `note_${activeTrackId}_${lineNum}_${b}_${midi}`,
            trackId: activeTrackId,
            pitch: p,
            midiNumber: midi,
            beat: b,
            duration,
            velocity,
            line: lineNum,
            colStart: 0,
            colEnd: rawLine.length,
          });
        }
      }
    }
  }

  // Sort notes by beat
  for (const trk of tracksMap.values()) {
    trk.notes.sort((a, b) => a.beat - b.beat || a.midiNumber - b.midiNumber);
  }

  const sortedTracks = Array.from(tracksMap.values()).sort((a, b) => a.id - b.id);
  const roundedTotalBeats = Math.max(4.0, Math.ceil(maxBeat));

  return {
    tracks: sortedTracks,
    bpm,
    timeSig,
    totalBeats: roundedTotalBeats,
  };
}

export interface PatchNoteOptions {
  collapseCommons?: boolean;
}

/**
 * Scans a track for an existing note line with matching beat, velocity, and duration
 * so that simultaneous identical-setting notes can be cleanly collapsed into a single chord.
 */
function findMatchingChordLine(
  lines: string[],
  trackRange: { start: number; end: number },
  targetBeat: number,
  targetVel: number,
  targetDur: number,
  excludeIndex: number = -1
): { lineIndex: number; tokens: string[]; commentPart: string; leadingSpaces: string } | null {
  let lastBeatSeen = 1.0;

  for (let i = trackRange.start + 1; i < trackRange.end; i++) {
    if (i === excludeIndex) continue;
    const rawLine = lines[i];
    const commentSplit = rawLine.split('//');
    const codePart = commentSplit[0].trim();
    if (!codePart || codePart.startsWith('@')) continue;

    const tokens = codePart.split(/\s+/);
    const firstTok = tokens[0];
    let lineBeat: number;
    if (firstTok === '+') {
      lineBeat = lastBeatSeen;
    } else {
      lineBeat = parseFloat(firstTok);
      if (!isNaN(lineBeat)) lastBeatSeen = lineBeat;
    }

    if (isNaN(lineBeat) || Math.abs(lineBeat - targetBeat) > 0.001) {
      continue;
    }

    // Must be a pitch line (not CC, PB, R, modifier |, etc.)
    const pitchTok = tokens[1];
    if (!pitchTok || ['R', 'CC', 'PB', 'TEMPO', 'TS', '|'].includes(pitchTok.toUpperCase())) {
      continue;
    }

    // Check velocity
    const lineVel =
      tokens.length > 2 && tokens[2] !== '_' && !isNaN(parseInt(tokens[2], 10))
        ? parseInt(tokens[2], 10)
        : 80;
    if (lineVel !== targetVel) {
      continue;
    }

    // Check duration
    const lineDur =
      tokens.length > 3 && !isNaN(parseFloat(tokens[3]))
        ? parseFloat(tokens[3])
        : 1.0;
    if (Math.abs(lineDur - targetDur) > 0.001) {
      continue;
    }

    // Found match!
    const leadingSpaces = rawLine.match(/^\s*/)?.[0] || '';
    const commentPart = commentSplit.length > 1 ? ` //${commentSplit.slice(1).join('//')}` : '';
    return { lineIndex: i, tokens, commentPart, leadingSpaces };
  }

  return null;
}

/**
 * Patches an existing note in the LMP code.
 * If the note's beat is modified (e.g. note is dragged along the timeline),
 * the line is chronologically re-ordered inside its track block to preserve timeline organization.
 * If collapseCommons is true and the target beat has an existing note with identical velocity and duration,
 * the pitch is cleanly merged into the existing chord token (e.g. 5.0 G3,B3 + E4 -> 5.0 G3,B3,E4).
 */
export function patchNote(
  code: string,
  note: StudioNote,
  updates: { pitch?: string; beat?: number; duration?: number; velocity?: number },
  options?: PatchNoteOptions
): string {
  const shouldCollapse = options?.collapseCommons ?? true;
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, note.trackId);
  const targetLineIndex = findNoteLineIndex(lines, trackRange, note);

  if (targetLineIndex < 0 || targetLineIndex >= lines.length) return code;

  const rawLine = lines[targetLineIndex];
  const commentSplit = rawLine.split('//');
  const codePart = commentSplit[0];
  const commentPart = commentSplit.length > 1 ? ` //${commentSplit.slice(1).join('//')}` : '';

  const tokens = codePart.trim().split(/\s+/);
  if (tokens.length < 2) return code;

  const isContinuation = tokens[0] === '+';
  const currentBeat = isContinuation ? note.beat : parseFloat(tokens[0]);
  const newBeat = updates.beat !== undefined ? updates.beat : currentBeat;
  const isBeatChanged = updates.beat !== undefined && Math.abs(updates.beat - currentBeat) > 0.001;

  const pitchIndex = 1;
  const existingPitches = tokens[pitchIndex].split(',').filter(Boolean);
  const isChord = existingPitches.length > 1;

  // Case 1: Dragging a single note OUT of a chord to a new beat
  if (isBeatChanged && isChord) {
    // 1. Remove this pitch from the chord line
    const remainingPitches = existingPitches.filter(
      (p) => spnToMidi(p) !== note.midiNumber && p.toLowerCase() !== note.pitch.toLowerCase()
    );
    tokens[pitchIndex] = remainingPitches.join(',');
    const leadingSpaces = rawLine.match(/^\s*/)?.[0] || '';
    lines[targetLineIndex] = `${leadingSpaces}${tokens.join('   ')}${commentPart}`;

    // 2. Insert the moved note chronologically (merging into common chord if matching)
    const targetPitch = updates.pitch ?? note.pitch;
    const targetVel = updates.velocity !== undefined ? Math.round(updates.velocity) : note.velocity;
    const targetDur = updates.duration !== undefined ? updates.duration : note.duration;
    return insertNote(lines.join('\n'), note.trackId, targetPitch, newBeat, targetDur, targetVel, options);
  }

  // Update pitch in place or in tokens
  if (updates.pitch !== undefined) {
    if (isChord) {
      const pitchIdx = existingPitches.findIndex(
        (p) => spnToMidi(p) === note.midiNumber || p.toLowerCase() === note.pitch.toLowerCase()
      );
      if (pitchIdx >= 0) {
        existingPitches[pitchIdx] = updates.pitch;
        tokens[pitchIndex] = existingPitches.join(',');
      } else {
        tokens[pitchIndex] = updates.pitch;
      }
    } else {
      tokens[pitchIndex] = updates.pitch;
    }
  }

  // Update velocity
  if (updates.velocity !== undefined) {
    const roundedVel = String(Math.round(updates.velocity));
    if (tokens.length > pitchIndex + 1) {
      tokens[pitchIndex + 1] = roundedVel;
    } else {
      tokens.push(roundedVel);
    }
  }

  // Update duration
  if (updates.duration !== undefined) {
    const formattedDur = formatBeatOrDur(updates.duration);
    if (tokens.length > pitchIndex + 2) {
      tokens[pitchIndex + 2] = formattedDur;
    } else {
      if (tokens.length === pitchIndex + 1) {
        tokens.push('_');
      }
      tokens.push(formattedDur);
    }
  }

  // Format updated beat
  if (isBeatChanged || !isContinuation) {
    const formattedBeat = formatBeatOrDur(newBeat);
    tokens[0] = formattedBeat;
  }

  const leadingSpaces = rawLine.match(/^\s*/)?.[0] || '';
  const updatedLine = `${leadingSpaces}${tokens.join('   ')}${commentPart}`;

  // If beat didn't change, just update in place
  if (!isBeatChanged) {
    lines[targetLineIndex] = updatedLine;
    return lines.join('\n');
  }

  // Case 2: Beat CHANGED for single note line -> Chronologically re-order or collapse into common chord!
  // First, if next line was continuation '+', give it the old beat so it doesn't get orphaned
  if (targetLineIndex + 1 < lines.length) {
    const nextRaw = lines[targetLineIndex + 1];
    const nextTrimmed = nextRaw.split('//')[0].trim();
    if (nextTrimmed.startsWith('+')) {
      const oldBeatFormatted = formatBeatOrDur(currentBeat);
      lines[targetLineIndex + 1] = nextRaw.replace(/^\s*\+/, `${leadingSpaces}${oldBeatFormatted}`);
    }
  }

  // Remove the old line
  lines.splice(targetLineIndex, 1);

  // Re-calculate track bounds after removal
  const updatedTrackRange = findTrackRange(lines, note.trackId);

  // If collapseCommons is enabled, check if an existing note line at newBeat matches velocity and duration
  if (shouldCollapse) {
    const targetPitch = updates.pitch ?? note.pitch;
    const targetVel =
      updates.velocity !== undefined
        ? Math.round(updates.velocity)
        : tokens.length > pitchIndex + 1 && tokens[pitchIndex + 1] !== '_'
        ? parseInt(tokens[pitchIndex + 1], 10)
        : note.velocity;
    const targetDur =
      updates.duration !== undefined
        ? updates.duration
        : tokens.length > pitchIndex + 2 && !isNaN(parseFloat(tokens[pitchIndex + 2]))
        ? parseFloat(tokens[pitchIndex + 2])
        : note.duration;

    const match = findMatchingChordLine(
      lines,
      updatedTrackRange,
      newBeat,
      targetVel,
      targetDur
    );

    if (match) {
      const existingPitches = match.tokens[1].split(',').filter(Boolean);
      const targetMidi = spnToMidi(targetPitch);
      if (
        !existingPitches.some(
          (p) => spnToMidi(p) === targetMidi || p.toLowerCase() === targetPitch.toLowerCase()
        )
      ) {
        existingPitches.push(targetPitch);
        existingPitches.sort((a, b) => spnToMidi(a) - spnToMidi(b));
      }
      match.tokens[1] = existingPitches.join(',');
      lines[match.lineIndex] = `${match.leadingSpaces}${match.tokens.join('   ')}${match.commentPart}`;
      return lines.join('\n');
    }
  }

  // Find chronological insertion point inside track
  const trackStart = updatedTrackRange.start;
  const trackEnd = updatedTrackRange.end;
  let insertAt = trackEnd;
  let lastBeatSeen = 1.0;

  for (let i = trackStart + 1; i < trackEnd; i++) {
    const trimmed = lines[i].split('//')[0].trim();
    if (!trimmed || trimmed.startsWith('@')) continue;

    const firstTok = trimmed.split(/\s+/)[0];
    let lineBeat: number;
    if (firstTok === '+') {
      lineBeat = lastBeatSeen;
    } else {
      lineBeat = parseFloat(firstTok);
      if (!isNaN(lineBeat)) lastBeatSeen = lineBeat;
    }

    if (!isNaN(lineBeat) && lineBeat > newBeat) {
      insertAt = i;
      break;
    }
  }

  // If inserting at end of track block, keep trailing blank lines after the event
  if (insertAt === trackEnd) {
    while (insertAt > trackStart + 1 && lines[insertAt - 1].trim() === '') {
      insertAt--;
    }
  }

  lines.splice(insertAt, 0, updatedLine);
  return lines.join('\n');
}

/**
 * Inserts a note into the target track in chronological beat order.
 * If collapseCommons is true, merges into any existing chord with identical beat, velocity, and duration.
 */
export function insertNote(
  code: string,
  trackId: number,
  pitch: string,
  beat: number,
  duration: number,
  velocity: number = 85,
  options?: PatchNoteOptions
): string {
  const shouldCollapse = options?.collapseCommons ?? true;
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, trackId);

  if (trackRange.start !== -1 && shouldCollapse) {
    const roundedVel = Math.round(velocity);
    const match = findMatchingChordLine(lines, trackRange, beat, roundedVel, duration);
    if (match) {
      const existingPitches = match.tokens[1].split(',').filter(Boolean);
      const targetMidi = spnToMidi(pitch);
      if (
        !existingPitches.some(
          (p) => spnToMidi(p) === targetMidi || p.toLowerCase() === pitch.toLowerCase()
        )
      ) {
        existingPitches.push(pitch);
        existingPitches.sort((a, b) => spnToMidi(a) - spnToMidi(b));
      }
      match.tokens[1] = existingPitches.join(',');
      lines[match.lineIndex] = `${match.leadingSpaces}${match.tokens.join('   ')}${match.commentPart}`;
      return lines.join('\n');
    }
  }

  const formattedBeat = formatBeatOrDur(beat);
  const formattedDur = formatBeatOrDur(duration);
  const newLine = `${formattedBeat}   ${pitch}   ${velocity}   ${formattedDur}`;

  if (trackRange.start === -1) {
    // Track doesn't exist yet, append clean new track block
    const ch = trackId === 10 ? 10 : ((trackId - 1) % 15) + 1;
    const newTrack = createNewTrackBlock(trackId, `Track_${trackId}`, ch, 0);
    return code.trimEnd() + newTrack + newLine + '\n';
  }

  // Find chronological position inside track
  let insertAt = trackRange.end;
  let lastBeatSeen = 1.0;

  for (let i = trackRange.start + 1; i < trackRange.end; i++) {
    const trimmed = lines[i].split('//')[0].trim();
    if (!trimmed || trimmed.startsWith('@')) continue;

    const firstToken = trimmed.split(/\s+/)[0];
    let lineBeat: number;
    if (firstToken === '+') {
      lineBeat = lastBeatSeen;
    } else {
      lineBeat = parseFloat(firstToken);
      if (!isNaN(lineBeat)) lastBeatSeen = lineBeat;
    }

    if (!isNaN(lineBeat) && lineBeat > beat) {
      insertAt = i;
      break;
    }
  }

  // If inserting at end of track block, keep trailing blank lines after the event
  if (insertAt === trackRange.end) {
    while (insertAt > trackRange.start + 1 && lines[insertAt - 1].trim() === '') {
      insertAt--;
    }
  }

  lines.splice(insertAt, 0, newLine);
  return lines.join('\n');
}

/**
 * Deletes a note or removes it from a chord.
 */
export function deleteNote(code: string, note: StudioNote): string {
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, note.trackId);
  const targetLineIndex = findNoteLineIndex(lines, trackRange, note);

  if (targetLineIndex < 0 || targetLineIndex >= lines.length) return code;

  const rawLine = lines[targetLineIndex];
  const commentSplit = rawLine.split('//');
  const codePart = commentSplit[0];
  const commentPart = commentSplit.length > 1 ? ` //${commentSplit.slice(1).join('//')}` : '';

  const tokens = codePart.trim().split(/\s+/);
  if (tokens.length < 2) return code;

  const pitchIndex = 1;
  const chordPitches = tokens[pitchIndex].split(',').filter(Boolean);

  if (chordPitches.length > 1) {
    // Remove only this pitch from chord
    const filtered = chordPitches.filter(
      (p) => spnToMidi(p) !== note.midiNumber && p.toLowerCase() !== note.pitch.toLowerCase()
    );
    if (filtered.length > 0) {
      tokens[pitchIndex] = filtered.join(',');
      const leadingSpaces = rawLine.match(/^\s*/)?.[0] || '';
      lines[targetLineIndex] = `${leadingSpaces}${tokens.join('   ')}${commentPart}`;
      return lines.join('\n');
    }
  }

  // Preserve continuation line if following line starts with '+'
  if (targetLineIndex + 1 < lines.length) {
    const nextRaw = lines[targetLineIndex + 1];
    const nextTrimmed = nextRaw.split('//')[0].trim();
    if (nextTrimmed.startsWith('+')) {
      const beatFormatted = formatBeatOrDur(note.beat);
      const leadingSpaces = rawLine.match(/^\s*/)?.[0] || '';
      lines[targetLineIndex + 1] = nextRaw.replace(/^\s*\+/, `${leadingSpaces}${beatFormatted}`);
    }
  }

  // Remove the entire line
  lines.splice(targetLineIndex, 1);
  return lines.join('\n');
}

/**
 * Updates track properties (@TRACK name, @CHANNEL, @PROGRAM, CC 7 volume, CC 10 pan) in code.
 * Ensures directives are inserted cleanly before event lines.
 */
export function patchTrackHeader(
  code: string,
  trackId: number,
  updates: { name?: string; channel?: number; program?: number; volume?: number; pan?: number }
): string {
  const lines = code.split('\n');
  const trackRange = findTrackRange(lines, trackId);
  const trackHeaderIndex = trackRange.start;

  if (trackHeaderIndex === -1) {
    return code;
  }

  // Patch track name
  if (updates.name !== undefined) {
    const sanitizedName = updates.name.trim().replace(/\s+/g, '_') || `Track_${trackId}`;
    lines[trackHeaderIndex] = `@TRACK ${trackId} ${sanitizedName}`;
  }

  // Scan the track's header section
  let channelLineIndex = -1;
  let programLineIndex = -1;
  let firstEventIndex = trackRange.end;

  for (let i = trackHeaderIndex + 1; i < trackRange.end; i++) {
    const trimmed = lines[i].split('//')[0].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@TRACK')) break;

    if (trimmed.startsWith('@CHANNEL')) {
      channelLineIndex = i;
    } else if (trimmed.startsWith('@PROGRAM')) {
      programLineIndex = i;
    } else if (!trimmed.startsWith('@')) {
      // Reached events / comments
      firstEventIndex = i;
      break;
    }
  }

  // Update or insert @CHANNEL
  if (updates.channel !== undefined) {
    if (channelLineIndex !== -1) {
      lines[channelLineIndex] = `@CHANNEL ${updates.channel}`;
    } else {
      const insertPos = trackHeaderIndex + 1;
      lines.splice(insertPos, 0, `@CHANNEL ${updates.channel}`);
      if (programLineIndex >= insertPos) programLineIndex++;
      if (firstEventIndex >= insertPos) firstEventIndex++;
      channelLineIndex = insertPos;
    }
  }

  // Update or insert @PROGRAM
  if (updates.program !== undefined) {
    if (programLineIndex !== -1) {
      lines[programLineIndex] = `@PROGRAM ${updates.program}`;
    } else {
      const insertPos = channelLineIndex !== -1 ? channelLineIndex + 1 : trackHeaderIndex + 1;
      lines.splice(insertPos, 0, `@PROGRAM ${updates.program}`);
      if (firstEventIndex >= insertPos) firstEventIndex++;
      programLineIndex = insertPos;
    }
  }

  return lines.join('\n');
}
