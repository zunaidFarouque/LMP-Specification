import { useEffect, useRef } from 'react';
import tippy, { type Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/translucent.css';
import type { DrumMap } from '../utils/drumMap';
import { getDefaultDrumMap } from '../utils/drumMap';
import type { ParsedMidi } from '../hooks/useLmpCore';

const NOTE_HEIGHT = 16;
const NOTE_SPACING = 1;
const PIXELS_PER_BEAT = 48;
const TRACK_HEADER_HEIGHT = 24;
const TIMELINE_HEIGHT = 20;
const SEPARATOR_HEIGHT = 2;
const ROW_LABEL_WIDTH = 80;
const PITCH_PADDING = 2; // semitones above/below note range

function ticksToBeat(tick: number, ppqn: number) {
  return tick / ppqn;
}

type TrackNote = { tick: number; noteNumber: number; velocity: number; durationTicks: number };
type Track = { name: string; channel: number; trackIndex: number; notes: TrackNote[] };

function parseMidiToTracks(parsed: ParsedMidi): { tracks: Track[]; ppqn: number; bpm: number } {
  const ppqn = parsed.header?.ticksPerBeat ?? 480;
  let bpm = 120;
  const pendingNoteOns = new Map<number, Map<number, Map<number, { tick: number; velocity: number }>>>();
  const trackNames = new Map<number, string>();
  const trackChannels = new Map<number, number>();
  const trackNotes = new Map<number, TrackNote[]>();

  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const track = parsed.tracks[ti];
    let tick = 0;
    for (const ev of track) {
      tick += ev.deltaTime ?? 0;
      if (ev.type === 'trackName' && ev.text && !trackNames.has(ti)) {
        trackNames.set(ti, String(ev.text).trim());
      }
      if (ev.type === 'setTempo' && ev.microsecondsPerBeat) {
        const mpb = ev.microsecondsPerBeat;
        if (mpb > 0) bpm = Math.round(60000000 / mpb);
      }
      if (ev.type === 'noteOn') {
        const ch = ev.channel ?? 0;
        if (!pendingNoteOns.has(ti)) pendingNoteOns.set(ti, new Map());
        const byCh = pendingNoteOns.get(ti)!;
        if (!byCh.has(ch)) byCh.set(ch, new Map());
        byCh.get(ch)!.set(ev.noteNumber!, { tick, velocity: ev.velocity ?? 64 });
        if (!trackChannels.has(ti)) trackChannels.set(ti, ch);
      }
      if (ev.type === 'noteOff') {
        const ch = ev.channel ?? 0;
        const on = pendingNoteOns.get(ti)?.get(ch)?.get(ev.noteNumber!);
        if (on) {
          if (!trackNotes.has(ti)) trackNotes.set(ti, []);
          trackNotes.get(ti)!.push({
            tick: on.tick,
            noteNumber: ev.noteNumber!,
            velocity: on.velocity,
            durationTicks: tick - on.tick,
          });
          pendingNoteOns.get(ti)!.get(ch)!.delete(ev.noteNumber!);
        }
      }
    }
  }

  const tracks: Track[] = [];
  let outputIndex = 0;
  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const notes = trackNotes.get(ti) ?? [];
    if (notes.length === 0) continue;
    tracks.push({
      name: trackNames.get(ti) ?? `Track ${ti + 1}`,
      channel: (trackChannels.get(ti) ?? 0) + 1,
      trackIndex: outputIndex++,
      notes: notes.sort((a, b) => a.tick - b.tick),
    });
  }
  return { tracks, ppqn, bpm };
}

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToPitchName(n: number): string {
  const octave = Math.floor(n / 12) - 1;
  return PITCH_NAMES[n % 12] + octave;
}

function sourceMapKey(beat: number, trackIndex: number, midi: number): string {
  const b = Math.round(beat * 1000) / 1000;
  return `${b}_${trackIndex}_${midi}`;
}

