import { parseMidi } from '../../compiler-js/src/index.js';
import { midiToSpn } from '../../compiler-js/src/utils.js';

/**
 * Converts MIDI bytes to standard Tone.js / Magenta style MIDI-JSON representation
 */
export function midiToJson(midiBytes) {
  const parsed = parseMidi(midiBytes);
  const ppqn = parsed.header.ticksPerBeat || 480;
  let tempo = 120;

  for (const track of parsed.tracks) {
    for (const evt of track) {
      if (evt.type === 'setTempo' && evt.microsecondsPerBeat) {
        tempo = Math.round(60000000 / evt.microsecondsPerBeat);
        break;
      }
    }
  }

  const jsonTracks = [];

  for (let i = 0; i < parsed.tracks.length; i++) {
    const rawTrack = parsed.tracks[i];
    let tick = 0;
    let trackName = `Track ${i + 1}`;
    const notes = [];
    const active = new Map();

    for (const evt of rawTrack) {
      tick += evt.deltaTime || 0;
      if (evt.type === 'trackName' && evt.text) {
        trackName = evt.text;
      } else if (evt.type === 'noteOn' && evt.velocity > 0) {
        const key = `${evt.channel ?? 0}:${evt.noteNumber}`;
        active.set(key, { startTick: tick, velocity: evt.velocity });
      } else if (evt.type === 'noteOff' || (evt.type === 'noteOn' && evt.velocity === 0)) {
        const key = `${evt.channel ?? 0}:${evt.noteNumber}`;
        const noteStart = active.get(key);
        if (noteStart) {
          active.delete(key);
          const startBeat = Math.round((noteStart.tick / ppqn) * 1000) / 1000;
          const durBeats = Math.round(((tick - noteStart.tick) / ppqn) * 1000) / 1000;
          notes.push({
            name: midiToSpn ? midiToSpn(evt.noteNumber) : `Note-${evt.noteNumber}`,
            midi: evt.noteNumber,
            beat: startBeat,
            duration: durBeats,
            velocity: noteStart.velocity / 127
          });
        }
      }
    }

    if (notes.length > 0) {
      jsonTracks.push({
        name: trackName,
        channel: rawTrack.find(e => e.channel != null)?.channel ?? 0,
        notes
      });
    }
  }

  return JSON.stringify({
    header: {
      ppqn,
      tempo,
      numTracks: jsonTracks.length
    },
    tracks: jsonTracks
  }, null, 2);
}

/**
 * Converts MIDI bytes to standard MIDI-CSV representation
 */
export function midiToCsv(midiBytes) {
  const parsed = parseMidi(midiBytes);
  const ppqn = parsed.header.ticksPerBeat || 480;
  const lines = [];

  // Header rows
  lines.push(`0, 0, Header, 1, ${parsed.tracks.length}, ${ppqn}`);

  for (let t = 0; t < parsed.tracks.length; t++) {
    const track = parsed.tracks[t];
    let tick = 0;
    const trackNum = t + 1;
    lines.push(`${trackNum}, 0, Start_track`);

    for (const evt of track) {
      tick += evt.deltaTime || 0;
      if (evt.type === 'trackName') {
        lines.push(`${trackNum}, ${tick}, Title_t, "${evt.text || ''}"`);
      } else if (evt.type === 'setTempo') {
        lines.push(`${trackNum}, ${tick}, Tempo, ${evt.microsecondsPerBeat}`);
      } else if (evt.type === 'timeSignature') {
        lines.push(`${trackNum}, ${tick}, Time_signature, ${evt.numerator}, ${evt.denominator}, 24, 8`);
      } else if (evt.type === 'noteOn' && evt.velocity > 0) {
        lines.push(`${trackNum}, ${tick}, Note_on_c, ${evt.channel ?? 0}, ${evt.noteNumber}, ${evt.velocity}`);
      } else if (evt.type === 'noteOff' || (evt.type === 'noteOn' && evt.velocity === 0)) {
        lines.push(`${trackNum}, ${tick}, Note_off_c, ${evt.channel ?? 0}, ${evt.noteNumber}, 0`);
      } else if (evt.type === 'controlChange') {
        lines.push(`${trackNum}, ${tick}, Control_c, ${evt.channel ?? 0}, ${evt.controllerType}, ${evt.value}`);
      } else if (evt.type === 'pitchBend') {
        lines.push(`${trackNum}, ${tick}, Pitch_bend_c, ${evt.channel ?? 0}, ${evt.value}`);
      }
    }

    lines.push(`${trackNum}, ${tick}, End_track`);
  }

  lines.push(`0, 0, End_of_file`);
  return lines.join('\n');
}
