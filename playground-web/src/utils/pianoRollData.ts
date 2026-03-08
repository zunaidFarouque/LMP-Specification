import { Midi } from '@tonejs/midi';
import { getDrumName } from '../constants/gmDrumMap';

/** Parse @MAP name=midiNumber lines from LMP source for inline drum map. */
export function parseLmpDrumMap(lmpText: string): Record<number, string> | null {
  const map: Record<number, string> = {};
  const re = /@MAP\s+(\S+)\s*=\s*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lmpText)) !== null) {
    const name = m[1].trim();
    const num = parseInt(m[2], 10);
    if (!Number.isNaN(num)) map[num] = name;
  }
  return Object.keys(map).length ? map : null;
}

export type Note = {
  startBeat: number;
  durationBeat: number;
  midi: number;
  velocity: number;
  label?: string;
};

export type Track = {
  name: string;
  channel: number;
  notes: Note[];
};

export type PianoRollData = {
  tracks: Track[];
  ticksPerBeat: number;
  startBeat: number;
};

/** @tonejs/midi uses 0-based channels; MIDI channel 10 (drums) = index 9 */
const DRUM_CHANNEL = 9;

function ticksToBeats(ticks: number, ppq: number): number {
  return ticks / ppq;
}

/** MIDI tick 0 = LMP beat 1.0. Convert raw ticks to display beat. */
function ticksToLmpBeat(ticks: number, ppq: number): number {
  return ticksToBeats(ticks, ppq) + 1;
}

/**
 * Build normalized piano roll data from MIDI bytes.
 * Uses GM drum map for channel 10 unless customMap is provided.
 * Inline LMP drum map can be applied by the caller by passing a merged map.
 */
export function buildPianoRollData(
  midiBytes: Uint8Array,
  drumMap?: Record<number, string> | null
): PianoRollData | null {
  try {
    const midi = new Midi(midiBytes);
    const ppq = midi.header.ppq;
    const tracks: Track[] = [];

    for (let i = 0; i < midi.tracks.length; i++) {
      const t = midi.tracks[i];
      const notes: Note[] = [];
      const isDrum = t.channel === DRUM_CHANNEL;

      for (const n of t.notes) {
        const startBeat = ticksToLmpBeat(n.ticks, ppq);
        const durationBeat = ticksToBeats(n.durationTicks, ppq);
        const label = isDrum ? getDrumName(n.midi, drumMap ?? undefined) : undefined;
        notes.push({
          startBeat,
          durationBeat,
          midi: n.midi,
          velocity: n.velocity,
          label,
        });
      }

      tracks.push({
        name: t.name || `Track ${i + 1}`,
        channel: t.channel,
        notes,
      });
    }

    if (tracks.length === 0) {
      return { tracks: [], ticksPerBeat: ppq, startBeat: 0 };
    }

    let minBeat = Infinity;
    for (const track of tracks) {
      for (const n of track.notes) {
        if (n.startBeat < minBeat) minBeat = n.startBeat;
      }
    }
    if (minBeat === Infinity) minBeat = 1;

    // Timeline shows LMP beats (1.0 = first beat). MIDI tick 0 = beat 1.0.
    const startBeat = minBeat >= 1 ? 1 : minBeat;

    return {
      tracks,
      ticksPerBeat: ppq,
      startBeat,
    };
  } catch {
    return null;
  }
}
