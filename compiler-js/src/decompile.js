/**
 * MIDI → LMP decompiler. Converts binary MIDI to LMP text.
 * MIDI tick 0 = LMP beat 1.0 (display convention).
 */
import { parseMidi } from 'midi-file';
import { midiToSpn, ticksToBeat } from './utils.js';

function tickToLmpBeat(tick, ppqn) {
  return ticksToBeat(tick, ppqn) + 1;
}

const DEFAULT_BPM = 120;
const DEFAULT_PPQN = 480;
const DEFAULT_PBRANGE = 2;

function microsecondsToBpm(microsecondsPerBeat) {
  if (!microsecondsPerBeat || microsecondsPerBeat <= 0) return DEFAULT_BPM;
  return Math.round(60000000 / microsecondsPerBeat);
}

function pitchBendToSemitones(value, pbrange = DEFAULT_PBRANGE) {
  // value is -8192 to 8191 (midi-file format)
  const normalized = value / 8192;
  return Math.round(normalized * pbrange * 100) / 100;
}

function sanitizeTrackName(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  const sanitized = raw.trim().replace(/[^A-Za-z0-9_]/g, '_');
  return sanitized.length > 0 ? sanitized : fallback;
}

/**
 * Quantize durations close to standard musical lengths (e.g. 2-tick legato gap recovery).
 */
function quantizeTicks(ticks, ppqn, tolerance = 3) {
  if (ticks <= 0) return 0;
  const ratios = [
    1, 2, 3, 4, 5, 6, 7, 8, 12, 16,
    0.5, 0.25, 0.75, 1.5, 2.5, 3.5,
    0.125, 0.375, 0.625, 0.875,
    0.0625, 0.1875, 0.3125,
    1 / 3, 2 / 3, 4 / 3, 1 / 6, 5 / 6, 1 / 12, 1 / 24,
  ];
  for (const r of ratios) {
    const targetTicks = Math.round(r * ppqn);
    if (Math.abs(ticks - targetTicks) <= tolerance) {
      return targetTicks;
    }
  }
  return ticks;
}

/**
 * Parse MIDI and extract flat event list with absolute ticks and track metadata.
 */
