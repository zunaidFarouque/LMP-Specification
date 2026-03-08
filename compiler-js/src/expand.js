/**
 * LMP Pass 3: Expand preprocessed lines + state into flat event list.
 */
import { spnToMidi } from './utils.js';

const DEFAULT_VEL = 100;
const DEFAULT_DUR = 0.25;

const RESERVED_PITCH = new Set(['R', 'CC', 'PB', 'TEMPO', 'TS']);
const TYPE_ORDER = { cc: 0, pb: 1, note: 2, rest: 3, tempo: 4, ts: 5 };

function parseBeat(token) {
  const b = parseFloat(token, 10);
  if (Number.isNaN(b) || b < 0) return null;
  return Math.round(b * 1000) / 1000;
}

function resolvePitch(token, map) {
  const upper = (token || '').toUpperCase();
  if (RESERVED_PITCH.has(upper)) return { reserved: upper };
  const spn = spnToMidi(token);
  if (spn !== undefined) return { midi: spn };
  const num = parseInt(token, 10);
  if (!Number.isNaN(num) && num >= 0 && num <= 127) return { midi: num };
  if (map && map[token] !== undefined) return { midi: map[token] };
  return null;
}

function getRuleForPitch(track, pitchToken) {
  if (!track.rules || !track.rules.length) return null;
  const token = (pitchToken || '').toString().trim();
  const upper = token.toUpperCase();
  for (const r of track.rules) {
    const rp = (r.pitch || '').toString().trim().toUpperCase();
    if (rp === upper || rp === token) return r;
    const rMidi = resolvePitch(r.pitch, {});
    if (rMidi && rMidi.midi !== undefined && resolvePitch(token, {})?.midi === rMidi.midi) return r;
  }
  return null;
}

function velocityFromRule(track, pitchToken) {
  const rule = getRuleForPitch(track, pitchToken);
  if (!rule || !rule.velRange) return undefined;
  const [min, max] = rule.velRange;
  return Math.floor((min + max) / 2);
}

function durationFromRule(track, pitchToken) {
  const rule = getRuleForPitch(track, pitchToken);
  if (!rule || rule.dur === undefined) return undefined;
  return rule.dur;
}

function hasLegato(track) {
  return track && track.legato === true;
}

const RANGE_REGEX = /^([\d.]+)-([\d.]+):(.+)$/;
function parseRepeatRange(token) {
  const m = (token || '').match(RANGE_REGEX);
  if (!m) return null;
  const start = parseFloat(m[1], 10);
  const end = parseFloat(m[2], 10);
  const intervalStr = m[3].trim();
  if (start >= end || Number.isNaN(start) || Number.isNaN(end)) return null;
  let interval;
  if (intervalStr.includes('/')) {
    const [num, denom] = intervalStr.split('/').map((s) => parseInt(s.trim(), 10));
    if (!num || !denom || num <= 0 || denom <= 0) return null;
    interval = num / denom;
  } else {
    interval = parseFloat(intervalStr, 10);
    if (Number.isNaN(interval) || interval <= 0) return null;
  }
  const beats = [];
  for (let b = start; b < end - 1e-9; b += interval) {
    beats.push(Math.round(b * 1000) / 1000);
  }
  return { start, end, interval, beats };
}

const TOLERANCE = 0.01;
function beatsMatch(a, b) {
  return Math.abs(a - b) <= TOLERANCE;
}

/**
 * @param {{ type: string, tokens: string[] }[]} lines - Preprocessed lines
 * @param {any} state - From buildState
 * @returns {{ type: string, trackIndex: number, beat: number, midi?: number, velocity?: number, duration?: number }[]}
 */
