import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PianoRollData, Track as TrackData, Note } from '../utils/pianoRollData';
import { getDrumName } from '../constants/gmDrumMap';
import {
  zoomHorizontal,
  zoomVertical,
  resetViewport,
  type PianoRollViewport,
} from '../utils/pianoRollViewport';

const LABEL_COLUMN_DEFAULT = 80;
const LABEL_COLUMN_MIN = 60;
const LABEL_COLUMN_MAX = 280;
const RULER_HEIGHT = 24;
const EXTRA_ROWS_ABOVE_BELOW = 2;
const BREAK_ROW_HEIGHT = 20;
const OCTAVE_SEMITONES = 12;
const TRACK_SEPARATOR_COLOR = 'rgba(251, 146, 60, 0.6)';
const TRACK_SEPARATOR_WIDTH = 2;
const DEFAULT_MIDI_MIN = 60;
const DEFAULT_MIDI_MAX = 72;
const MIDI_CLAMP_MIN = 0;
const MIDI_CLAMP_MAX = 127;
const DRUM_CHANNEL = 9;
const GRID_COLOR = 'rgba(148, 163, 184, 0.25)';
const RULER_BG = 'rgb(15, 23, 42)';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToPitchName(midi: number): string {
  return PITCH_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

type PianoRollProps = {
  data: PianoRollData;
  sourceMap: Map<string, number> | null;
  onHighlightLine: (line: number | null) => void;
};

type PitchOrderItem = number | 'break';

/** Drum (ch 9): only used rows + 1 empty above, 1 empty below. Melodic: segments with break when gap >= 1 octave. Returns order and set of midi that are empty rows (drum only). */
function getTrackPitchOrder(track: TrackData): { order: PitchOrderItem[]; emptyRows: Set<number> } {
  const emptyRows = new Set<number>();
  let minMidi = DEFAULT_MIDI_MAX;
  let maxMidi = DEFAULT_MIDI_MIN;
  for (const n of track.notes) {
    if (n.midi < minMidi) minMidi = n.midi;
    if (n.midi > maxMidi) maxMidi = n.midi;
  }
  const top = Math.min(MIDI_CLAMP_MAX, maxMidi + EXTRA_ROWS_ABOVE_BELOW);
  const bottom = Math.max(MIDI_CLAMP_MIN, minMidi - EXTRA_ROWS_ABOVE_BELOW);

  if (track.channel === DRUM_CHANNEL) {
    const used = new Set<number>();
    for (const n of track.notes) used.add(n.midi);
    if (used.size === 0) {
      const order: PitchOrderItem[] = [];
      for (let m = top; m >= bottom; m--) order.push(m);
      return { order, emptyRows };
    }
    const sorted = [...used].sort((a, b) => b - a);
    const order: PitchOrderItem[] = [];
    const mTop = sorted[0] + 1;
    if (mTop <= MIDI_CLAMP_MAX) {
      order.push(mTop);
      emptyRows.add(mTop);
    }
    order.push(...sorted);
    const minUsed = sorted[sorted.length - 1];
    const mBottom = minUsed - 1;
    if (mBottom >= MIDI_CLAMP_MIN) {
      order.push(mBottom);
      emptyRows.add(mBottom);
    }
    return { order, emptyRows };
  }

  const used = new Set<number>();
  for (const n of track.notes) used.add(n.midi);
  if (used.size === 0) {
    const order: PitchOrderItem[] = [];
    for (let m = top; m >= bottom; m--) order.push(m);
    return { order, emptyRows };
  }
  const sorted = [...used].sort((a, b) => b - a);
  const segments: number[][] = [];
  let seg: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (seg[seg.length - 1] - sorted[i] >= OCTAVE_SEMITONES) {
      segments.push(seg);
      seg = [sorted[i]];
    } else {
      seg.push(sorted[i]);
    }
  }
  segments.push(seg);

  const order: PitchOrderItem[] = [];
  for (let s = 0; s < segments.length; s++) {
    if (s > 0) order.push('break');
    const segMin = Math.min(...segments[s]);
    const segMax = Math.max(...segments[s]);
    const segTop = Math.min(MIDI_CLAMP_MAX, segMax + EXTRA_ROWS_ABOVE_BELOW);
    const segBottom = Math.max(MIDI_CLAMP_MIN, segMin - EXTRA_ROWS_ABOVE_BELOW);
    for (let m = segTop; m >= segBottom; m--) order.push(m);
  }
  return { order, emptyRows };
}