function extractEvents(parsed) {
  const ppqn = parsed.header?.ticksPerBeat ?? DEFAULT_PPQN;
  let bpm = DEFAULT_BPM;
  let timesig = { num: 4, denom: 4 };

  const allEvents = [];
  const trackNames = [];
  const trackPbranges = [];
  const pendingNoteOns = new Map(); // trackIndex -> channel -> noteNumber -> { tick, velocity }

  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const track = parsed.tracks[ti];
    let tick = 0;
    let rpnState = { msb: null, lsb: null };

    for (const ev of track) {
      tick += ev.deltaTime ?? 0;

      if (ev.type === 'trackName' || ev.type === 'sequenceTrackName') {
        const raw = ev.text || ev.name;
        if (raw && !trackNames[ti]) trackNames[ti] = raw;
        continue;
      }
      if (ev.type === 'setTempo') {
        const eventBpm = microsecondsToBpm(ev.microsecondsPerBeat);
        if (tick === 0 && allEvents.filter((e) => e.type === 'tempo' && e.tick === 0).length === 0) {
          bpm = eventBpm;
        }
        allEvents.push({ type: 'tempo', trackIndex: ti, tick, bpm: eventBpm });
        continue;
      }
      if (ev.type === 'timeSignature') {
        const ts = { num: ev.numerator ?? 4, denom: ev.denominator ?? 4 };
        if (tick === 0 && allEvents.filter((e) => e.type === 'ts' && e.tick === 0).length === 0) {
          timesig = ts;
        }
        allEvents.push({ type: 'ts', trackIndex: ti, tick, numerator: ts.num, denominator: ts.denom });
        continue;
      }
      if (ev.type === 'programChange') {
        allEvents.push({ type: 'programChange', trackIndex: ti, tick, channel: ev.channel, programNumber: ev.programNumber });
        continue;
      }
      if (ev.type === 'controller') {
        // Track RPN 00 00 sensitivity configuration
        if (ev.controllerType === 101) {
          rpnState.msb = ev.value;
          continue;
        }
        if (ev.controllerType === 100) {
          rpnState.lsb = ev.value;
          continue;
        }
        if (ev.controllerType === 6 && rpnState.msb === 0 && rpnState.lsb === 0) {
          trackPbranges[ti] = ev.value;
          continue;
        }
        if (ev.controllerType === 38 && rpnState.msb === 0 && rpnState.lsb === 0) {
          continue;
        }

        allEvents.push({
          type: 'cc',
          trackIndex: ti,
          tick,
          channel: ev.channel,
          controllerType: ev.controllerType,
          value: ev.value,
        });
        continue;
      }
      if (ev.type === 'pitchBend') {
        allEvents.push({
          type: 'pb',
          trackIndex: ti,
          tick,
          channel: ev.channel,
          value: ev.value,
        });
        continue;
      }
      if (ev.type === 'noteOn') {
        const ch = ev.channel ?? 0;
        if (!pendingNoteOns.has(ti)) pendingNoteOns.set(ti, new Map());
        const byCh = pendingNoteOns.get(ti);
        if (!byCh.has(ch)) byCh.set(ch, new Map());
        // Standard MIDI: NoteOn with velocity 0 is treated as NoteOff
        if ((ev.velocity ?? 64) === 0) {
          const on = byCh.get(ev.noteNumber);
          if (on) {
            allEvents.push({
              type: 'note',
              trackIndex: ti,
              tick: on.tick,
              channel: ch,
              noteNumber: ev.noteNumber,
              velocity: on.velocity,
              durationTicks: tick - on.tick,
            });
            byCh.delete(ev.noteNumber);
          }
        } else {
          byCh.get(ch).set(ev.noteNumber, { tick, velocity: ev.velocity ?? 64 });
        }
        continue;
      }
      if (ev.type === 'noteOff') {
        const ch = ev.channel ?? 0;
        const byCh = pendingNoteOns.get(ti)?.get(ch);
        const on = byCh?.get(ev.noteNumber);
        if (on) {
          allEvents.push({
            type: 'note',
            trackIndex: ti,
            tick: on.tick,
            channel: ch,
            noteNumber: ev.noteNumber,
            velocity: on.velocity,
            durationTicks: tick - on.tick,
          });
          byCh.delete(ev.noteNumber);
        }
        continue;
      }
    }
  }

  return { events: allEvents, ppqn, bpm, timesig, trackNames, trackPbranges };
}

/**
 * Group events by track and tick, sort by tick then by type order.
 */
function groupAndSort(events) {
  const byTrack = new Map();
  for (const e of events) {
    const ti = e.trackIndex;
    if (!byTrack.has(ti)) byTrack.set(ti, []);
    byTrack.get(ti).push(e);
  }
  const order = { cc: 0, pb: 1, note: 2, tempo: 3, ts: 4, programChange: 5 };
  for (const arr of byTrack.values()) {
    arr.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return (order[a.type] ?? 6) - (order[b.type] ?? 6);
    });
  }
  return byTrack;
}

/**
 * Decompile MIDI buffer to LMP text.
 * @param {Uint8Array|Buffer|ArrayLike<number>} midiBuffer - Raw MIDI file bytes
 * @param {{ preferSpn?: boolean, precision?: number }} [options]
 * @returns {string} LMP text
 */