function applyModifiers(notes, modifierLines) {
  const velOverrides = new Map();
  const durOverrides = new Map();
  const restBeats = new Set();

  for (const { tokens } of modifierLines) {
    const kind = tokens[1];
    if (kind === 'R') {
      for (let k = 2; k < tokens.length; k++) {
        const b = parseFloat(tokens[k], 10);
        if (!Number.isNaN(b)) restBeats.add(b);
      }
    } else if (kind === 'V') {
      const rest = tokens.slice(2).join(' ');
      const groups = rest.split(',').map((s) => s.trim());
      for (const g of groups) {
        const parts = g.split(/\s+/);
        const val = parseInt(parts[parts.length - 1], 10);
        if (Number.isNaN(val)) continue;
        for (let p = 0; p < parts.length - 1; p++) {
          const spec = parts[p];
          const range = spec.match(/^\[([\d.]+)-([\d.]+)\]$/);
          if (range) {
            const start = parseFloat(range[1], 10);
            const end = parseFloat(range[2], 10);
            for (const n of notes) {
              if (n.beat >= start && n.beat < end) velOverrides.set(n.beat, val);
            }
          } else {
            const single = parseFloat(spec.replace(/[\[\]]/g, ''), 10);
            if (!Number.isNaN(single)) velOverrides.set(single, val);
          }
        }
      }
    } else if (kind === 'D') {
      const rest = tokens.slice(2).join(' ');
      const groups = rest.split(',').map((s) => s.trim());
      for (const g of groups) {
        const parts = g.split(/\s+/);
        const val = parseFloat(parts[parts.length - 1], 10);
        if (Number.isNaN(val)) continue;
        for (let p = 0; p < parts.length - 1; p++) {
          const spec = parts[p];
          const range = spec.match(/^\[([\d.]+)-([\d.]+)\]$/);
          if (range) {
            const start = parseFloat(range[1], 10);
            const end = parseFloat(range[2], 10);
            for (const n of notes) {
              if (n.beat >= start && n.beat < end) durOverrides.set(n.beat, val);
            }
          } else {
            const single = parseFloat(spec.replace(/[\[\]]/g, ''), 10);
            if (!Number.isNaN(single)) durOverrides.set(single, val);
          }
        }
      }
    }
  }

  for (const n of notes) {
    if (velOverrides.has(n.beat)) n.velocity = velOverrides.get(n.beat);
    if (durOverrides.has(n.beat)) n.duration = durOverrides.get(n.beat);
  }
  return notes.filter((n) => {
    for (const rb of restBeats) {
      if (beatsMatch(n.beat, rb)) return false;
    }
    return true;
  });
}