function renderPianoTrack(
  svg: SVGSVGElement,
  track: Track,
  ppqn: number,
  sourceMap: Map<string, number> | null,
  x0: number,
  y0: number,
  _containerWidth: number
): number {
  const pitches = [...new Set(track.notes.map((n) => n.noteNumber))].sort((a, b) => b - a);
  const pitchMin = Math.max(0, Math.min(...pitches) - PITCH_PADDING);
  const pitchMax = Math.min(127, Math.max(...pitches) + PITCH_PADDING);
  const pitchSpan = pitchMax - pitchMin + 1;
  const gridHeight = pitchSpan * (NOTE_HEIGHT + NOTE_SPACING);
  const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
  const gridWidth = Math.max(maxBeat * PIXELS_PER_BEAT, 200);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${x0}, ${y0})`);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '4');
  label.setAttribute('y', String(TRACK_HEADER_HEIGHT - 6));
  label.setAttribute('fill', '#94a3b8');
  label.setAttribute('font-size', '12');
  label.textContent = track.name;
  g.appendChild(label);

  const contentY = TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT;
  const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridG.setAttribute('transform', `translate(${ROW_LABEL_WIDTH}, ${contentY})`);

  for (let b = 0; b <= Math.ceil(maxBeat); b++) {
    const x = b * PIXELS_PER_BEAT;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', String(-TIMELINE_HEIGHT));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(gridHeight));
    line.setAttribute('stroke', b % 4 === 0 ? '#64748b' : '#334155');
    line.setAttribute('stroke-width', b % 4 === 0 ? '1' : '0.5');
    gridG.appendChild(line);
  }
  const beatStep = maxBeat > 16 ? 4 : maxBeat > 8 ? 2 : 1;
  for (let b = 0; b <= Math.ceil(maxBeat); b += beatStep) {
    const x = b * PIXELS_PER_BEAT + 2;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(-TIMELINE_HEIGHT / 2 + 4));
    text.setAttribute('fill', '#64748b');
    text.setAttribute('font-size', '10');
    text.textContent = String(b);
    gridG.appendChild(text);
  }

  for (let p = pitchMin; p <= pitchMax; p++) {
    const row = pitchMax - p;
    const y = row * (NOTE_HEIGHT + NOTE_SPACING);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(gridWidth));
    rect.setAttribute('height', String(NOTE_HEIGHT + NOTE_SPACING));
    rect.setAttribute('fill', row % 2 === 0 ? '#1e293b' : '#0f172a');
    gridG.appendChild(rect);
    const pitchLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    pitchLabel.setAttribute('x', String(-ROW_LABEL_WIDTH + 4));
    pitchLabel.setAttribute('y', String(y + (NOTE_HEIGHT + NOTE_SPACING) / 2 + 4));
    pitchLabel.setAttribute('fill', '#64748b');
    pitchLabel.setAttribute('font-size', '10');
    pitchLabel.textContent = midiToPitchName(p);
    gridG.appendChild(pitchLabel);
  }

  for (const n of track.notes) {
    const beat = ticksToBeat(n.tick, ppqn);
    const durBeat = n.durationTicks / ppqn;
    const x = beat * PIXELS_PER_BEAT;
    const w = Math.max(durBeat * PIXELS_PER_BEAT, 4);
    const row = pitchMax - n.noteNumber;
    const y = row * (NOTE_HEIGHT + NOTE_SPACING) + NOTE_SPACING / 2;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(NOTE_HEIGHT));
    rect.setAttribute('fill', '#f59e0b');
    rect.setAttribute('rx', '2');
    rect.setAttribute('opacity', String(0.5 + (n.velocity / 255) * 0.5));
    rect.setAttribute('class', 'cursor-pointer');
    gridG.appendChild(rect);
    const pitchName = midiToPitchName(n.noteNumber);
    const beatStr = beat.toFixed(3).replace(/\.?0+$/, '');
    const durStr = durBeat.toFixed(3).replace(/\.?0+$/, '');
    const lineNum = sourceMap?.get(sourceMapKey(beat, track.trackIndex, n.noteNumber));
    const linePart = lineNum != null ? `<br>LMP Line ${lineNum}.` : '';
    const tooltipContent = `${pitchName} • Beat ${beatStr} • Vel ${n.velocity} • ${durStr} beats${linePart}`;
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', String(x));
    fo.setAttribute('y', String(y));
    fo.setAttribute('width', String(w));
    fo.setAttribute('height', String(NOTE_HEIGHT));
    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    div.className = 'piano-roll-note-hit';
    div.setAttribute('data-tooltip', tooltipContent);
    div.style.cssText = 'width:100%;height:100%;cursor:pointer;background:transparent;';
    fo.appendChild(div);
    gridG.appendChild(fo);
  }

  g.appendChild(gridG);
  svg.appendChild(g);
  return TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT + gridHeight;
}

function renderDrumTrack(
  svg: SVGSVGElement,
  track: Track,
  ppqn: number,
  drumMap: DrumMap,
  sourceMap: Map<string, number> | null,
  x0: number,
  y0: number,
  _containerWidth: number
): number {
  const { noteToName, displayOrder } = drumMap;
  const usedNotes = new Set(track.notes.map((n) => n.noteNumber));
  let orderedNotes = displayOrder.filter((n) => usedNotes.has(n));
  for (const n of usedNotes) {
    if (!orderedNotes.includes(n)) orderedNotes.push(n);
  }
  const rowCount = Math.max(orderedNotes.length, 1);
  const rowHeight = NOTE_HEIGHT + NOTE_SPACING;
  const gridHeight = rowCount * rowHeight;
  const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
  const gridWidth = Math.max(maxBeat * PIXELS_PER_BEAT, 200);
  const noteToRow = new Map(orderedNotes.map((n, i) => [n, i]));

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${x0}, ${y0})`);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', '4');
  label.setAttribute('y', String(TRACK_HEADER_HEIGHT - 6));
  label.setAttribute('fill', '#94a3b8');
  label.setAttribute('font-size', '12');
  label.textContent = track.name;
  g.appendChild(label);

  const contentY = TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT;
  const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridG.setAttribute('transform', `translate(${ROW_LABEL_WIDTH}, ${contentY})`);

  for (let b = 0; b <= Math.ceil(maxBeat); b++) {
    const x = b * PIXELS_PER_BEAT;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', String(-TIMELINE_HEIGHT));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(gridHeight));
    line.setAttribute('stroke', b % 4 === 0 ? '#64748b' : '#334155');
    line.setAttribute('stroke-width', b % 4 === 0 ? '1' : '0.5');
    gridG.appendChild(line);
  }
  const beatStep = maxBeat > 16 ? 4 : maxBeat > 8 ? 2 : 1;
  for (let b = 0; b <= Math.ceil(maxBeat); b += beatStep) {
    const x = b * PIXELS_PER_BEAT + 2;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(-TIMELINE_HEIGHT / 2 + 4));
    text.setAttribute('fill', '#64748b');
    text.setAttribute('font-size', '10');
    text.textContent = String(b);
    gridG.appendChild(text);
  }

  for (let i = 0; i < rowCount; i++) {
    const y = i * rowHeight;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(gridWidth));
    rect.setAttribute('height', String(rowHeight));
    rect.setAttribute('fill', i % 2 === 0 ? '#1e293b' : '#0f172a');
    gridG.appendChild(rect);

    const noteNum = orderedNotes[i];
    const name = noteToName.get(noteNum) ?? `Note ${noteNum}`;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(-ROW_LABEL_WIDTH + 4));
    text.setAttribute('y', String(y + rowHeight / 2 + 4));
    text.setAttribute('fill', '#94a3b8');
    text.setAttribute('font-size', '11');
    text.textContent = name;
    gridG.appendChild(text);
  }

  for (const n of track.notes) {
    const row = noteToRow.get(n.noteNumber);
    if (row === undefined) continue;
    const beat = ticksToBeat(n.tick, ppqn);
    const durBeat = n.durationTicks / ppqn;
    const x = beat * PIXELS_PER_BEAT;
    const w = Math.max(durBeat * PIXELS_PER_BEAT, 6);
    const y = row * rowHeight + NOTE_SPACING / 2;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(NOTE_HEIGHT));
    rect.setAttribute('fill', '#f59e0b');
    rect.setAttribute('rx', '2');
    rect.setAttribute('opacity', String(0.5 + (n.velocity / 255) * 0.5));
    rect.setAttribute('class', 'cursor-pointer');
    gridG.appendChild(rect);
    const drumName = noteToName.get(n.noteNumber) ?? `Note ${n.noteNumber}`;
    const beatStr = beat.toFixed(3).replace(/\.?0+$/, '');
    const durStr = durBeat.toFixed(3).replace(/\.?0+$/, '');
    const lineNum = sourceMap?.get(sourceMapKey(beat, track.trackIndex, n.noteNumber));
    const linePart = lineNum != null ? `<br>LMP Line ${lineNum}.` : '';
    const tooltipContent = `${drumName} • Beat ${beatStr} • Vel ${n.velocity} • ${durStr} beats${linePart}`;
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', String(x));
    fo.setAttribute('y', String(y));
    fo.setAttribute('width', String(w));
    fo.setAttribute('height', String(NOTE_HEIGHT));
    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    div.className = 'piano-roll-note-hit';
    div.setAttribute('data-tooltip', tooltipContent);
    div.style.cssText = 'width:100%;height:100%;cursor:pointer;background:transparent;';
    fo.appendChild(div);
    gridG.appendChild(fo);
  }

  g.appendChild(gridG);
  svg.appendChild(g);
  return TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT + gridHeight;
}

