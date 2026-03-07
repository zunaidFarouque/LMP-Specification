/**
 * LMP Pass 4: Event list + state → MIDI buffer.
 */
import MidiWriter from 'midi-writer-js';
import { beatToTicks } from './utils.js';

const DEFAULT_BPM = 120;

function semitonesToBend(semitones, pbrange) {
  const r = pbrange || 2;
  const n = Math.max(-r, Math.min(r, semitones));
  return n / r; // -1..1
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

  const midiTracks = [];
  for (let ti = 0; ti < tracks.length; ti++) {
    const trackState = tracks[ti];
    const track = new MidiWriter.Track();
    track.addTrackName(trackState.name ?? `Track_${ti + 1}`);
    const defaultChannel = (trackState.channel ?? 1) - 1;
    const pbrange = trackState.pbrange ?? 2;

    const trackEvents = events.filter(
      (e) =>
        (e.type === 'note' || e.type === 'cc' || e.type === 'pb') && e.trackIndex === ti
    );
    const hasPB = trackEvents.some((e) => e.type === 'pb');
    const metaEvents = events.filter((e) => (e.type === 'tempo' || e.type === 'ts') && e.trackIndex === 0);

    const withTicks = [];
    for (const e of trackEvents) {
      const tick = beatToTicks(e.beat, bpm, ppqn);
      withTicks.push({ ...e, tick });
    }
    for (const e of metaEvents) {
      if (ti === 0) withTicks.push({ ...e, tick: beatToTicks(e.beat, bpm, ppqn) });
    }
    if (ti === 0) {
      withTicks.push({ type: 'tempo', tick: 0, bpm });
    }
    if (hasPB) {
      withTicks.push({ type: 'pb', tick: 0, semitones: 0, trackIndex: ti });
    }
    const maxTick = withTicks.length ? Math.max(...withTicks.map((e) => e.tick)) : 0;
    if (hasPB) {
      withTicks.push({ type: 'pb', tick: maxTick + 1, semitones: 0, trackIndex: ti });
    }
    withTicks.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      const order = { cc: 0, pb: 1, note: 2, tempo: 3, ts: 4 };
      return (order[a.type] ?? 5) - (order[b.type] ?? 5);
    });

    if (trackState.program !== undefined) {
      track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: trackState.program, channel: defaultChannel + 1 }));
    }
    let lastTick = 0;
    for (const ev of withTicks) {
      const delta = ev.tick - lastTick;

      if (ev.type === 'tempo') {
        track.setTempo(ev.bpm ?? bpm, ev.tick);
        lastTick = ev.tick;
        continue;
      }
      if (ev.type === 'ts') {
        track.setTimeSignature(ev.num ?? 4, ev.denom ?? 4);
        lastTick = ev.tick;
        continue;
      }
      if (ev.type === 'cc') {
        track.addEvent(
          new MidiWriter.ControllerChangeEvent({
            controllerNumber: ev.number,
            controllerValue: ev.value,
            delta,
          })
        );
        lastTick = ev.tick;
        continue;
      }
      if (ev.type === 'pb') {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        const bend = semitonesToBend(ev.semitones ?? 0, pbrange);
        track.addEvent(
          new MidiWriter.PitchBendEvent({
            bend,
            channel: ch,
            delta,
          })
        );
        lastTick = ev.tick;
        continue;
      }
      if (ev.type === 'note') {
        const ch = (ev.channel ?? trackState.channel ?? 1);
        const startTick = beatToTicks(ev.beat, bpm, ppqn);
        const endTick = beatToTicks(ev.beat + (ev.duration ?? 0.25), bpm, ppqn);
        const durationTicks = Math.max(1, endTick - startTick);
        const velocity = Math.max(1, Math.min(127, ev.velocity ?? 100));
        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: ev.midi,
            duration: `T${durationTicks}`,
            velocity,
            channel: ch,
            startTick,
          })
        );
        lastTick = ev.tick;
      }
    }

    if (ti === 0 && !withTicks.some((e) => e.type === 'tempo')) {
      track.setTempo(bpm, 0);
    }
    midiTracks.push(track);
  }

  const writer = new MidiWriter.Writer(midiTracks);
  return writer.buildFile();
}