export function decompile(midiBuffer, options = {}) {
  const preferSpn = options?.preferSpn !== false;
  const precision = options?.precision ?? 3;

  const buffer = midiBuffer instanceof Uint8Array
    ? midiBuffer
    : (typeof Buffer !== 'undefined' && Buffer.isBuffer(midiBuffer))
      ? new Uint8Array(midiBuffer)
      : new Uint8Array(Array.from(midiBuffer));

  const parsed = parseMidi(buffer);
  const { events, ppqn, bpm, timesig, trackNames, trackPbranges } = extractEvents(parsed);
  const byTrack = groupAndSort(events);

  const lines = [];
  lines.push('@LMP 1.0');
  lines.push(`@BPM ${bpm}`);
  lines.push(`@TIMESIG ${timesig.num}/${timesig.denom}`);
  lines.push(`@PPQN ${ppqn}`);
  lines.push('');

  const roundBeat = (b) => Math.round(b * Math.pow(10, precision)) / Math.pow(10, precision);

  // Identify playable tracks vs conductor-only tracks
  const playableTrackIndices = [];
  const conductorMetaEvents = [];

  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const trackEvents = byTrack.get(ti) ?? [];
    const hasNotes = trackEvents.some((e) => e.type === 'note');
    const hasCC = trackEvents.some((e) => e.type === 'cc');
    const hasPB = trackEvents.some((e) => e.type === 'pb');
    const hasProgram = trackEvents.some((e) => e.type === 'programChange');

    if (hasNotes || hasCC || hasPB || hasProgram) {
      playableTrackIndices.push(ti);
    } else {
      // Conductor track: collect any tempo/TS changes for later insertion
      for (const e of trackEvents) {
        if (e.type === 'tempo' || e.type === 'ts') conductorMetaEvents.push(e);
      }
    }
  }

  // If no playable tracks were found (e.g. meta-only file), keep all non-empty tracks
  if (playableTrackIndices.length === 0) {
    for (let ti = 0; ti < parsed.tracks.length; ti++) {
      if ((byTrack.get(ti) ?? []).length > 0) playableTrackIndices.push(ti);
    }
  }

  let lmpTrackNumber = 1;

  for (let pi = 0; pi < playableTrackIndices.length; pi++) {
    const ti = playableTrackIndices[pi];
    const trackEvents = byTrack.get(ti) ?? [];

    // If first playable track, attach any conductor track meta events (deduped)
    if (pi === 0 && conductorMetaEvents.length > 0) {
      for (const ce of conductorMetaEvents) {
        if (!trackEvents.some((te) => te.type === ce.type && te.tick === ce.tick)) {
          trackEvents.push(ce);
        }
      }
      trackEvents.sort((a, b) => a.tick - b.tick);
    }

    const channel = trackEvents.find((e) => e.channel !== undefined)?.channel ?? 0;
    const displayChannel = channel + 1;
    const program = trackEvents.find((e) => e.type === 'programChange')?.programNumber;
    const pbrange = trackPbranges[ti] ?? DEFAULT_PBRANGE;

    const rawName = trackNames[ti];
    const trackName = sanitizeTrackName(rawName, `Track_${lmpTrackNumber}`);

    lines.push(`@TRACK ${lmpTrackNumber} ${trackName}`);
    lines.push(`@CHANNEL ${displayChannel}`);
    if (program !== undefined) lines.push(`@PROGRAM ${program}`);
    if (pbrange !== DEFAULT_PBRANGE) lines.push(`@PBRANGE ${pbrange}`);
    lines.push('');

    const noteGroups = new Map(); // tick -> [{ noteNumber, velocity, durationTicks }]
    const ccAtTick = [];
    const pbAtTick = [];
    const tempoAtTick = [];
    const tsAtTick = [];

    // Find the max note end tick to safely omit auto-reset PB 0.0 at track end
    let maxNoteEndTick = 0;

    for (const e of trackEvents) {
      const beat = roundBeat(tickToLmpBeat(e.tick, ppqn));
      if (e.type === 'note') {
        const end = e.tick + (e.durationTicks ?? 0);
        if (end > maxNoteEndTick) maxNoteEndTick = end;
        if (!noteGroups.has(beat)) noteGroups.set(beat, []);
        noteGroups.get(beat).push({
          noteNumber: e.noteNumber,
          velocity: e.velocity,
          durationTicks: e.durationTicks,
        });
      } else if (e.type === 'cc') {
        ccAtTick.push({ beat, ...e });
      } else if (e.type === 'pb') {
        pbAtTick.push({ beat, ...e });
      } else if (e.type === 'tempo') {
        tempoAtTick.push({ beat, ...e });
      } else if (e.type === 'ts') {
        tsAtTick.push({ beat, ...e });
      }
    }

    const allBeats = new Set();
    for (const e of trackEvents) {
      const beat = roundBeat(tickToLmpBeat(e.tick, ppqn));
      if (['note', 'cc', 'pb', 'tempo', 'ts'].includes(e.type)) allBeats.add(beat);
    }

    const sortedBeats = [...allBeats].sort((a, b) => a - b);

    for (const beat of sortedBeats) {
      // Deduplicate tempo events between header and tick 0
      for (const e of tempoAtTick.filter((x) => x.beat === beat)) {
        if (e.tick === 0 && e.bpm === bpm) continue;
        lines.push(`${beat} TEMPO ${e.bpm}`);
      }

      // Deduplicate time signature events between header and tick 0
      for (const e of tsAtTick.filter((x) => x.beat === beat)) {
        if (e.tick === 0 && e.numerator === timesig.num && e.denominator === timesig.denom) continue;
        lines.push(`${beat} TS ${e.numerator ?? 4} ${e.denominator ?? 4}`);
      }

      for (const e of ccAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} CC ${e.controllerType} ${e.value}`);
      }

      const pbs = pbAtTick.filter((x) => x.beat === beat);
      for (let pbi = 0; pbi < pbs.length; pbi++) {
        const e = pbs[pbi];
        // Omit trailing compiler auto-reset PB 0.0 after all notes end
        if (e.value === 0 && e.tick > maxNoteEndTick && maxNoteEndTick > 0) continue;
        // If multiple PB events share the exact same beat, emit the last one
        if (pbi < pbs.length - 1) continue;
        const semitones = pitchBendToSemitones(e.value, pbrange);
        lines.push(`${beat} PB ${semitones}`);
      }

      const notes = noteGroups.get(beat) ?? [];
      if (notes.length > 0) {
        notes.sort((a, b) => a.noteNumber - b.noteNumber);
        const isDrum = displayChannel === 10;

        // Group notes by velocity and duration for multi-line polyphony (+) support
        const groups = [];
        for (const n of notes) {
          const qDurTicks = quantizeTicks(n.durationTicks ?? ppqn / 4, ppqn);
          const durBeats = Math.round((qDurTicks / ppqn) * 1000) / 1000;
          const vel = n.velocity;
          let grp = groups.find((g) => g.velocity === vel && g.durBeats === durBeats);
          if (!grp) {
            grp = { velocity: vel, durBeats, notes: [] };
            groups.push(grp);
          }
          grp.notes.push(n);
        }

        // Base line
        const g0 = groups[0];
        const p0 = g0.notes
          .map((n) => (isDrum || !preferSpn ? String(n.noteNumber) : (midiToSpn(n.noteNumber) ?? String(n.noteNumber))))
          .join(',');
        lines.push(`${beat} ${p0} ${g0.velocity} ${g0.durBeats}`);

        // Continuation lines (+) when simultaneous notes differ in duration or velocity
        for (let gi = 1; gi < groups.length; gi++) {
          const g = groups[gi];
          const p = g.notes
            .map((n) => (isDrum || !preferSpn ? String(n.noteNumber) : (midiToSpn(n.noteNumber) ?? String(n.noteNumber))))
            .join(',');
          lines.push(`+ ${p} ${g.velocity} ${g.durBeats}`);
        }
      }
    }

    lines.push('');
    lmpTrackNumber++;
  }

  return lines.join('\n').trimEnd();
}