type Props = {
  midi: Uint8Array | null;
  sourceMap: Map<string, number> | null;
  drumMap: DrumMap | null;
  parseMidi: ((buf: Uint8Array) => ParsedMidi | null) | null;
};

export function PianoRoll({ midi, sourceMap, drumMap, parseMidi }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const oldSvg = container.querySelector('svg');
    if (oldSvg) oldSvg.remove();

    if (!midi || midi.length === 0 || !parseMidi) {
      const ph = container.querySelector('.placeholder');
      if (ph) (ph as HTMLElement).classList.remove('hidden');
      return;
    }

    const ph = container.querySelector('.placeholder');
    if (ph) (ph as HTMLElement).classList.add('hidden');

    try {
      const parsed = parseMidi(midi) as ParsedMidi | null;
      if (!parsed?.tracks) {
        if (ph) {
          (ph as HTMLElement).textContent = 'No notes in sequence';
          (ph as HTMLElement).classList.remove('hidden');
        }
        return;
      }
      const { tracks, ppqn } = parseMidiToTracks(parsed);
      if (tracks.length === 0) {
        if (ph) {
          (ph as HTMLElement).textContent = 'No notes in sequence';
          (ph as HTMLElement).classList.remove('hidden');
        }
        return;
      }

      const effectiveDrumMap = drumMap ?? getDefaultDrumMap({ short: true });
      let maxBeat = 0;
      for (const t of tracks) {
        const mb = Math.max(...t.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
        if (mb > maxBeat) maxBeat = mb;
      }
      const contentWidth = ROW_LABEL_WIDTH + Math.max(maxBeat * PIXELS_PER_BEAT, 200);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      let y = 0;

      for (let i = 0; i < tracks.length; i++) {
        if (i > 0) {
          const sep = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          sep.setAttribute('x', '0');
          sep.setAttribute('y', String(y));
          sep.setAttribute('width', String(contentWidth));
          sep.setAttribute('height', String(SEPARATOR_HEIGHT));
          sep.setAttribute('fill', '#475569');
          svg.appendChild(sep);
          y += SEPARATOR_HEIGHT;
        }

        const track = tracks[i];
        const isDrum = track.channel === 10;
        const h = isDrum && effectiveDrumMap
          ? renderDrumTrack(svg, track, ppqn, effectiveDrumMap, sourceMap, 0, y, contentWidth)
          : renderPianoTrack(svg, track, ppqn, sourceMap, 0, y, contentWidth);
        y += h;
      }

      svg.setAttribute('height', String(y));
      svg.setAttribute('viewBox', `0 0 ${contentWidth} ${y}`);
      container.appendChild(svg);

      const instances: Instance[] = [];
      container.querySelectorAll('.piano-roll-note-hit').forEach((el) => {
        const content = (el as HTMLElement).dataset.tooltip ?? '';
        const instance = tippy(el, {
          content,
          allowHTML: true,
          theme: 'translucent',
          placement: 'top',
          delay: [200, 0],
          duration: [150, 100],
        });
        instances.push(instance);
      });

      return () => {
        instances.forEach((i) => i.destroy());
      };
    } catch (err) {
      if (ph) {
        (ph as HTMLElement).textContent = 'Visualization error: ' + ((err as Error).message || String(err));
        (ph as HTMLElement).classList.remove('hidden');
      }
    }
  }, [midi, sourceMap, drumMap, parseMidi]);

  return (
    <div ref={containerRef} className="p-4 min-h-full relative">
      <div className="placeholder flex items-center justify-center h-48 text-slate-500 text-sm">
        Compile LMP to see piano roll
      </div>
    </div>
  );
}
