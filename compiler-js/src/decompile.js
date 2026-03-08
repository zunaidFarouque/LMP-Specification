/**
 * MIDI → LMP decompiler. Converts binary MIDI to LMP text.
 */
import { parseMidi } from 'midi-file';
import { midiToSpn, ticksToBeat } from './utils.js';

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

/**
 * Parse MIDI and extract flat event list with absolute ticks.
 * @param {{ header: { ticksPerBeat?: number }, tracks: Array<Array<{ deltaTime: number, type: string, channel?: number, noteNumber?: number, velocity?: number, controllerType?: number, value?: number, microsecondsPerBeat?: number, numerator?: number, denominator?: number, programNumber?: number }>> }} parsed
 * @returns {{ events: Array<{ type: string, trackIndex: number, tick: number, channel?: number, noteNumber?: number, velocity?: number, durationTicks?: number, controllerType?: number, value?: number, bpm?: number, numerator?: number, denominator?: number, programNumber?: number }>, ppqn: number, bpm: number, timesig: { num: number, denom: number } }}
 */
function extractEvents(parsed) {
  const ppqn = parsed.header?.ticksPerBeat ?? DEFAULT_PPQN;
  let bpm = DEFAULT_BPM;
  let timesig = { num: 4, denom: 4 };

  const allEvents = [];
  const pendingNoteOns = new Map(); // trackIndex -> channel -> noteNumber -> { tick, velocity }

  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const track = parsed.tracks[ti];
    let tick = 0;

    for (const ev of track) {
      tick += ev.deltaTime ?? 0;

      if (ev.type === 'setTempo') {
        bpm = microsecondsToBpm(ev.microsecondsPerBeat);
        allEvents.push({ type: 'tempo', trackIndex: ti, tick, bpm });
        continue;
      }
      if (ev.type === 'timeSignature') {
        timesig = { num: ev.numerator ?? 4, denom: ev.denominator ?? 4 };
        allEvents.push({ type: 'ts', trackIndex: ti, tick, numerator: timesig.num, denominator: timesig.denom });
        continue;
      }
      if (ev.type === 'programChange') {
        allEvents.push({ type: 'programChange', trackIndex: ti, tick, channel: ev.channel, programNumber: ev.programNumber });
        continue;
      }
      if (ev.type === 'controller') {
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
        byCh.get(ch).set(ev.noteNumber, { tick, velocity: ev.velocity ?? 64 });
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

  return { events: allEvents, ppqn, bpm, timesig };
}

/**
 * Group events by track and tick, sort by tick then by type order (CC, PB, note).
 */
function groupAndSort(events, ppqn) {
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
 * @param {{ preferSpn?: boolean, precision?: number }} [options] - preferSpn: use SPN for tonal (default true); precision: beat decimals (default 3)
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
  const { events, ppqn, bpm, timesig } = extractEvents(parsed);
  const byTrack = groupAndSort(events, ppqn);

  const lines = [];
  lines.push('@LMP 1.0');
  lines.push(`@BPM ${bpm}`);
  lines.push(`@TIMESIG ${timesig.num}/${timesig.denom}`);
  lines.push(`@PPQN ${ppqn}`);
  lines.push('');

  const roundBeat = (b) => Math.round(b * Math.pow(10, precision)) / Math.pow(10, precision);

  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const trackEvents = byTrack.get(ti) ?? [];
    const hasNotes = trackEvents.some((e) => e.type === 'note');
    const hasCC = trackEvents.some((e) => e.type === 'cc');
    const hasPB = trackEvents.some((e) => e.type === 'pb');
    const hasTempo = trackEvents.some((e) => e.type === 'tempo');
    const hasTS = trackEvents.some((e) => e.type === 'ts');
    if (!hasNotes && !hasCC && !hasPB && !hasTempo && !hasTS) continue;

    const channel = trackEvents.find((e) => e.channel !== undefined)?.channel ?? 0;
    const displayChannel = channel + 1;
    // Meta-only track (tempo/ts) needs a channel for LMP; use 1
    const effectiveChannel = hasNotes || hasCC || hasPB ? displayChannel : 1;
    const program = trackEvents.find((e) => e.type === 'programChange')?.programNumber;

    const trackName = `Track_${ti + 1}`;
    lines.push(`@TRACK ${ti + 1} ${trackName}`);
    lines.push(`@CHANNEL ${effectiveChannel}`);
    if (program !== undefined) lines.push(`@PROGRAM ${program}`);
    lines.push('');

    const noteGroups = new Map(); // tick -> [{ noteNumber, velocity, durationTicks }]
    const ccAtTick = [];
    const pbAtTick = [];
    const tempoAtTick = [];
    const tsAtTick = [];

    for (const e of trackEvents) {
      const beat = roundBeat(ticksToBeat(e.tick, ppqn));
      if (e.type === 'note') {
        if (!noteGroups.has(e.tick)) noteGroups.set(e.tick, []);
        noteGroups.get(e.tick).push({
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
      const beat = roundBeat(ticksToBeat(e.tick, ppqn));
      if (['note', 'cc', 'pb', 'tempo', 'ts'].includes(e.type)) allBeats.add(beat);
    }

    const sortedBeats = [...allBeats].sort((a, b) => a - b);

    for (const beat of sortedBeats) {
      const tick = Math.round(beat * ppqn);

      for (const e of tempoAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} TEMPO ${e.bpm}`);
      }
      for (const e of tsAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} TS ${e.numerator ?? 4} ${e.denominator ?? 4}`);
      }
      for (const e of ccAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} CC ${e.controllerType} ${e.value}`);
      }
      for (const e of pbAtTick.filter((x) => x.beat === beat)) {
        const semitones = pitchBendToSemitones(e.value);
        lines.push(`${beat} PB ${semitones}`);
      }

      const notes = noteGroups.get(tick) ?? [];
      if (notes.length > 0) {
        notes.sort((a, b) => a.noteNumber - b.noteNumber);
        const isDrum = displayChannel === 10;
        const pitchStr = notes
          .map((n) => (isDrum || !preferSpn ? String(n.noteNumber) : (midiToSpn(n.noteNumber) ?? String(n.noteNumber))))
          .join(',');
        const vel = notes[0].velocity;
        const durTicks = notes[0].durationTicks ?? ppqn / 4;
        const durBeats = Math.round((durTicks / ppqn) * 1000) / 1000;
        lines.push(`${beat} ${pitchStr} ${vel} ${durBeats}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
