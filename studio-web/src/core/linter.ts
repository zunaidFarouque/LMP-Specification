import { compile } from 'lmp-core';
import { spnToMidi } from './sourceMapBridge';

export interface LmpDiagnostic {
  from: number; // 0-based char offset
  to: number;   // 0-based char offset
  line: number; // 1-based line number
  col: number;  // 1-based column number
  severity: 'error' | 'warning' | 'info';
  message: string;
}

const KNOWN_DIRECTIVES = new Set([
  '@LMP',
  '@BPM',
  '@TIMESIG',
  '@PPQN',
  '@ORIGIN',
  '@SEED',
  '@MAP',
  '@RULE',
  '@TRACK',
  '@CHANNEL',
  '@PROGRAM',
  '@PBRANGE',
  '@INHERIT',
  '@RESET_TRACK',
  '@DEFAULT_VEL',
  '@DEFAULT_DUR',
  '@DRUM',
]);

const RESERVED_EVENT_TYPES = new Set(['R', 'CC', 'PB', 'TEMPO', 'TS']);
const SPN_REGEX = /^[A-Ga-g][#b♭♯]?-?\d+$/;

function isValidSinglePitch(p: string, customMapNames?: Set<string>): boolean {
  if (!p) return false;
  if (customMapNames && customMapNames.has(p.toLowerCase())) return true;
  // MIDI number 0-127
  if (/^\d+$/.test(p)) {
    const num = parseInt(p, 10);
    return num >= 0 && num <= 127;
  }
  if (!SPN_REGEX.test(p)) return false;
  const midi = spnToMidi(p);
  return midi >= 0 && midi <= 127;
}

function isValidPitchToken(token: string, customMapNames?: Set<string>): boolean {
  if (!token) return false;
  if (RESERVED_EVENT_TYPES.has(token.toUpperCase())) return true;
  // Comma-separated chord
  const parts = token.split(',');
  if (parts.length > 1) {
    return parts.every((p) => isValidSinglePitch(p.trim(), customMapNames));
  }
  return isValidSinglePitch(token, customMapNames);
}

/**
 * Lints an LMP document and returns diagnostics with exact character offsets
 * for inline squiggly underlines and hover tooltips.
 */
export function lintLmpDocument(code: string): LmpDiagnostic[] {
  const diagnostics: LmpDiagnostic[] = [];
  const lines = code.split('\n');

  // Pre-scan @MAP directives to support custom drum and instrument aliases
  const customMapNames = new Set<string>();
  for (const line of lines) {
    const trimmed = line.split('//')[0].trim();
    if (trimmed.startsWith('@MAP')) {
      const rest = trimmed.replace(/^@MAP\s+/i, '').trim();
      const match = rest.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(\d+)$/) || rest.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);
      if (match) {
        customMapNames.add(match[1].toLowerCase());
      }
    }
  }

  let hasSeenTrack = false;
  let charOffset = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const rawLine = lines[lineIdx];
    const lineStartOffset = charOffset;
    charOffset += rawLine.length + 1; // +1 for the newline

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    // Directives
    if (trimmed.startsWith('@')) {
      const tokens = trimmed.split(/\s+/);
      const directive = tokens[0].toUpperCase();

      if (!KNOWN_DIRECTIVES.has(directive)) {
        const tokenCol = rawLine.indexOf(tokens[0]);
        diagnostics.push({
          line: lineNum,
          col: tokenCol + 1,
          from: lineStartOffset + tokenCol,
          to: lineStartOffset + tokenCol + tokens[0].length,
          severity: 'error',
          message: `Unknown directive '${tokens[0]}'. Expected @TRACK, @CHANNEL, @PROGRAM, @BPM, @TIMESIG, etc.`,
        });
        continue;
      }

      if (directive === '@TRACK') {
        hasSeenTrack = true;
        const trackIdStr = tokens[1];
        const trackName = tokens.slice(2).join('_');

        if (!trackIdStr || isNaN(parseInt(trackIdStr, 10))) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: '@TRACK requires a numeric track ID (e.g. @TRACK 1 Piano).',
          });
        } else if (!trackName) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: '@TRACK requires a name (alphanumeric and underscores only, e.g. @TRACK 1 Piano).',
          });
        } else if (!/^[A-Za-z0-9_]+$/.test(trackName)) {
          const nameCol = rawLine.indexOf(tokens[2]);
          diagnostics.push({
            line: lineNum,
            col: nameCol + 1,
            from: lineStartOffset + nameCol,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid track name '${trackName}'. Names must contain only alphanumeric characters and underscores.`,
          });
        }
      } else if (directive === '@CHANNEL') {
        const chStr = tokens[1];
        const ch = parseInt(chStr, 10);
        if (!chStr || isNaN(ch) || ch < 1 || ch > 16) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid MIDI channel '${chStr ?? ''}'. Channel must be an integer between 1 and 16.`,
          });
        }
      } else if (directive === '@PROGRAM') {
        const prgStr = tokens[1];
        const prg = parseInt(prgStr, 10);
        if (!prgStr || isNaN(prg) || prg < 0 || prg > 127) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid program number '${prgStr ?? ''}'. Program must be an integer between 0 and 127.`,
          });
        }
      } else if (directive === '@BPM') {
        const bpmStr = tokens[1];
        const bpm = parseFloat(bpmStr);
        if (!bpmStr || isNaN(bpm) || bpm <= 0) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid BPM value '${bpmStr ?? ''}'. Expected a positive number (e.g. @BPM 120).`,
          });
        }
      } else if (directive === '@TIMESIG') {
        const tsStr = tokens[1];
        if (!tsStr || !/^\d+\/\d+$/.test(tsStr)) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid time signature '${tsStr ?? ''}'. Expected format 'N/D' (e.g. @TIMESIG 4/4).`,
          });
        }
      } else if (directive === '@DEFAULT_VEL') {
        const velStr = tokens[1];
        const v = parseInt(velStr, 10);
        if (!velStr || isNaN(v) || v < 1 || v > 127) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid default velocity '${velStr ?? ''}'. Expected integer between 1 and 127.`,
          });
        }
      } else if (directive === '@DEFAULT_DUR') {
        const durStr = tokens[1];
        const d = parseFloat(durStr);
        if (!durStr || isNaN(d) || d <= 0) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid default duration '${durStr ?? ''}'. Expected positive number.`,
          });
        }
      } else if (directive === '@MAP') {
        const rest = tokens.slice(1).join(' ').trim();
        const match = rest.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(\d+)$/) || rest.match(/^([A-Za-z0-9_]+)\s+(\d+)$/);
        if (!match) {
          const col = rawLine.indexOf(tokens[0]);
          diagnostics.push({
            line: lineNum,
            col: col + 1,
            from: lineStartOffset + col,
            to: lineStartOffset + trimmed.length,
            severity: 'error',
            message: `Invalid @MAP definition '${rest}'. Expected format '@MAP alias=midiNumber' (e.g. @MAP kick=36).`,
          });
        } else {
          const midi = parseInt(match[2], 10);
          if (midi < 0 || midi > 127) {
            const col = rawLine.indexOf(tokens[0]);
            diagnostics.push({
              line: lineNum,
              col: col + 1,
              from: lineStartOffset + col,
              to: lineStartOffset + trimmed.length,
              severity: 'error',
              message: `Invalid MIDI number '${match[2]}' in @MAP. Expected integer between 0 and 127.`,
            });
          }
        }
      }
      continue;
    }

    // Pattern / rule modifier lines starting with '|'
    if (trimmed.startsWith('|')) {
      if (!hasSeenTrack) {
        diagnostics.push({
          line: lineNum,
          col: 1,
          from: lineStartOffset + rawLine.indexOf('|'),
          to: lineStartOffset + rawLine.length,
          severity: 'error',
          message: 'Events must appear after at least one @TRACK declaration.',
        });
      }
      continue;
    }

    // Event lines (notes, repeating patterns, rests, CC)
    const commentIdx = rawLine.indexOf('//');
    const codePart = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const tokens = codePart.trim().split(/\s+/);
    if (!tokens[0]) continue;

    const firstToken = tokens[0];
    const isContinuation = firstToken === '+';
    const rangeMatch = firstToken.match(/^(\d+(\.\d+)?)-(\d+(\.\d+)?):(\d+(\/\d+)?)$/);
    const isBeatNum = !isNaN(parseFloat(firstToken)) && /^\d+(\.\d+)?$/.test(firstToken);

    // If first token is not a valid continuation, range, or beat number, flag syntax error
    if (!isContinuation && !rangeMatch && !isBeatNum) {
      const col = rawLine.indexOf(firstToken);
      diagnostics.push({
        line: lineNum,
        col: col + 1,
        from: lineStartOffset + col,
        to: lineStartOffset + col + firstToken.length,
        severity: 'error',
        message: `Invalid event line: first token '${firstToken}' must be a beat number (e.g. 1.0), continuation (+), or repeating range (e.g. 1.0-5.0:1/2).`,
      });
      continue;
    }

    if (!hasSeenTrack) {
      const col = rawLine.indexOf(firstToken);
      diagnostics.push({
        line: lineNum,
        col: col + 1,
        from: lineStartOffset + col,
        to: lineStartOffset + rawLine.length,
        severity: 'error',
        message: 'Events must appear after at least one @TRACK declaration.',
      });
      continue;
    }

    // Check repeat range validity
    if (rangeMatch) {
      const startBeat = parseFloat(rangeMatch[1]);
      const endBeat = parseFloat(rangeMatch[3]);
      if (startBeat >= endBeat) {
        const col = rawLine.indexOf(firstToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + firstToken.length,
          severity: 'error',
          message: `Invalid repeating range '${firstToken}': end beat must be strictly greater than start beat.`,
        });
      }
    }

    // Check beat value
    if (isBeatNum) {
      const b = parseFloat(firstToken);
      if (b < 0) {
        const col = rawLine.indexOf(firstToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + firstToken.length,
          severity: 'error',
          message: `Invalid beat '${firstToken}'. Beat must be a non-negative number.`,
        });
      }
    }

    // Pitch check (token 1)
    const pitchToken = tokens[1];
    if (!pitchToken) {
      const col = rawLine.indexOf(firstToken);
      diagnostics.push({
        line: lineNum,
        col: col + 1,
        from: lineStartOffset + col,
        to: lineStartOffset + rawLine.length,
        severity: 'error',
        message: 'Missing event pitch or type (e.g. C4, R, CC, PB).',
      });
      continue;
    }

    const upperPitch = pitchToken.toUpperCase();

    // Check CC events: beat CC controller value
    if (upperPitch === 'CC') {
      const ccNumToken = tokens[2];
      const ccValToken = tokens[3];
      const ccNum = parseInt(ccNumToken, 10);
      const ccVal = parseInt(ccValToken, 10);

      if (!ccNumToken || isNaN(ccNum) || ccNum < 0 || ccNum > 127) {
        const col = rawLine.indexOf(ccNumToken || pitchToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + (ccNumToken ? ccNumToken.length : pitchToken.length),
          severity: 'error',
          message: `Invalid CC controller number '${ccNumToken ?? ''}'. Expected integer between 0 and 127 (e.g. CC 7 100).`,
        });
      }

      if (!ccValToken || isNaN(ccVal) || ccVal < 0 || ccVal > 127) {
        const col = rawLine.indexOf(ccValToken || pitchToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + (ccValToken ? ccValToken.length : pitchToken.length),
          severity: 'error',
          message: `Invalid CC value '${ccValToken ?? ''}'. Expected integer between 0 and 127 (e.g. CC 7 100).`,
        });
      }
      continue;
    }

    // Check Pitch Bend events: beat PB semitones
    if (upperPitch === 'PB') {
      const pbToken = tokens[2];
      const pbVal = parseFloat(pbToken);
      if (!pbToken || isNaN(pbVal)) {
        const col = rawLine.indexOf(pbToken || pitchToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + (pbToken ? pbToken.length : pitchToken.length),
          severity: 'error',
          message: `Invalid PB bend value '${pbToken ?? ''}'. Expected semitones (e.g. PB 2.0 or PB -2.0).`,
        });
      }
      continue;
    }

    // Check TEMPO events: beat TEMPO bpm
    if (upperPitch === 'TEMPO') {
      const bpmToken = tokens[2];
      const bpmVal = parseFloat(bpmToken);
      if (!bpmToken || isNaN(bpmVal) || bpmVal <= 0) {
        const col = rawLine.indexOf(bpmToken || pitchToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + (bpmToken ? bpmToken.length : pitchToken.length),
          severity: 'error',
          message: `Invalid TEMPO value '${bpmToken ?? ''}'. Expected a positive number (e.g. TEMPO 120).`,
        });
      }
      continue;
    }

    // Check TS events: beat TS N/D
    if (upperPitch === 'TS') {
      const tsToken = tokens[2];
      if (!tsToken || !/^\d+\/\d+$/.test(tsToken)) {
        const col = rawLine.indexOf(tsToken || pitchToken);
        diagnostics.push({
          line: lineNum,
          col: col + 1,
          from: lineStartOffset + col,
          to: lineStartOffset + col + (tsToken ? tsToken.length : pitchToken.length),
          severity: 'error',
          message: `Invalid time signature '${tsToken ?? ''}'. Expected format 'N/D' (e.g. TS 4/4).`,
        });
      }
      continue;
    }

    // Check Rest events
    if (upperPitch === 'R') {
      continue;
    }

    // Standard pitch / chord
    if (!isValidPitchToken(pitchToken, customMapNames)) {
      const pitchCol = rawLine.indexOf(pitchToken);
      diagnostics.push({
        line: lineNum,
        col: pitchCol + 1,
        from: lineStartOffset + pitchCol,
        to: lineStartOffset + pitchCol + pitchToken.length,
        severity: 'error',
        message: `Invalid pitch token '${pitchToken}'. Expected SPN pitch (e.g. C4, F#3), MIDI number (0-127), or chord (e.g. C4,E4,G4).`,
      });
    }

    // Velocity check (token 2)
    const velToken = tokens[2];
    if (velToken && velToken !== '_') {
      const vel = parseInt(velToken, 10);
      if (isNaN(vel) || vel < 0 || vel > 127) {
        const velCol = rawLine.indexOf(velToken);
        diagnostics.push({
          line: lineNum,
          col: velCol + 1,
          from: lineStartOffset + velCol,
          to: lineStartOffset + velCol + velToken.length,
          severity: 'error',
          message: `Invalid velocity '${velToken}'. Expected 0-127 or '_' for default.`,
        });
      }
    }

    // Duration check (token 3)
    const durToken = tokens[3];
    if (durToken && durToken !== '_') {
      const dur = parseFloat(durToken);
      if (isNaN(dur) || dur <= 0) {
        const durCol = rawLine.indexOf(durToken);
        diagnostics.push({
          line: lineNum,
          col: durCol + 1,
          from: lineStartOffset + durCol,
          to: lineStartOffset + durCol + durToken.length,
          severity: 'error',
          message: `Invalid duration '${durToken}'. Expected a positive number or '_' for default.`,
        });
      }
    }
  }

  // Compiler catch-all for deep parser/grammar errors
  try {
    compile(code, { loose: false });
  } catch (err: any) {
    const lineNum = err.line ?? 1;
    const colNum = err.col ?? 1;
    const hasExisting = diagnostics.some((d) => d.line === lineNum);

    if (!hasExisting) {
      let from = 0;
      let to = code.length;

      let currentOffset = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i + 1 === lineNum) {
          from = currentOffset + Math.max(0, colNum - 1);
          to = currentOffset + lines[i].length;
          break;
        }
        currentOffset += lines[i].length + 1;
      }

      diagnostics.push({
        line: lineNum,
        col: colNum,
        from,
        to: Math.max(from + 1, to),
        severity: 'error',
        message: err.message || 'Syntax error in LMP document',
      });
    }
  }

  return diagnostics;
}
