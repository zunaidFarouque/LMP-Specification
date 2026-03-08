/**
 * LMP Pass 2: Build global and per-track state from headers.
 */

const DEFAULT_PPQN = 480;
const DEFAULT_TIMESIG = { num: 4, denom: 4 };
const DEFAULT_PBRANGE = 2;
const TRACK_NAME_REGEX = /^[A-Za-z0-9_]+$/;
const MAP_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * @param {{ type: string, tokens: string[] }[]} lines - Preprocessed lines
 * @param {{ loose?: boolean, warnings?: string[] }} [options] - Loose mode options
 * @returns {{ version?: string, bpm?: number, timesig: { num: number, denom: number }, ppqn: number, tracks: any[], map: Record<string, number> }}
 */
export function buildState(lines, options = {}) {
  const { loose = false, warnings = [] } = options;
  const state = {
    version: undefined,
    bpm: undefined,
    timesig: { ...DEFAULT_TIMESIG },
    ppqn: DEFAULT_PPQN,
    tracks: [],
    map: Object.create(null),
  };

  let currentTrackIndex = -1;

  for (const { type, tokens } of lines) {
    if (type === 'event' || type === 'continuation' || type === 'modifier') {
      if (state.tracks.length === 0) {
        throw new Error('LMP: Events must appear after at least one @TRACK declaration.');
      }
      const track = state.tracks[currentTrackIndex];
      if (track && track.channel === undefined) {
        if (loose) {
          track.channel = 1;
          warnings.push(`LMP [loose]: Track ${track.id} (${track.name}) missing @CHANNEL; assuming channel 1`);
        } else {
          throw new Error('LMP: Each track must declare @CHANNEL before events.');
        }
      }
      continue;
    }

    if (type !== 'header' || !tokens.length) continue;
    const key = tokens[0].toUpperCase();
    const args = tokens.slice(1);

    switch (key) {
      case '@LMP':
        if (args[0]) state.version = args[0];
        break;
      case '@BPM':
        if (args[0] !== undefined) state.bpm = parseFloat(args[0], 10);
        break;
      case '@TIMESIG':
        if (args[0]) {
          const parts = args[0].split('/');
          if (parts.length >= 2) {
            const num = parseInt(parts[0], 10);
            const denom = parseInt(parts[1], 10);
            if (!isNaN(num) && !isNaN(denom)) state.timesig = { num, denom };
          }
        }
        break;
      case '@PPQN':
        if (args[0] !== undefined) {
          const n = parseInt(args[0], 10);
          if (!isNaN(n)) state.ppqn = n;
        }
        break;
      case '@TRACK': {
        const id = args[0] !== undefined ? parseInt(args[0], 10) : NaN;
        const name = args[1];
        if (!name || !TRACK_NAME_REGEX.test(name)) {
          throw new Error('LMP: @TRACK requires a name (alphanumeric and underscores only).');
        }
        if (isNaN(id)) {
          throw new Error('LMP: @TRACK requires a track number.');
        }
        state.tracks.push({
          id,
          name,
          channel: undefined,
          program: undefined,
          pbrange: DEFAULT_PBRANGE,
          defaultVel: undefined,
          defaultDur: undefined,
          rules: [],
        });
        currentTrackIndex = state.tracks.length - 1;
        break;
      }
      case '@CHANNEL':
        if (currentTrackIndex >= 0 && args[0] !== undefined) {
          const ch = parseInt(args[0], 10);
          if (ch >= 1 && ch <= 16) state.tracks[currentTrackIndex].channel = ch;
        }
        break;
      case '@PROGRAM':
        if (currentTrackIndex >= 0 && args[0] !== undefined) {
          const p = parseInt(args[0], 10);
          if (p >= 0 && p <= 127) state.tracks[currentTrackIndex].program = p;
        }
        break;
      case '@PBRANGE':
        if (currentTrackIndex >= 0 && args[0] !== undefined) {
          const r = parseInt(args[0], 10);
          if (!isNaN(r)) state.tracks[currentTrackIndex].pbrange = r;
        }
        break;
      case '@MAP': {
        const pair = args[0];
        if (!pair || !pair.includes('=')) break;
        const [name, val] = pair.split('=').map((s) => s.trim());
        if (!name || !MAP_NAME_REGEX.test(name)) {
          throw new Error('LMP: @MAP name must be alphanumeric and underscores only, and cannot start with a digit.');
        }
        const midi = parseInt(val, 10);
        if (!Number.isNaN(midi) && midi >= 0 && midi <= 127) state.map[name] = midi;
        break;
      }
      case '@INHERIT': {
        if (currentTrackIndex < 0 || args[0] === undefined) break;
        const fromId = parseInt(args[0], 10);
        const fromIdx = state.tracks.findIndex((t) => t.id === fromId);
        if (fromIdx < 0) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from non-existent track ${fromId}; skipping`);
            break;
          }
          throw new Error('LMP: @INHERIT from non-existent track.');
        }
        if (fromIdx === currentTrackIndex) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from same track (${fromId}) is invalid; skipping`);
            break;
          }
          throw new Error('LMP: @INHERIT from same track is invalid.');
        }
        if (fromIdx > currentTrackIndex) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from track ${fromId} declared later is invalid; skipping`);
            break;
          }
          throw new Error('LMP: @INHERIT from track declared later is invalid.');
        }
        const from = state.tracks[fromIdx];
        const list = args[1] ? args[1].toUpperCase().split(',').map((s) => s.trim()) : ['VEL', 'DUR', 'CHANNEL', 'PROGRAM', 'PBRANGE', 'RULE'];
        const cur = state.tracks[currentTrackIndex];
        if (list.includes('VEL')) cur.defaultVel = from.defaultVel;
        if (list.includes('DUR')) cur.defaultDur = from.defaultDur;
        if (list.includes('CHANNEL')) cur.channel = from.channel;
        if (list.includes('PROGRAM')) cur.program = from.program;
        if (list.includes('PBRANGE')) cur.pbrange = from.pbrange;
        if (list.includes('RULE')) cur.rules = [...(from.rules || [])];
        break;
      }
      case '@RESET_TRACK':
        if (currentTrackIndex >= 0) {
          state.tracks[currentTrackIndex].defaultVel = undefined;
          state.tracks[currentTrackIndex].defaultDur = undefined;
          state.tracks[currentTrackIndex].rules = [];
        }
        break;
      case '@DEFAULT_VEL':
        if (currentTrackIndex >= 0 && args[0] !== undefined) {
          const v = parseInt(args[0], 10);
          if (!isNaN(v)) state.tracks[currentTrackIndex].defaultVel = Math.max(1, Math.min(127, v));
        }
        break;
      case '@DEFAULT_DUR':
        if (currentTrackIndex >= 0 && args[0] !== undefined) {
          const d = parseFloat(args[0], 10);
          if (!isNaN(d)) state.tracks[currentTrackIndex].defaultDur = d;
        }
        break;
      case '@RULE':
        if (currentTrackIndex >= 0 && args.length >= 1) {
          const full = args.join(' ').toUpperCase();
          if (full.includes('LEGATO=TRUE')) {
            state.tracks[currentTrackIndex].legato = true;
            break;
          }
          const pitch = args[0];
          const ruleStr = args.slice(1).join(' ').toUpperCase();
          const velMatch = ruleStr.match(/VEL=(\d+)-(\d+)/);
          const durMatch = ruleStr.match(/DUR=([\d.]+)/);
          const rule = {};
          if (velMatch) rule.velRange = [parseInt(velMatch[1], 10), parseInt(velMatch[2], 10)];
          if (durMatch) rule.dur = parseFloat(durMatch[1], 10);
          if (Object.keys(rule).length) {
            state.tracks[currentTrackIndex].rules = state.tracks[currentTrackIndex].rules || [];
            state.tracks[currentTrackIndex].rules.push({ pitch, ...rule });
          }
        }
        break;
      default:
        break;
    }
  }

  return state;
}