function sourceMapKey(beat: number, trackIndex: number, midi: number): string {
  const b = Math.round(beat * 1000) / 1000;
  return `${b}_${trackIndex}_${midi}`;
}

export function PianoRoll({ data, sourceMap, onHighlightLine }: PianoRollProps) {
  const [viewport, setViewport] = useState<PianoRollViewport>(() =>
    resetViewport(data.startBeat)
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollBeat: 0, scrollTrackY: 0 });
  const labelResizeRef = useRef({ active: false, startX: 0, startWidth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [labelColumnWidth, setLabelColumnWidth] = useState(LABEL_COLUMN_DEFAULT);
  const [hoveredNote, setHoveredNote] = useState<{
    trackIndex: number;
    note: Note;
    x: number;
    y: number;
  } | null>(null);

  const { tracks, startBeat } = data;
  const endBeat = useMemo(() => {
    let max = startBeat;
    for (const t of tracks) {
      for (const n of t.notes) {
        const end = n.startBeat + n.durationBeat;
        if (end > max) max = end;
      }
    }
    return max + 4;
  }, [tracks, startBeat]);

  const trackPitchOrders = useMemo(
    () => tracks.map((t) => getTrackPitchOrder(t)),
    [tracks]
  );

  const trackRowHeights = useMemo(
    () =>
      tracks.map((_, ti) =>
        trackPitchOrders[ti].order.map((o) =>
          o === 'break' ? BREAK_ROW_HEIGHT : viewport.pitchRowHeight
        )
      ),
    [tracks, trackPitchOrders, viewport.pitchRowHeight]
  );

  const trackHeights = useMemo(
    () => trackRowHeights.map((rowHeights) => rowHeights.reduce((a, b) => a + b, 0)),
    [trackRowHeights]
  );

  const trackRowYOffsets = useMemo(
    () =>
      trackRowHeights.map((rowHeights) => {
        const out: number[] = [0];
        for (let i = 0; i < rowHeights.length; i++) out.push(out[i] + rowHeights[i]);
        return out;
      }),
    [trackRowHeights]
  );

  const trackYOffsets = useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const h of trackHeights) {
      out.push(y);
      y += h;
    }
    return out;
  }, [trackHeights]);

  const contentHeight = useMemo(
    () => trackHeights.reduce((a, b) => a + b, 0),
    [trackHeights]
  );

  useEffect(() => {
    setViewport(resetViewport(data.startBeat));
  }, [data.startBeat]);

  const contentWidth = (endBeat - startBeat) * viewport.pixelsPerBeat;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) return;
      const el = scrollRef.current;
      if (!el) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const rect = el.getBoundingClientRect();
      const centerX = e.clientX - rect.left + el.scrollLeft;
      const centerBeat = startBeat + (centerX - labelColumnWidth) / viewport.pixelsPerBeat;
      setViewport((v) => zoomHorizontal(v, -delta, centerBeat));
    },
    [startBeat, viewport.pixelsPerBeat, labelColumnWidth]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      isPanning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollBeat: viewport.scrollBeat,
        scrollTrackY: viewport.scrollTrackY,
      };
    },
    [viewport.scrollBeat, viewport.scrollTrackY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (labelResizeRef.current.active) return;
      if (isPanning.current) {
        const totalDx = e.clientX - panStart.current.x;
        const totalDy = e.clientY - panStart.current.y;
        setViewport((v) => ({
          ...v,
          scrollBeat: Math.max(0, panStart.current.scrollBeat - totalDx / v.pixelsPerBeat),
          scrollTrackY: Math.max(0, panStart.current.scrollTrackY - totalDy),
        }));
      } else {
        const el = scrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const contentX = e.clientX - rect.left + el.scrollLeft;
        const contentY = e.clientY - rect.top + el.scrollTop;
        const timelineX = contentX - labelColumnWidth;
        const canvasY = contentY - RULER_HEIGHT;
        if (timelineX < 0 || canvasY < 0) {
          setHoveredNote(null);
          onHighlightLine(null);
          return;
        }
        const beat = startBeat + timelineX / viewport.pixelsPerBeat;
        let trackIndex = -1;
        for (let i = 0; i < trackYOffsets.length; i++) {
          if (canvasY >= trackYOffsets[i] && canvasY < trackYOffsets[i] + trackHeights[i]) {
            trackIndex = i;
            break;
          }
        }
        if (trackIndex < 0 || trackIndex >= tracks.length) {
          setHoveredNote(null);
          onHighlightLine(null);
          return;
        }
        const track = tracks[trackIndex];
        const order = trackPitchOrders[trackIndex].order;
        const rowYOffsets = trackRowYOffsets[trackIndex];
        const trackLocalY = canvasY - trackYOffsets[trackIndex];
        if (order.length === 0) {
          setHoveredNote(null);
          onHighlightLine(null);
          return;
        }
        let row = -1;
        for (let r = 0; r < rowYOffsets.length - 1; r++) {
          if (trackLocalY >= rowYOffsets[r] && trackLocalY < rowYOffsets[r + 1]) {
            row = r;
            break;
          }
        }
        if (row < 0 || row >= order.length) {
          setHoveredNote(null);
          onHighlightLine(null);
          return;
        }
        const midi = order[row];
        if (midi === 'break') {
          setHoveredNote(null);
          onHighlightLine(null);
          return;
        }
        const note = track.notes.find(
          (n) =>
            n.midi === midi &&
            n.startBeat <= beat &&
            n.startBeat + n.durationBeat >= beat
        );
        if (note) {
          setHoveredNote({ trackIndex, note, x: e.clientX, y: e.clientY });
          const key = sourceMapKey(note.startBeat, trackIndex, note.midi);
          const line = sourceMap?.get(key);
          onHighlightLine(line ?? null);
        } else {
          setHoveredNote(null);
          onHighlightLine(null);
        }
      }
    },
    [
      startBeat,
      viewport.pixelsPerBeat,
      tracks,
      trackPitchOrders,
      trackYOffsets,
      trackRowYOffsets,
      trackHeights,
      sourceMap,
      onHighlightLine,
      labelColumnWidth,
    ]
  );

  const handleLabelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    labelResizeRef.current = { active: true, startX: e.clientX, startWidth: labelColumnWidth };
    const onMove = (moveEvent: MouseEvent) => {
      const { startX, startWidth } = labelResizeRef.current;
      const dx = moveEvent.clientX - startX;
      setLabelColumnWidth(Math.max(LABEL_COLUMN_MIN, Math.min(LABEL_COLUMN_MAX, startWidth + dx)));
    };
    const onUp = () => {
      labelResizeRef.current.active = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [labelColumnWidth]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNote(null);
    onHighlightLine(null);
  }, [onHighlightLine]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = viewport.scrollBeat * viewport.pixelsPerBeat;
      scrollRef.current.scrollTop = viewport.scrollTrackY;
    }
  }, [viewport.scrollBeat, viewport.pixelsPerBeat, viewport.scrollTrackY]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport((v) => ({
      ...v,
      scrollBeat: el.scrollLeft / v.pixelsPerBeat,
      scrollTrackY: el.scrollTop,
    }));
  }, []);

  const handleZoomH = useCallback((delta: number) => {
    const centerBeat = startBeat + (endBeat - startBeat) / 2;
    setViewport((v) => zoomHorizontal(v, delta, centerBeat));
  }, [startBeat, endBeat]);

  const handleZoomV = useCallback((delta: number) => {
    setViewport((v) => zoomVertical(v, delta));
  }, []);

  const handleReset = useCallback(() => {
    setViewport(resetViewport(data.startBeat));
  }, [data.startBeat]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) return;
      if (e.shiftKey) {
        el.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY;
      } else {
        el.scrollTop += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = contentWidth;
    const h = contentHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgb(15, 23, 42)';
    ctx.fillRect(0, 0, w, h);

    for (let beat = Math.floor(startBeat); beat <= Math.ceil(endBeat); beat++) {
      const x = (beat - startBeat) * viewport.pixelsPerBeat;
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, contentHeight);
      ctx.stroke();
    }

    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      const order = trackPitchOrders[ti].order;
      const trackY = trackYOffsets[ti];
      const rowYOffsets = trackRowYOffsets[ti];
      const rowHeights = trackRowHeights[ti];
      const totalRows = order.length;

      if (ti > 0) {
        ctx.strokeStyle = TRACK_SEPARATOR_COLOR;
        ctx.lineWidth = TRACK_SEPARATOR_WIDTH;
        ctx.beginPath();
        ctx.moveTo(0, trackY);
        ctx.lineTo(w, trackY);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      for (let i = 0; i < totalRows; i++) {
        if (order[i] === 'break') {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.05)';
          ctx.fillRect(0, trackY + rowYOffsets[i], w, rowHeights[i]);
        }
      }

      for (let i = 0; i <= totalRows; i++) {
        const y = trackY + rowYOffsets[i];
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (const n of track.notes) {
        const noteRow = order.indexOf(n.midi);
        if (noteRow < 0) continue;
        const x = (n.startBeat - startBeat) * viewport.pixelsPerBeat;
        const nw = Math.max(2, n.durationBeat * viewport.pixelsPerBeat);
        const ny = trackY + rowYOffsets[noteRow];
        const nh = Math.max(2, rowHeights[noteRow] - 1);
        const v = Math.max(0, Math.min(1, n.velocity));
        const r = Math.round(180 + (251 - 180) * v);
        const g = Math.round(90 + (146 - 90) * v);
        const b = Math.round(40 + (60 - 40) * v);
        const radius = Math.min(3, (nh - 1) / 2, (nw - 1) / 2);
        const overlaps = track.notes.some(
          (other) =>
            other !== n &&
            other.midi === n.midi &&
            n.startBeat < other.startBeat + other.durationBeat &&
            other.startBeat < n.startBeat + n.durationBeat
        );
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.roundRect(x, ny + 1, nw, nh, radius);
        ctx.fill();
        if (overlaps) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }, [
    contentWidth,
    contentHeight,
    tracks,
    trackPitchOrders,
    trackYOffsets,
    trackRowYOffsets,
    trackRowHeights,
    viewport.pixelsPerBeat,
    startBeat,
    endBeat,
  ]);

  const tooltipLine = useMemo(() => {
    if (!hoveredNote || !sourceMap) return null;
    const key = sourceMapKey(hoveredNote.note.startBeat, hoveredNote.trackIndex, hoveredNote.note.midi);
    return sourceMap.get(key) ?? null;
  }, [hoveredNote, sourceMap]);

  const zoomBar = (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-800 shrink-0 flex-wrap">
      <span className="text-xs text-slate-500">Zoom:</span>
      <span className="text-xs text-slate-500">H</span>
      <button
        type="button"
        onClick={() => handleZoomH(-1)}
        className="px-1.5 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
        aria-label="Horizontal zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => handleZoomH(1)}
        className="px-1.5 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
        aria-label="Horizontal zoom in"
      >
        +
      </button>
      <span className="text-xs text-slate-500 ml-1">V</span>
      <button
        type="button"
        onClick={() => handleZoomV(-1)}
        className="px-1.5 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
        aria-label="Vertical zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => handleZoomV(1)}
        className="px-1.5 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
        aria-label="Vertical zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={handleReset}
        className="ml-1 px-2 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
      >
        Reset
      </button>
      <span className="text-[10px] text-slate-600 ml-2 hidden sm:inline">
        Wheel: scroll V · Shift+wheel: scroll H · Ctrl+wheel: zoom · Drag: pan
      </span>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 flex min-h-0 overflow-auto outline-none"
        onWheel={handleWheel}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="flex shrink-0"
          style={{
            width: labelColumnWidth + 4 + contentWidth,
            minHeight: RULER_HEIGHT + contentHeight,
          }}
        >
        <div
          style={{
            width: labelColumnWidth,
            minWidth: labelColumnWidth,
            position: 'sticky',
            left: 0,
            zIndex: 1,
            background: 'rgb(15, 23, 42)',
          }}
          className="shrink-0 flex flex-col border-r border-slate-700"
        >
          <div style={{ height: RULER_HEIGHT, minHeight: RULER_HEIGHT }} className="border-b border-slate-700 flex items-center px-1 text-xs text-slate-500" />
          {tracks.map((track, ti) => {
            const { order, emptyRows } = trackPitchOrders[ti];
            const rowHeights = trackRowHeights[ti];
            const firstPitchRowIdx = order.findIndex((o) => o !== 'break');
            return (
              <div
                key={ti}
                style={{ height: trackHeights[ti], minHeight: trackHeights[ti] }}
                className="border-b border-slate-600 flex flex-col shrink-0"
              >
                {order.map((item, rowIdx) => {
                  const rowH = rowHeights[rowIdx];
                  const isBreak = item === 'break';
                  const isFirstPitchRow = rowIdx === firstPitchRowIdx;
                  return (
                    <div
                      key={isBreak ? `break-${ti}-${rowIdx}` : `${ti}-${item}`}
                      style={{
                        height: rowH,
                        minHeight: rowH,
                        flexShrink: 0,
                        ...(isBreak && { background: 'rgba(148, 163, 184, 0.12)' }),
                      }}
                      className="relative px-1.5 flex flex-col justify-center items-end text-right min-w-0"
                    >
                      {isBreak ? (
                        <span className="text-[10px] text-slate-400 select-none" aria-hidden>
                          — —
                        </span>
                      ) : isFirstPitchRow ? (
                        <div
                          className="sticky top-0 z-10 flex items-center justify-start text-left text-[10px] font-medium text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap"
                          style={{
                            left: 0,
                            right: 0,
                            width: '100%',
                            height: rowH,
                            minHeight: rowH,
                            minWidth: 0,
                            background: 'rgb(15, 23, 42)',
                            marginLeft: -6,
                            marginRight: -6,
                            paddingLeft: 6,
                            paddingRight: 6,
                            boxSizing: 'border-box',
                          }}
                          title={track.name}
                        >
                          {track.name}
                        </div>
                      ) : (
                        <span
                          className="text-[11px] text-slate-500 font-mono tabular-nums select-none leading-tight truncate min-w-0 block w-full text-right"
                          title={
                            emptyRows.has(item)
                              ? undefined
                              : track.channel === 9
                                ? String(item)
                                : midiToPitchName(item)
                          }
                        >
                          {emptyRows.has(item) ? (
                            ' '
                          ) : track.channel === 9 ? (
                            track.notes.find((n) => n.midi === item)?.label ?? getDrumName(item)
                          ) : (
                            midiToPitchName(item)
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div
          role="separator"
          aria-label="Resize label column"
          onMouseDown={handleLabelResizeStart}
          className="shrink-0 w-1 bg-slate-700 hover:bg-slate-500 cursor-col-resize active:bg-slate-400 transition-colors self-stretch"
        />
        <div className="flex-1 min-w-0 flex flex-col" style={{ minWidth: 0 }}>
          <div
            style={{
              position: 'relative',
              width: contentWidth,
              minWidth: contentWidth,
              height: RULER_HEIGHT,
              background: RULER_BG,
              borderBottom: '1px solid rgb(51, 65, 85)',
            }}
            className="shrink-0"
          >
            {Array.from({ length: Math.ceil(endBeat - startBeat) + 1 }, (_, i) => Math.floor(startBeat) + i).map(
              (beat) => (
                <div
                  key={`line-${beat}`}
                  style={{
                    position: 'absolute',
                    left: (beat - startBeat) * viewport.pixelsPerBeat,
                    width: 1,
                    height: RULER_HEIGHT,
                    background: GRID_COLOR,
                  }}
                />
              )
            )}
            {Array.from({ length: Math.ceil(endBeat - startBeat) + 1 }, (_, i) => Math.floor(startBeat) + i).map(
              (beat) => (
                <span
                  key={`label-${beat}`}
                  className="text-[10px] text-slate-500 absolute bottom-0"
                  style={{ left: (beat - startBeat) * viewport.pixelsPerBeat + 2 }}
                >
                  {beat}
                </span>
              )
            )}
          </div>
          <div
            style={{
              width: contentWidth,
              height: contentHeight,
              clipPath: 'inset(0 0 0 0)',
            }}
            className="shrink-0"
          >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>
        </div>
        </div>
      </div>
      {zoomBar}
      {hoveredNote && (
        <div
          className="fixed z-50 px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-xs text-slate-200 shadow-lg pointer-events-none"
          style={{
            left: hoveredNote.x + 12,
            top: hoveredNote.y + 12,
          }}
        >
          <div>{hoveredNote.note.label ?? midiToPitchName(hoveredNote.note.midi)}</div>
          <div>Beat {hoveredNote.note.startBeat.toFixed(2)}</div>
          <div>Duration {hoveredNote.note.durationBeat.toFixed(2)}</div>
          <div>Velocity {Math.round(hoveredNote.note.velocity * 127)}</div>
          {tooltipLine != null && <div>LMP line {tooltipLine}</div>}
        </div>
      )}
    </div>
  );
}
