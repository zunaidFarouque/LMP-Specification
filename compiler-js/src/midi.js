/**
 * LMP Pass 4: Event list + state → MIDI buffer.
 * Uses midi-file for writing with 480 ppqn (matches internal state).
 * LMP beat 1.0 = MIDI tick 0 (absolute start). LMP beat 2.0 = tick 480, etc.
 */
import { writeMidi } from 'midi-file';
import { beatToTicks } from './utils.js';

const DEFAULT_BPM = 120;
const MICROSECONDS_PER_MINUTE = 60000000;

function semitonesToBend(semitones, pbrange) {
  const r = pbrange || 2;
  const n = Math.max(-r, Math.min(r, semitones));
  return n / r; // -1..1
}

function bendToMidi14(zeroOne) {
  // zeroOne in [-1, 1] → MIDI 14-bit value in [-8192, 8191]
  const v = Math.max(-1, Math.min(1, zeroOne));
  return Math.round((v + 1) * 8191.5) - 8192;
}

/**
 * @param {{ type: string, trackIndex: number, beat: number, midi?: number, velocity?: number, duration?: number, number?: number, value?: number, semitones?: number, bpm?: number, num?: number, denom?: number }[]} events
 * @param {any} state
 * @returns {Uint8Array}
 */
export function eventsToMidi(events, state) {
  const bpm = state.bpm ?? DEFAULT_BPM;
  const ppqn = state.ppqn ?? 480;
  const tracks = state.tracks || [];
  const timesig = state.timesig || { num: 4, denom: 4 };

  const midiTracks = [];

  for (let ti = 0; ti < tracks.length; ti++) {
    const trackState = tracks[ti];
    const defaultChannel = (trackState.channel ?? 1) - 1;
    const pbrange = trackState.pbrange ?? 2;

    const trackEvents = events.filter(
      (e) =>
        (e.type === 'note' || e.type === 'cc' || e.type === 'pb') && e.trackIndex === ti
    );
    const hasPB = trackEvents.some((e) => e.type === 'pb');
    const metaEvents = events.filter((e) => (e.type === 'tempo' || e.type === 'ts') && e.trackIndex === 0);

    let origin = state.origin;
    if (origin === undefined) {
      // If any event beat is < 1.0 (e.g. 0.0), origin defaults to 0; otherwise 1 for backward compatibility
      const hasSubOneBeat = events.some((e) => e.beat !== undefined && e.beat < 1.0);
      origin = hasSubOneBeat ? 0 : 1;
    }
    const lmpBeatToTick = (b) => Math.max(0, beatToTicks(b - origin, bpm, ppqn));

    const withTicks = [];

    // 1. Conductor Track Meta Events (Tempo & TS) at Tick 0
    if (ti === 0) {
      const hasTickZeroTempo = metaEvents.some((e) => lmpBeatToTick(e.beat) === 0 && e.type === 'tempo');
      if (!hasTickZeroTempo) {
        withTicks.push({ type: 'tempo', tick: 0, bpm });
      }
      const hasTickZeroTs = metaEvents.some((e) => lmpBeatToTick(e.beat) === 0 && e.type === 'ts');
      if (!hasTickZeroTs) {
        withTicks.push({ type: 'ts', tick: 0, num: timesig.num, denom: timesig.denom });
      }
      for (const e of metaEvents) {
        withTicks.push({ ...e, tick: lmpBeatToTick(e.beat) });
      }
    }

    // 2. Track Setup: Pitch Bend Sensitivity RPN 00 00
    if (hasPB || (trackState.pbrange !== undefined && trackState.pbrange !== 2)) {
      withTicks.push({ type: 'cc', tick: 0, channel: trackState.channel, number: 101, value: 0 });
      withTicks.push({ type: 'cc', tick: 0, channel: trackState.channel, number: 100, value: 0 });
      withTicks.push({ type: 'cc', tick: 0, channel: trackState.channel, number: 6, value: pbrange });
      withTicks.push({ type: 'cc', tick: 0, channel: trackState.channel, number: 38, value: 0 });
    }

    // 3. Track Setup: Center Pitch Bend (PB 0.0) if track has PB but no explicit PB at tick 0
    const hasTickZeroPB = trackEvents.some((e) => e.type === 'pb' && lmpBeatToTick(e.beat) === 0);
    if (hasPB && !hasTickZeroPB) {
      withTicks.push({ type: 'pb', tick: 0, semitones: 0, trackIndex: ti });
    }

    // 4. Track Events (Notes, CC, PB)
    for (const e of trackEvents) {
      withTicks.push({ ...e, tick: lmpBeatToTick(e.beat) });
    }

    // 5. Pitch Bend Auto-Reset at track end
    const noteEndTicks = trackEvents
      .filter((e) => e.type === 'note')
      .map((e) => lmpBeatToTick(e.beat + (e.duration ?? 0.25)));
    const otherTicks = withTicks.map((e) => e.tick);
    const maxTick = Math.max(0, ...noteEndTicks, ...otherTicks);
    if (hasPB) {
      withTicks.push({ type: 'pb', tick: maxTick + 1, semitones: 0, trackIndex: ti });
    }

    // Expand notes to noteOn/noteOff pairs for correct chord ordering
    const flatEvents = [];
    for (const ev of withTicks) {
      if (ev.type === 'note') {
        const startTick = lmpBeatToTick(ev.beat);
        const endTick = lmpBeatToTick(ev.beat + (ev.duration ?? 0.25));
        const durationTicks = Math.max(1, endTick - startTick);
        flatEvents.push({ type: 'noteOn', tick: startTick, ev, durationTicks });
        flatEvents.push({ type: 'noteOff', tick: startTick + durationTicks, ev });
      } else {
        flatEvents.push({ type: ev.type, tick: ev.tick, ev });
      }
    }

    const FLAT_ORDER = {
      tempo: 0,
      ts: 0,
      cc: 1,
      pb: 2,
      noteOff: 3,
      noteOn: 4,
    };

    flatEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      const orderA = FLAT_ORDER[a.type] ?? 99;
      const orderB = FLAT_ORDER[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      if (a.type === 'noteOn' && b.type === 'noteOn') {
        return (a.ev.midi ?? 0) - (b.ev.midi ?? 0);
      }
      if (a.type === 'noteOff' && b.type === 'noteOff') {
        return (a.ev.midi ?? 0) - (b.ev.midi ?? 0);
      }
      return 0;
    });

    const trackEventsOut = [];
    let lastTick = 0;

    // Track name
    trackEventsOut.push({
      deltaTime: 0,
      type: 'trackName',
      text: trackState.name ?? `Track_${ti + 1}`,
    });

    // Program change if set
    if (trackState.program !== undefined) {
      trackEventsOut.push({
        deltaTime: 0,
        type: 'programChange',
        channel: defaultChannel,
        programNumber: trackState.program,
      });
    }

    for (const { type, tick, ev } of flatEvents) {
      const delta = tick - lastTick;

      if (type === 'tempo') {
        trackEventsOut.push({
          deltaTime: delta,
          type: 'setTempo',
          microsecondsPerBeat: Math.round(MICROSECONDS_PER_MINUTE / (ev.bpm ?? bpm)),
        });
        lastTick = tick;
        continue;
      }
      if (type === 'ts') {
        trackEventsOut.push({
          deltaTime: delta,
          type: 'timeSignature',
          numerator: ev.num ?? 4,
          denominator: ev.denom ?? 4,
          metronome: 24,
          thirtyseconds: 8,
        });
        lastTick = tick;
        continue;
      }
      if (type === 'cc') {
        trackEventsOut.push({
          deltaTime: delta,
          type: 'controller',
          channel: (ev.channel ?? trackState.channel ?? 1) - 1,
          controllerType: ev.number,
          value: ev.value,
        });
        lastTick = tick;
        continue;
      }
      if (type === 'pb') {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        const bend = semitonesToBend(ev.semitones ?? 0, pbrange);
        trackEventsOut.push({
          deltaTime: delta,
          type: 'pitchBend',
          channel: ch,
          value: bendToMidi14(bend),
        });
        lastTick = tick;
        continue;
      }
      if (type === 'noteOn') {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        const velocity = Math.max(1, Math.min(127, ev.velocity ?? 100));
        trackEventsOut.push({
          deltaTime: delta,
          type: 'noteOn',
          channel: ch,
          noteNumber: ev.midi,
          velocity,
        });
        lastTick = tick;
        continue;
      }
      if (type === 'noteOff') {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        trackEventsOut.push({
          deltaTime: delta,
          type: 'noteOff',
          channel: ch,
          noteNumber: ev.midi,
          velocity: 0,
        });
        lastTick = tick;
      }
    }

    trackEventsOut.push({
      deltaTime: 0,
      type: 'endOfTrack',
    });

    midiTracks.push(trackEventsOut);
  }

  const midiData = {
    header: {
      format: 1,
      numTracks: midiTracks.length,
      ticksPerBeat: ppqn,
    },
    tracks: midiTracks,
  };

  const bytes = writeMidi(midiData);
  return new Uint8Array(bytes);
}
