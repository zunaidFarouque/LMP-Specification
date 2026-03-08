import { useEffect, useRef, useState, useCallback } from 'react';
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
const PAN_BUFFER = 400; // extra space so panned content is not clipped

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

function beatToX(beat: number, startBeat: number): number {
  return (beat - startBeat) * PIXELS_PER_BEAT;
}

function formatBeatLabel(b: number): string {
  return b % 1 === 0 ? String(Math.round(b)) : b.toFixed(1);
}

function createUnstretchedText(
  parent: SVGGElement,
  x: number,
  y: number,
  content: string,
  scaleX: number,
  scaleY: number,
  attrs: { fill?: string; fontSize?: string }
): void {
  const scaleText = Math.min(scaleX, scaleY);
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  wrapper.setAttribute('class', 'text-unstretch');
  wrapper.setAttribute('data-x', String(x));
  wrapper.setAttribute('data-y', String(y));
  wrapper.setAttribute('transform', `translate(${x},${y}) scale(${scaleText / scaleX},${scaleText / scaleY})`);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '0');
  text.setAttribute('y', '0');
  text.setAttribute('fill', attrs.fill ?? '#64748b');
  text.setAttribute('font-size', attrs.fontSize ?? '10');
  text.textContent = content;
  wrapper.appendChild(text);
  parent.appendChild(wrapper);
}

/** For left column: scaleX=1 so text stays fixed width, only scaleY affects size */
function createLeftColText(
  parent: SVGGElement,
  x: number,
  y: number,
  content: string,
  scaleY: number,
  attrs: { fill?: string; fontSize?: string }
): void {
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  wrapper.setAttribute('class', 'text-unstretch-left');
  wrapper.setAttribute('data-x', String(x));
  wrapper.setAttribute('data-y', String(y));
  wrapper.setAttribute('transform', `translate(${x},${y}) scale(1,${1 / scaleY})`);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '0');
  text.setAttribute('y', '0');
  text.setAttribute('fill', attrs.fill ?? '#64748b');
  text.setAttribute('font-size', attrs.fontSize ?? '10');
  text.textContent = content;
  wrapper.appendChild(text);
  parent.appendChild(wrapper);
}

type TrackParents = { leftCol: SVGGElement; timeline: SVGGElement };