export function expand(lines, state, options = {}) {
  const { loose = false, warnings = [] } = options;
  const events = [];
  let currentTrackIndex = -1;
  const map = state.map || {};
  let lastBaseBeat = null;
  let lastRepeatingNotes = null;
  let pendingModifiers = [];

  for (let i = 0; i < lines.length; i++) {
    const { type, tokens, sourceLine } = lines[i];
    if (!tokens.length) continue;

    if (type === 'header') {
      const key = tokens[0].toUpperCase();
      const args = tokens.slice(1);
      if (key === '@TRACK' && tokens[1] !== undefined) {
        const id = parseInt(tokens[1], 10);
        const idx = state.tracks.findIndex((t) => t.id === id);
        if (idx >= 0) currentTrackIndex = idx;
      }
      if (currentTrackIndex >= 0) {
        if (key === '@CHANNEL' && args[0] !== undefined) {
          const ch = parseInt(args[0], 10);
          if (ch >= 1 && ch <= 16) state.tracks[currentTrackIndex].channel = ch;
        }
        if (key === '@PROGRAM' && args[0] !== undefined) {
          const p = parseInt(args[0], 10);
          if (p >= 0 && p <= 127) state.tracks[currentTrackIndex].program = p;
        }
      }
      lastBaseBeat = null;
      lastRepeatingNotes = null;
      pendingModifiers = [];
      continue;
    }

    if (type === 'continuation') {
      if (lastBaseBeat === null) throw new Error('LMP: Orphaned same-beat continuation (+).');
      if (currentTrackIndex < 0) continue;
      const pitchStr = tokens[1];
      if (!pitchStr) continue;
      const track = state.tracks[currentTrackIndex];
      let velocity = track.defaultVel !== undefined ? track.defaultVel : DEFAULT_VEL;
      let duration = track.defaultDur !== undefined ? track.defaultDur : DEFAULT_DUR;
      if (tokens[2] !== undefined && tokens[2] !== '_') {
        const v = parseInt(tokens[2], 10);
        if (!Number.isNaN(v)) velocity = Math.max(1, Math.min(127, v));
      }
      if (tokens[3] !== undefined) {
        const d = parseFloat(tokens[3], 10);
        if (!Number.isNaN(d)) duration = d;
      }
      const pitches = pitchStr.includes(',') ? pitchStr.split(',').map((s) => s.trim()) : [pitchStr];
      for (const p of pitches) {
        const pitch = resolvePitch(p, map);
        if (pitch && !pitch.reserved) {
          events.push({
            type: 'note',
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: lastBaseBeat,
            midi: pitch.midi,
            velocity,
            duration,
            sourceLine,
          });
        }
      }
      continue;
    }

    if (type === 'modifier') {
      if (lastRepeatingNotes === null) throw new Error('LMP: Orphaned modifier (|) — must follow a repeating note.');
      pendingModifiers.push({ type, tokens });
      continue;
    }

    if (type === 'event') {
      if (lastRepeatingNotes) {
        const applied = applyModifiers(lastRepeatingNotes, pendingModifiers);
        events.push(...applied);
        lastRepeatingNotes = null;
        pendingModifiers = [];
      }

      if (currentTrackIndex < 0) {
        const p = (tokens[1] || '').toUpperCase();
        if (p === 'TEMPO' || p === 'TS') throw new Error('LMP: TEMPO and TS must appear after at least one @TRACK.');
        continue;
      }
      const range = parseRepeatRange(tokens[0]);
      if ((tokens[0] || '').match(RANGE_REGEX) && !range) {
        if (loose) warnings.push(`LMP [loose]: Invalid repeating range '${tokens[0]}' (start >= end or invalid interval); skipping`);
        continue;
      }
      const beat = range ? null : parseBeat(tokens[0]);
      if (!range && beat === null) continue;
      const pitchRaw = (tokens[1] || '').toUpperCase();
      const pitch = resolvePitch(tokens[1], map);

      if (pitch && pitch.reserved) {
        if (pitch.reserved === 'R') {
          events.push({ type: 'rest', trackIndex: currentTrackIndex, beat: beat ?? range.beats[0] });
          continue;
        }
        if (pitch.reserved === 'CC') {
          if (tokens[2] === '_' || tokens[3] === '_') {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (underscore invalid); skipping`);
              continue;
            }
            throw new Error('LMP: CC requires numeric controller number and value; underscore is invalid.');
          }
          if (tokens[2] === undefined || tokens[3] === undefined) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (missing controller number or value); skipping`);
              continue;
            }
            throw new Error('LMP: CC requires both controller number (column 3) and value (column 4).');
          }
          const num = parseInt(tokens[2], 10);
          const val = parseInt(tokens[3], 10);
          if (Number.isNaN(num) || Number.isNaN(val)) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (non-numeric controller/value); skipping`);
              continue;
            }
            continue;
          }
          events.push({
            type: 'cc',
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: beat ?? 0,
            number: Math.max(0, Math.min(127, num)),
            value: Math.max(0, Math.min(127, val)),
          });
          continue;
        }
        if (pitch.reserved === 'PB') {
          const raw = tokens[2] !== undefined ? parseFloat(tokens[2], 10) : NaN;
          if (tokens[2] === undefined || Number.isNaN(raw)) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid PB row at beat ${beat ?? tokens[0]} (missing or invalid bend value); skipping`);
              continue;
            }
            throw new Error('LMP: PB requires a valid bend value in column 3.');
          }
          const semitones = raw;
          const pbrange = state.tracks[currentTrackIndex]?.pbrange ?? 2;
          const clamped = Math.max(-pbrange, Math.min(pbrange, semitones));
          events.push({
            type: 'pb',
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: beat ?? 0,
            semitones: clamped,
          });
          continue;
        }
        if (pitch.reserved === 'TEMPO') {
          if (state.tracks.length === 0) throw new Error('LMP: TEMPO must appear after at least one @TRACK.');
          const bpm = parseFloat(tokens[2], 10);
          events.push({ type: 'tempo', trackIndex: 0, beat: beat ?? 0, bpm: Number.isNaN(bpm) ? 120 : bpm });
          continue;
        }
        if (pitch.reserved === 'TS') {
          if (state.tracks.length === 0) throw new Error('LMP: Time signature (TS) must appear after at least one @TRACK.');
          const num = parseInt(tokens[2], 10);
          const denom = parseInt(tokens[3], 10);
          events.push({ type: 'ts', trackIndex: 0, beat: beat ?? 0, num: Number.isNaN(num) ? 4 : num, denom: Number.isNaN(denom) ? 4 : denom });
          continue;
        }
      }

      const track = state.tracks[currentTrackIndex];
      let velocity = tokens[2] !== undefined && tokens[2] !== '_' ? (() => {
        const v = parseInt(tokens[2], 10);
        return Number.isNaN(v) ? (velocityFromRule(track, tokens[1]) ?? track.defaultVel ?? DEFAULT_VEL) : Math.max(1, Math.min(127, v));
      })() : (velocityFromRule(track, tokens[1]) ?? track.defaultVel ?? DEFAULT_VEL);
      let duration = tokens[3] !== undefined ? (() => {
        const d = parseFloat(tokens[3], 10);
        return Number.isNaN(d) ? (durationFromRule(track, tokens[1]) ?? track.defaultDur ?? DEFAULT_DUR) : d;
      })() : (durationFromRule(track, tokens[1]) ?? (hasLegato(track) ? undefined : (track.defaultDur ?? DEFAULT_DUR)));

      if (!range && (tokens[1] || '').includes(',')) {
        const chordPitches = tokens[1].split(',').map((s) => s.trim());
        const resolved = chordPitches.map((s) => resolvePitch(s, map)).filter((p) => p && !p.reserved);
        for (let ci = 0; ci < resolved.length; ci++) {
          const p = resolved[ci];
          const vel = velocityFromRule(track, chordPitches[ci]) ?? velocity;
          const dur = durationFromRule(track, chordPitches[ci]) ?? duration ?? (track.defaultDur ?? DEFAULT_DUR);
          events.push({
            type: 'note',
            trackIndex: currentTrackIndex,
            channel: track.channel,
            beat,
            midi: p.midi,
            velocity: vel,
            duration: dur,
            sourceLine,
          });
        }
        lastBaseBeat = beat;
        continue;
      }

      if (range && pitch && !pitch.reserved) {
        const midi = pitch.midi;
        const ch = state.tracks[currentTrackIndex]?.channel;
        const notes = range.beats.map((b) => ({
          type: 'note',
          trackIndex: currentTrackIndex,
          channel: ch,
          beat: b,
          midi,
          velocity,
          duration,
          sourceLine,
        }));
        lastRepeatingNotes = notes;
        lastBaseBeat = null;
        pendingModifiers = [];
        continue;
      }

      if (!pitch || pitch.reserved) continue;

      const needLegato = hasLegato(track) && duration === undefined;
      const dur = duration !== undefined ? duration : (needLegato ? undefined : (track.defaultDur ?? DEFAULT_DUR));
      events.push({
        type: 'note',
        trackIndex: currentTrackIndex,
        channel: track.channel,
        beat,
        midi: pitch.midi,
        velocity,
        duration: dur,
        _legato: needLegato,
        sourceLine,
      });
      lastBaseBeat = beat;
    }
  }

  if (lastRepeatingNotes) {
    const applied = applyModifiers(lastRepeatingNotes, pendingModifiers);
    events.push(...applied);
  }

  const ppqn = state.ppqn ?? 480;
  const legatoGapBeats = 2 / ppqn;
  for (let ti = 0; ti < (state.tracks || []).length; ti++) {
    const track = state.tracks[ti];
    if (!hasLegato(track)) continue;
    const trackNotes = events.filter((e) => e.type === 'note' && e.trackIndex === ti);
    const trackStops = events.filter((e) => (e.type === 'note' || e.type === 'rest') && e.trackIndex === ti).map((e) => e.beat).sort((a, b) => a - b);
    for (const n of trackNotes) {
      if (!n._legato) continue;
      const nextStop = trackStops.find((b) => b > n.beat);
      if (nextStop !== undefined) {
        n.duration = Math.max(0.001, nextStop - n.beat - legatoGapBeats);
      } else {
        n.duration = track.defaultDur ?? DEFAULT_DUR;
      }
      delete n._legato;
    }
  }

  events.sort((a, b) => {
    if (a.beat !== b.beat) return a.beat - b.beat;
    if (a.type === 'note' && b.type === 'note') return (a.midi ?? 0) - (b.midi ?? 0);
    return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  });
  return events;
}