function renderPianoTrack(
  parents: TrackParents,
  track: Track,
  ppqn: number,
  sourceMap: Map<string, number> | null,
  x0: number,
  y0: number,
  _contentWidth: number,
  scaleX: number,
  scaleY: number
): number {
  const pitches = [...new Set(track.notes.map((n) => n.noteNumber))].sort((a, b) => b - a);
  const pitchMin = Math.max(0, Math.min(...pitches) - PITCH_PADDING);
  const pitchMax = Math.min(127, Math.max(...pitches) + PITCH_PADDING);
  const pitchSpan = pitchMax - pitchMin + 1;
  const gridHeight = pitchSpan * (NOTE_HEIGHT + NOTE_SPACING);
  const minBeat = Math.min(...track.notes.map((n) => ticksToBeat(n.tick, ppqn)));
  const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
  const startBeat = minBeat < 1 ? minBeat : 1;
  const beatSpan = maxBeat - startBeat;
  const gridWidth = Math.max(beatSpan * PIXELS_PER_BEAT, 200);
  const contentY = TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT;

  const leftG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  leftG.setAttribute('transform', `translate(${x0}, ${y0})`);
  createLeftColText(leftG, 0, TRACK_HEADER_HEIGHT - 6, track.name, scaleY, {
    fill: '#94a3b8',
    fontSize: '12',
  });
  for (let p = pitchMin; p <= pitchMax; p++) {
    const row = pitchMax - p;
    const y = contentY + row * (NOTE_HEIGHT + NOTE_SPACING) + (NOTE_HEIGHT + NOTE_SPACING) / 2 + 4;
    createLeftColText(leftG, 0, y, midiToPitchName(p), scaleY, { fill: '#64748b', fontSize: '10' });
  }
  parents.leftCol.appendChild(leftG);

  const timelineG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  timelineG.setAttribute('transform', `translate(0, ${y0 + contentY})`);

  const gridStep = beatSpan > 16 ? 4 : beatSpan > 8 ? 2 : beatSpan > 4 ? 1 : 0.5;
  for (let b = startBeat; b <= maxBeat + 0.01; b += gridStep) {
    const x = beatToX(b, startBeat);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', String(-TIMELINE_HEIGHT));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(gridHeight));
    line.setAttribute('stroke', b % 1 === 0 ? '#64748b' : '#334155');
    line.setAttribute('stroke-width', b % 1 === 0 ? '1' : '0.5');
    timelineG.appendChild(line);
  }
  const labelStep = beatSpan > 16 ? 4 : beatSpan > 8 ? 2 : 1;
  for (let b = startBeat; b <= maxBeat + 0.01; b += labelStep) {
    const x = beatToX(b, startBeat) + 2;
    const y = -TIMELINE_HEIGHT / 2 + 4;
    createUnstretchedText(timelineG, x, y, formatBeatLabel(b), scaleX, scaleY, {
      fill: '#64748b',
      fontSize: '10',
    });
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
    timelineG.appendChild(rect);
  }

  for (const n of track.notes) {
    const beat = ticksToBeat(n.tick, ppqn);
    const durBeat = n.durationTicks / ppqn;
    const x = beatToX(beat, startBeat);
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
    timelineG.appendChild(rect);
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
    if (lineNum != null) div.setAttribute('data-line', String(lineNum));
    div.style.cssText = 'width:100%;height:100%;cursor:pointer;background:transparent;';
    fo.appendChild(div);
    timelineG.appendChild(fo);
  }

  parents.timeline.appendChild(timelineG);
  return TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT + gridHeight;
}

function renderDrumTrack(
  parents: TrackParents,
  track: Track,
  ppqn: number,
  drumMap: DrumMap,
  sourceMap: Map<string, number> | null,
  x0: number,
  y0: number,
  _containerWidth: number,
  scaleX: number,
  scaleY: number
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
  const minBeat = Math.min(...track.notes.map((n) => ticksToBeat(n.tick, ppqn)));
  const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
  const startBeat = minBeat < 1 ? minBeat : 1;
  const beatSpan = maxBeat - startBeat;
  const gridWidth = Math.max(beatSpan * PIXELS_PER_BEAT, 200);
  const noteToRow = new Map(orderedNotes.map((n, i) => [n, i]));
  const contentY = TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT;

  const leftG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  leftG.setAttribute('transform', `translate(${x0}, ${y0})`);
  createLeftColText(leftG, 0, TRACK_HEADER_HEIGHT - 6, track.name, scaleY, {
    fill: '#94a3b8',
    fontSize: '12',
  });
  for (let i = 0; i < rowCount; i++) {
    const y = contentY + i * rowHeight + rowHeight / 2 + 4;
    const noteNum = orderedNotes[i];
    const name = noteToName.get(noteNum) ?? `Note ${noteNum}`;
    createLeftColText(leftG, 0, y, name, scaleY, { fill: '#94a3b8', fontSize: '11' });
  }
  parents.leftCol.appendChild(leftG);

  const timelineG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  timelineG.setAttribute('transform', `translate(0, ${y0 + contentY})`);

  const gridStep = beatSpan > 16 ? 4 : beatSpan > 8 ? 2 : beatSpan > 4 ? 1 : 0.5;
  for (let b = startBeat; b <= maxBeat + 0.01; b += gridStep) {
    const x = beatToX(b, startBeat);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', String(-TIMELINE_HEIGHT));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(gridHeight));
    line.setAttribute('stroke', b % 1 === 0 ? '#64748b' : '#334155');
    line.setAttribute('stroke-width', b % 1 === 0 ? '1' : '0.5');
    timelineG.appendChild(line);
  }
  const labelStep = beatSpan > 16 ? 4 : beatSpan > 8 ? 2 : 1;
  for (let b = startBeat; b <= maxBeat + 0.01; b += labelStep) {
    const x = beatToX(b, startBeat) + 2;
    const y = -TIMELINE_HEIGHT / 2 + 4;
    createUnstretchedText(timelineG, x, y, formatBeatLabel(b), scaleX, scaleY, {
      fill: '#64748b',
      fontSize: '10',
    });
  }

  for (let i = 0; i < rowCount; i++) {
    const y = i * rowHeight;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(gridWidth));
    rect.setAttribute('height', String(rowHeight));
    rect.setAttribute('fill', i % 2 === 0 ? '#1e293b' : '#0f172a');
    timelineG.appendChild(rect);
  }

  for (const n of track.notes) {
    const row = noteToRow.get(n.noteNumber);
    if (row === undefined) continue;
    const beat = ticksToBeat(n.tick, ppqn);
    const durBeat = n.durationTicks / ppqn;
    const x = beatToX(beat, startBeat);
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
    timelineG.appendChild(rect);
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
    if (lineNum != null) div.setAttribute('data-line', String(lineNum));
    div.style.cssText = 'width:100%;height:100%;cursor:pointer;background:transparent;';
    fo.appendChild(div);
    timelineG.appendChild(fo);
  }

  parents.timeline.appendChild(timelineG);
  return TRACK_HEADER_HEIGHT + TIMELINE_HEIGHT + gridHeight;
}

type Props = {
  midi: Uint8Array | null;
  sourceMap: Map<string, number> | null;
  drumMap: DrumMap | null;
  parseMidi: ((buf: Uint8Array) => ParsedMidi | null) | null;
  onNoteHover?: (sourceLine: number | null) => void;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.1;

export function PianoRoll({ midi, sourceMap, drumMap, parseMidi, onNoteHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const isPanning = useRef(false);
  const zoomGroupRef = useRef<{
    leftCol: SVGGElement;
    timeline: SVGGElement;
    clipRect: SVGRectElement;
  } | null>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!viewportRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -1 : 1;
      const factor = delta > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      if (e.ctrlKey || e.metaKey) {
        const newScaleY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleY * factor));
        setScaleY(newScaleY);
        setPanY((p) => mouseY - (mouseY - p) * (newScaleY / scaleY));
      } else {
        const newScaleX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleX * factor));
        setScaleX(newScaleX);
        setPanX((p) => mouseX - (mouseX - p) * (newScaleX / scaleX));
      }
    },
    [scaleX, scaleY]
  );

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX, panY };

    const handlePanMove = (ev: MouseEvent) => {
      setPanX(panStart.current.panX + ev.clientX - panStart.current.x);
      setPanY(panStart.current.panY + ev.clientY - panStart.current.y);
    };
    const handlePanEnd = () => {
      isPanning.current = false;
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
    };
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
  }, [panX, panY]);

  const resetZoomPan = useCallback(() => {
    setScaleX(1);
    setScaleY(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const hasContent = Boolean(midi && midi.length > 0 && parseMidi);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hasContent) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [hasContent]);

  const contentSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;
    const oldSvg = container.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    zoomGroupRef.current = null;

    if (!midi || midi.length === 0 || !parseMidi) {
      return;
    }

    try {
      const parsed = parseMidi(midi) as ParsedMidi | null;
      if (!parsed?.tracks) {
        return;
      }
      const { tracks, ppqn } = parseMidiToTracks(parsed);
      if (tracks.length === 0) {
        return;
      }

      const effectiveDrumMap = drumMap ?? getDefaultDrumMap({ short: true });
      let contentWidth = ROW_LABEL_WIDTH + 200;
      for (const t of tracks) {
        const minB = Math.min(...t.notes.map((n) => ticksToBeat(n.tick, ppqn)));
        const maxB = Math.max(...t.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
        const startB = minB < 1 ? minB : 1;
        const span = maxB - startB;
        const w = ROW_LABEL_WIDTH + Math.max(span * PIXELS_PER_BEAT, 200);
        if (w > contentWidth) contentWidth = w;
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      const leftColGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      leftColGroup.setAttribute('class', 'piano-roll-left-col');
      leftColGroup.setAttribute(
        'transform',
        `translate(${PAN_BUFFER}, ${PAN_BUFFER + panY}) scale(1, ${scaleY})`
      );

      const clipId = 'piano-roll-timeline-clip';
      const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clipPath.setAttribute('id', clipId);
      const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const clipX = Math.max(0, -panX / scaleX);
      clipRect.setAttribute('x', String(clipX));
      clipRect.setAttribute('y', '-5000');
      clipRect.setAttribute('width', '100000');
      clipRect.setAttribute('height', '20000');
      clipPath.appendChild(clipRect);
      svg.appendChild(clipPath);

      const timelineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      timelineGroup.setAttribute('class', 'piano-roll-timeline');
      timelineGroup.setAttribute('clip-path', `url(#${clipId})`);
      timelineGroup.setAttribute(
        'transform',
        `translate(${PAN_BUFFER + ROW_LABEL_WIDTH + panX}, ${PAN_BUFFER + panY}) scale(${scaleX}, ${scaleY})`
      );
      zoomGroupRef.current = { leftCol: leftColGroup, timeline: timelineGroup, clipRect };

      let y = 0;
      const parents: TrackParents = { leftCol: leftColGroup, timeline: timelineGroup };

      for (let i = 0; i < tracks.length; i++) {
        if (i > 0) {
          const sep = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          sep.setAttribute('x', '0');
          sep.setAttribute('y', String(y));
          sep.setAttribute('width', String(contentWidth));
          sep.setAttribute('height', String(SEPARATOR_HEIGHT));
          sep.setAttribute('fill', '#475569');
          leftColGroup.appendChild(sep);
          y += SEPARATOR_HEIGHT;
        }

        const track = tracks[i];
        const isDrum = track.channel === 10;
        const h = isDrum && effectiveDrumMap
          ? renderDrumTrack(parents, track, ppqn, effectiveDrumMap, sourceMap, 0, y, contentWidth, scaleX, scaleY)
          : renderPianoTrack(parents, track, ppqn, sourceMap, 0, y, contentWidth, scaleX, scaleY);
        y += h;
      }

      contentSizeRef.current = { width: contentWidth, height: y };

      const borderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      borderLine.setAttribute('x1', String(ROW_LABEL_WIDTH));
      borderLine.setAttribute('y1', '0');
      borderLine.setAttribute('x2', String(ROW_LABEL_WIDTH));
      borderLine.setAttribute('y2', String(y));
      borderLine.setAttribute('stroke', '#475569');
      borderLine.setAttribute('stroke-width', '1');
      leftColGroup.insertBefore(borderLine, leftColGroup.firstChild);

      svg.appendChild(leftColGroup);
      svg.appendChild(timelineGroup);

      const timelineWidth = contentWidth - ROW_LABEL_WIDTH;
      const svgWidth = 2 * PAN_BUFFER + ROW_LABEL_WIDTH + timelineWidth * scaleX;
      const svgHeight = 2 * PAN_BUFFER + y * scaleY;
      svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      container.appendChild(svg);

      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = PAN_BUFFER;
        viewport.scrollTop = PAN_BUFFER;
      }

      const instances: Instance[] = [];
      const hoverHandlers: Array<{ el: Element; onEnter: () => void; onLeave: () => void }> = [];
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
        if (onNoteHover) {
          const lineStr = (el as HTMLElement).dataset.line;
          const onEnter = () => {
            if (lineStr) onNoteHover(parseInt(lineStr, 10));
          };
          const onLeave = () => onNoteHover(null);
          el.addEventListener('mouseenter', onEnter);
          el.addEventListener('mouseleave', onLeave);
          hoverHandlers.push({ el, onEnter, onLeave });
        }
      });

      return () => {
        instances.forEach((i) => i.destroy());
        hoverHandlers.forEach(({ el, onEnter, onLeave }) => {
          el.removeEventListener('mouseenter', onEnter);
          el.removeEventListener('mouseleave', onLeave);
        });
      };
    } catch (err) {
      console.error('Piano roll error:', err);
    }
  }, [midi, sourceMap, drumMap, parseMidi, onNoteHover]);

  useEffect(() => {
    const groups = zoomGroupRef.current;
    const container = svgContainerRef.current;
    if (!groups || !container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    groups.leftCol.setAttribute(
      'transform',
      `translate(${PAN_BUFFER}, ${PAN_BUFFER + panY}) scale(1, ${scaleY})`
    );
    groups.timeline.setAttribute(
      'transform',
      `translate(${PAN_BUFFER + ROW_LABEL_WIDTH + panX}, ${PAN_BUFFER + panY}) scale(${scaleX}, ${scaleY})`
    );

    const clipX = Math.max(0, -panX / scaleX);
    groups.clipRect.setAttribute('x', String(clipX));

    const { width, height } = contentSizeRef.current;
    const timelineWidth = width - ROW_LABEL_WIDTH;
    if (width > 0 && height > 0) {
      const svgWidth = 2 * PAN_BUFFER + ROW_LABEL_WIDTH + timelineWidth * scaleX;
      const svgHeight = 2 * PAN_BUFFER + height * scaleY;
      svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    }

    const scaleText = Math.min(scaleX, scaleY);
    container.querySelectorAll('.text-unstretch').forEach((g) => {
      const x = parseFloat(g.getAttribute('data-x') ?? '0');
      const y = parseFloat(g.getAttribute('data-y') ?? '0');
      g.setAttribute('transform', `translate(${x},${y}) scale(${scaleText / scaleX},${scaleText / scaleY})`);
    });
    container.querySelectorAll('.text-unstretch-left').forEach((g) => {
      const x = parseFloat(g.getAttribute('data-x') ?? '0');
      const y = parseFloat(g.getAttribute('data-y') ?? '0');
      g.setAttribute('transform', `translate(${x},${y}) scale(1,${1 / scaleY})`);
    });
  }, [scaleX, scaleY, panX, panY]);

  return (
    <div ref={containerRef} className="pt-4 pr-4 pb-4 pl-0 min-h-full min-w-0 flex flex-col relative">
      <div className={`placeholder flex items-center justify-center h-48 text-slate-500 text-sm ${hasContent ? 'hidden' : ''}`}>
        Compile LMP to see piano roll
      </div>
      {hasContent && (
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-xs text-slate-500">Zoom H:</span>
            <button
              type="button"
              onClick={() => setScaleX((s) => Math.min(MAX_SCALE, s * ZOOM_FACTOR))}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setScaleX((s) => Math.max(MIN_SCALE, s / ZOOM_FACTOR))}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              −
            </button>
            <span className="text-xs text-slate-500">V:</span>
            <button
              type="button"
              onClick={() => setScaleY((s) => Math.min(MAX_SCALE, s * ZOOM_FACTOR))}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setScaleY((s) => Math.max(MIN_SCALE, s / ZOOM_FACTOR))}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetZoomPan}
              className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              Reset
            </button>
            <span className="text-xs text-slate-500 ml-2">
              Wheel: H · Ctrl+Wheel: V · Drag: pan
            </span>
          </div>
          <div
            ref={viewportRef}
            className="flex-1 min-h-0 overflow-auto border border-slate-700 select-none"
            onWheel={handleWheel}
            onMouseDown={handlePanStart}
            style={{ cursor: 'grab' }}
          >
            <div ref={svgContainerRef} className="min-w-0 h-full min-h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
