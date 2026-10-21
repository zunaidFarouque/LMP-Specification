import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { StudioNote, StudioTrack, ToolMode, SnapResolution } from '../../core/types';
import { midiToSpn } from '../../core/sourceMapBridge';
import { studioAudioEngine } from '../../core/audioEngine';
import { FLUID_INDIAN_PERCUSSION_MAP } from '../../core/soundfontEngine';
import { VelocityLane } from './VelocityLane';

interface Props {
  tracks: StudioTrack[];
  activeTrackId: number;
  totalBeats: number;
  currentBeat: number;
  activeTool: ToolMode;
  snap: SnapResolution;
  selectedNoteId: string | null;
  hoveredLine?: number | null;
  hoveredNoteId?: string | null;
  soundPreviewEnabled?: boolean;
  onSelectNote: (note: StudioNote | null) => void;
  onHoverNote?: (note: StudioNote | null) => void;
  onNoteChange: (note: StudioNote, updates: { pitch?: string; beat?: number; duration?: number; velocity?: number }) => StudioNote | null | void;
  onNoteCreate: (trackId: number, pitch: string, beat: number, duration: number) => void;
  onNoteDelete: (note: StudioNote) => void;
  ghostNotes?: StudioNote[]; // For AI suggestion overlay
}

const MIN_MIDI = 24; // C1
const MAX_MIDI = 96; // C7
const ROW_HEIGHT = 18;
const PIXELS_PER_BEAT = 48;

function getSnapFraction(snap: SnapResolution): number {
  switch (snap) {
    case '1/4': return 1.0;
    case '1/8': return 0.5;
    case '1/16': return 0.25;
    case '1/32': return 0.125;
    case '1/12': return 1 / 3;
    case 'free': return 0.02;
    default: return 0.25;
  }
}

export function PianoRoll({
  tracks,
  activeTrackId,
  totalBeats,
  currentBeat,
  activeTool,
  snap,
  selectedNoteId,
  hoveredLine = null,
  hoveredNoteId = null,
  soundPreviewEnabled = true,
  onSelectNote,
  onHoverNote,
  onNoteChange,
  onNoteCreate,
  onNoteDelete,
  ghostNotes = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [scrollLeft, setScrollLeft] = useState(0);
  const [showVelocity, setShowVelocity] = useState(true);

  // Dragging states
  const [dragState, setDragState] = useState<{
    note: StudioNote;
    startX: number;
    startY: number;
    initialBeat: number;
    initialMidi: number;
    initialDuration: number;
    mode: 'move' | 'resize';
  } | null>(null);

  // Live pencil click-and-drag note creation state
  const [drawingNote, setDrawingNote] = useState<{
    startBeat: number;
    duration: number;
    midiNumber: number;
    pitch: string;
  } | null>(null);

  const lastAuditionedMidiRef = useRef<number | null>(null);

  const totalRows = MAX_MIDI - MIN_MIDI + 1;
  const canvasHeight = totalRows * ROW_HEIGHT;
  const canvasWidth = totalBeats * PIXELS_PER_BEAT;

  const snapStep = getSnapFraction(snap);

  // Auto-scroll vertically into middle octave (around C4 / midi 60) on initial load
  useEffect(() => {
    if (scrollRef.current) {
      const c4Y = (MAX_MIDI - 60) * ROW_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, c4Y - 200);
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollLeft(scrollRef.current.scrollLeft);
    }
  };

  const midiToY = useCallback((midi: number): number => {
    return (MAX_MIDI - midi) * ROW_HEIGHT;
  }, []);

  const yToMidi = useCallback((y: number): number => {
    const raw = MAX_MIDI - Math.floor(y / ROW_HEIGHT);
    return Math.max(MIN_MIDI, Math.min(MAX_MIDI, raw));
  }, []);

  const beatToX = useCallback((beat: number): number => {
    return (beat - 1.0) * PIXELS_PER_BEAT;
  }, []);

  const xToBeat = useCallback((x: number, applySnap: boolean = true): number => {
    const rawBeat = 1.0 + x / PIXELS_PER_BEAT;
    if (!applySnap || snap === 'free') return Math.max(1.0, rawBeat);
    const snapped = Math.round((rawBeat - 1.0) / snapStep) * snapStep + 1.0;
    return Math.max(1.0, snapped);
  }, [snap, snapStep]);

  const activeTrack = tracks.find((t) => t.id === activeTrackId);
  const activeTrackNotes = activeTrack ? activeTrack.notes : [];

  const currentNoteRef = useRef<StudioNote | null>(null);

  // Note Interaction Handlers
  const handleNoteMouseDown = (note: StudioNote, e: React.MouseEvent, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (activeTool === 'eraser') {
      onNoteDelete(note);
      return;
    }

    onSelectNote(note);
    onHoverNote?.(note);
    if (soundPreviewEnabled) {
      studioAudioEngine.playSingleNote(note.midiNumber, note.velocity, activeTrack?.channel, activeTrack?.program);
      lastAuditionedMidiRef.current = note.midiNumber;
    }

    currentNoteRef.current = note;
    setDragState({
      note,
      startX: e.clientX,
      startY: e.clientY,
      initialBeat: note.beat,
      initialMidi: note.midiNumber,
      initialDuration: note.duration,
      mode,
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const y = e.clientY - rect.top + scrollRef.current.scrollTop;

    const clickedBeat = xToBeat(x, true);
    const clickedMidi = yToMidi(y);
    const pitchStr = midiToSpn(clickedMidi);

    if (activeTool === 'pencil') {
      if (soundPreviewEnabled) {
        studioAudioEngine.playSingleNote(clickedMidi, 90, activeTrack?.channel, activeTrack?.program);
      }
      setDrawingNote({
        startBeat: clickedBeat,
        duration: snapStep,
        midiNumber: clickedMidi,
        pitch: pitchStr,
      });
    } else {
      onSelectNote(null);
    }
  };

  // Global mouse move and up for drag/resize and pencil drawing
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // 1. Handling active note drag / resize
      if (dragState) {
        const deltaX = e.clientX - dragState.startX;
        const deltaBeats = deltaX / PIXELS_PER_BEAT;

        if (dragState.mode === 'move') {
          const deltaY = e.clientY - dragState.startY;
          const deltaMidi = -Math.round(deltaY / ROW_HEIGHT);

          let newMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, dragState.initialMidi + deltaMidi));
          let newBeat = Math.max(1.0, dragState.initialBeat + deltaBeats);

          if (snap !== 'free') {
            newBeat = Math.round((newBeat - 1.0) / snapStep) * snapStep + 1.0;
          }

          // Sound preview auditioning on pitch change while dragging
          if (soundPreviewEnabled && newMidi !== lastAuditionedMidiRef.current) {
            lastAuditionedMidiRef.current = newMidi;
            studioAudioEngine.playSingleNote(
              newMidi,
              currentNoteRef.current?.velocity || 90,
              activeTrack?.channel,
              activeTrack?.program
            );
          }

          const newPitch = midiToSpn(newMidi);
          const targetNote = currentNoteRef.current || dragState.note;

          const savedNote = onNoteChange(targetNote, {
            pitch: newPitch,
            beat: Math.max(1.0, Number(newBeat.toFixed(3))),
          }) as StudioNote | null | undefined;

          if (savedNote) {
            currentNoteRef.current = savedNote;
            onSelectNote(savedNote);
            onHoverNote?.(savedNote);
          } else {
            const updatedNote: StudioNote = {
              ...targetNote,
              pitch: newPitch,
              midiNumber: newMidi,
              beat: Math.max(1.0, Number(newBeat.toFixed(3))),
            };
            currentNoteRef.current = updatedNote;
            onSelectNote(updatedNote);
            onHoverNote?.(updatedNote);
          }
        } else if (dragState.mode === 'resize') {
          let newDur = Math.max(snapStep, dragState.initialDuration + deltaBeats);
          if (snap !== 'free') {
            newDur = Math.max(snapStep, Math.round(newDur / snapStep) * snapStep);
          }
          const targetNote = currentNoteRef.current || dragState.note;
          const savedNote = onNoteChange(targetNote, {
            duration: Number(newDur.toFixed(3)),
          }) as StudioNote | null | undefined;

          if (savedNote) {
            currentNoteRef.current = savedNote;
            onSelectNote(savedNote);
            onHoverNote?.(savedNote);
          } else {
            const updatedNote: StudioNote = {
              ...targetNote,
              duration: Number(newDur.toFixed(3)),
            };
            currentNoteRef.current = updatedNote;
            onSelectNote(updatedNote);
            onHoverNote?.(updatedNote);
          }
        }
      }

      // 2. Handling pencil click-and-drag note creation
      if (drawingNote && scrollRef.current) {
        const rect = scrollRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const currentHoverBeat = xToBeat(currentX, true);
        let rawDuration = currentHoverBeat - drawingNote.startBeat + snapStep;
        if (snap !== 'free') {
          rawDuration = Math.round(rawDuration / snapStep) * snapStep;
        }
        const duration = Math.max(snapStep, Number(rawDuration.toFixed(3)));
        setDrawingNote((prev) => (prev ? { ...prev, duration } : null));
      }
    };

    const onMouseUp = () => {
      if (dragState) {
        const finalNote = currentNoteRef.current || dragState.note;
        setDragState(null);
        currentNoteRef.current = null;
        lastAuditionedMidiRef.current = null;
        if (finalNote) {
          onSelectNote(finalNote);
          onHoverNote?.(finalNote);
        }
      }

      if (drawingNote) {
        onNoteCreate(activeTrackId, drawingNote.pitch, drawingNote.startBeat, drawingNote.duration);
        setDrawingNote(null);
      }
    };

    if (dragState || drawingNote) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [
    dragState,
    drawingNote,
    snap,
    snapStep,
    onNoteChange,
    onNoteCreate,
    onSelectNote,
    onHoverNote,
    soundPreviewEnabled,
    activeTrack,
    activeTrackId,
    xToBeat,
  ]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full bg-[#0a0d12] relative overflow-hidden select-none">
      {/* Beat Ruler Header */}
      <div className="h-6 bg-[#0f1420] border-b border-[#1e2738] flex items-center relative overflow-hidden pl-16">
        <div
          className="absolute inset-y-0 flex items-center font-mono text-[10px] text-slate-400"
          style={{ transform: `translateX(-${scrollLeft}px)` }}
        >
          {Array.from({ length: Math.ceil(totalBeats) }).map((_, i) => {
            const beatNum = i + 1;
            const isBarStart = (beatNum - 1) % 4 === 0;
            return (
              <div
                key={i}
                className="flex items-center"
                style={{ width: `${PIXELS_PER_BEAT}px` }}
              >
                <span className={`pl-1 ${isBarStart ? 'font-bold text-amber-300' : 'text-slate-400'}`}>
                  {isBarStart ? `Bar ${Math.floor((beatNum - 1) / 4) + 1}` : `${beatNum}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Piano Roll Canvas & Keyboard */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Piano Keys on Left */}
        <div className="w-16 bg-[#101522] border-r border-[#1e2738] z-10 overflow-hidden flex flex-col shrink-0">
          <div
            className="flex flex-col"
            style={{
              transform: scrollRef.current ? `translateY(-${scrollRef.current.scrollTop}px)` : 'none',
            }}
          >
            {Array.from({ length: totalRows }).map((_, idx) => {
              const midi = MAX_MIDI - idx;
              const isBlackKey = [1, 3, 6, 8, 10].includes(midi % 12);
              const isC = midi % 12 === 0;
              const spn = midiToSpn(midi);

              // Check if key has custom drum map label
              const isPerc =
                activeTrack?.channel === 10 ||
                /tabla|indian|percussion|dholak/i.test(activeTrack?.name || '') ||
                activeTrack?.program === 116 ||
                activeTrack?.program === 117;
              const percussionEntry = isPerc
                ? FLUID_INDIAN_PERCUSSION_MAP.find((m) => m.midi === midi)
                : null;
              const label = percussionEntry ? percussionEntry.name : isC ? spn : isBlackKey ? '' : spn;

              return (
                <button
                  key={midi}
                  type="button"
                  onMouseDown={() =>
                    studioAudioEngine.playSingleNote(
                      midi,
                      90,
                      activeTrack?.channel,
                      activeTrack?.program,
                      activeTrack?.id
                    )
                  }
                  className={`h-[18px] text-[9px] font-mono flex items-center justify-end pr-1.5 transition-colors border-b border-[#182133] ${
                    percussionEntry
                      ? 'bg-[#1a2333] text-amber-300 font-semibold hover:bg-[#25334a]'
                      : isBlackKey
                      ? 'bg-[#151c2a] text-slate-400 hover:bg-[#202b40]'
                      : 'bg-[#222c3f] text-slate-200 font-semibold hover:bg-[#2d3a54]'
                  }`}
                  title={percussionEntry ? `${percussionEntry.name} (MIDI ${midi})` : spn}
                >
                  {percussionEntry ? (
                    <span className="text-amber-300 font-bold truncate">{label}</span>
                  ) : isC ? (
                    <span className="text-amber-400 font-bold">{spn}</span>
                  ) : (
                    label
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Grid Area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleCanvasMouseDown}
          className="flex-1 overflow-auto relative cursor-crosshair"
        >
          <div
            className="relative"
            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          >
            {/* Horizontal Pitch Grid Rows */}
            <svg width={canvasWidth} height={canvasHeight} className="absolute inset-0 pointer-events-none">
              <defs>
                {/* Striped pattern for AI Ghost Notes */}
                <pattern id="ghostPattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#a855f7" strokeWidth="2" strokeOpacity="0.6" />
                </pattern>
              </defs>

              {Array.from({ length: totalRows }).map((_, idx) => {
                const midi = MAX_MIDI - idx;
                const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
                const isC = midi % 12 === 0;
                const y = idx * ROW_HEIGHT;
                return (
                  <rect
                    key={midi}
                    x={0}
                    y={y}
                    width={canvasWidth}
                    height={ROW_HEIGHT}
                    fill={isBlack ? '#0a0d12' : '#0e1219'}
                    stroke={isC ? '#1e293b' : '#141a24'}
                    strokeWidth={isC ? 1.5 : 0.8}
                  />
                );
              })}

              {/* Vertical Beat Grid Lines */}
              {Array.from({ length: Math.ceil(totalBeats * 4) }).map((_, i) => {
                const beat = i * 0.25;
                const x = beat * PIXELS_PER_BEAT;
                const isQuarterBeat = i % 4 === 0;
                const isBar = i % 16 === 0;

                return (
                  <line
                    key={i}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={canvasHeight}
                    stroke={isBar ? '#253247' : isQuarterBeat ? '#1b2333' : '#121824'}
                    strokeWidth={isBar ? 1.5 : 0.8}
                  />
                );
              })}
            </svg>

            {/* Inactive Track Notes (Ghosted Background Layer with Soft Glow on Cross-Track Hover) */}
            {tracks
              .filter((t) => t.id !== activeTrackId && !t.isMuted)
              .flatMap((t) => t.notes)
              .map((note) => {
                const x = beatToX(note.beat);
                const y = midiToY(note.midiNumber);
                const width = Math.max(6, note.duration * PIXELS_PER_BEAT - 2);
                const isHovered =
                  (hoveredNoteId !== null && note.id === hoveredNoteId) ||
                  (hoveredNoteId === null && hoveredLine !== null && note.line === hoveredLine);

                return (
                  <div
                    key={note.id}
                    className={`absolute rounded-sm pointer-events-none transition-all ${
                      isHovered
                        ? 'opacity-90 ring-2 ring-amber-400/80 bg-amber-400/70 z-15 shadow-[0_0_18px_5px_rgba(251,191,36,0.55)] backdrop-blur-xs'
                        : 'opacity-35 bg-[#64748b] shadow-sm'
                    }`}
                    style={{
                      left: `${x}px`,
                      top: `${y + 1}px`,
                      width: `${width}px`,
                      height: `${ROW_HEIGHT - 2}px`,
                    }}
                  />
                );
              })}

            {/* Active Track Notes (Fully Interactive with Live Drag Following) */}
            {activeTrackNotes.map((note) => {
              const x = beatToX(note.beat);
              const y = midiToY(note.midiNumber);
              const width = Math.max(6, note.duration * PIXELS_PER_BEAT - 2);

              const isDraggingThis =
                dragState !== null &&
                (note.id === dragState.note.id ||
                  (currentNoteRef.current &&
                    (note.id === currentNoteRef.current.id ||
                      (note.trackId === currentNoteRef.current.trackId &&
                        note.midiNumber === currentNoteRef.current.midiNumber &&
                        Math.abs(note.beat - currentNoteRef.current.beat) < 0.05))));

              const isSelected = note.id === selectedNoteId || isDraggingThis;

              // Note hover highlights only the single hovered note; Line hover (from CodeMirror) highlights all notes on that line
              const isDirectHover = (hoveredNoteId !== null && note.id === hoveredNoteId) || isDraggingThis;
              const isLineHover =
                !isDirectHover &&
                hoveredNoteId === null &&
                hoveredLine !== null &&
                note.line === hoveredLine;

              return (
                <div
                  key={note.id}
                  onMouseDown={(e) => handleNoteMouseDown(note, e, 'move')}
                  onMouseEnter={() => onHoverNote?.(note)}
                  onMouseLeave={() => {
                    if (!dragState) onHoverNote?.(null);
                  }}
                  className={`absolute rounded group flex items-center justify-between px-1.5 transition-all cursor-move ${
                    isDirectHover
                      ? 'ring-2 ring-amber-300 bg-amber-300 text-slate-950 font-bold z-20 shadow-[0_0_14px_rgba(251,191,36,0.9)] scale-[1.02]'
                      : isSelected
                      ? 'ring-2 ring-sky-400 bg-amber-400 text-slate-950 font-bold z-20 shadow-lg'
                      : isLineHover
                      ? 'ring-2 ring-amber-300 bg-amber-400 text-slate-950 font-bold z-20 shadow-[0_0_10px_rgba(251,191,36,0.7)]'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold z-10 shadow-sm'
                  }`}
                  style={{
                    left: `${x}px`,
                    top: `${y + 1}px`,
                    width: `${width}px`,
                    height: `${ROW_HEIGHT - 2}px`,
                  }}
                  title={`${note.pitch} | Line: ${note.line} | Beat: ${note.beat} | Dur: ${note.duration} | Vel: ${note.velocity}`}
                >
                  <span className="text-[10px] font-mono leading-none truncate pointer-events-none">
                    {note.pitch}
                  </span>

                  {/* Resize Duration Handle on Right Edge */}
                  <div
                    onMouseDown={(e) => handleNoteMouseDown(note, e, 'resize')}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-r transition-colors"
                  />
                </div>
              );
            })}

            {/* Live Pencil Click-and-Drag Note Preview */}
            {drawingNote && (
              <div
                className="absolute rounded bg-amber-400 border-2 border-white ring-2 ring-amber-300 text-slate-950 font-bold z-30 shadow-[0_0_12px_rgba(251,191,36,0.9)] flex items-center px-1.5 pointer-events-none"
                style={{
                  left: `${beatToX(drawingNote.startBeat)}px`,
                  top: `${midiToY(drawingNote.midiNumber) + 1}px`,
                  width: `${Math.max(6, drawingNote.duration * PIXELS_PER_BEAT - 2)}px`,
                  height: `${ROW_HEIGHT - 2}px`,
                }}
              >
                <span className="text-[10px] font-mono leading-none truncate pointer-events-none">
                  {drawingNote.pitch}
                </span>
              </div>
            )}

            {/* AI Suggestion Ghost Notes Layer */}
            {ghostNotes.map((gnote) => {
              const x = beatToX(gnote.beat);
              const y = midiToY(gnote.midiNumber);
              const width = Math.max(6, gnote.duration * PIXELS_PER_BEAT - 2);

              return (
                <div
                  key={gnote.id}
                  className="absolute rounded border border-purple-400/80 pointer-events-none z-30 shadow-md animate-pulse"
                  style={{
                    left: `${x}px`,
                    top: `${y + 1}px`,
                    width: `${width}px`,
                    height: `${ROW_HEIGHT - 2}px`,
                    background: 'rgba(168, 85, 247, 0.25)',
                  }}
                >
                  <span className="text-[9px] font-mono text-purple-200 px-1 font-bold">
                    {gnote.pitch} (AI)
                  </span>
                </div>
              );
            })}

            {/* Moving Playhead Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-amber-400 pointer-events-none z-40 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              style={{ left: `${beatToX(currentBeat)}px` }}
            >
              <div className="w-2.5 h-2.5 -ml-[4px] bg-amber-400 rotate-45" />
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Velocity Lane at Bottom */}
      {showVelocity && (
        <VelocityLane
          notes={activeTrackNotes}
          totalBeats={totalBeats}
          pixelsPerBeat={PIXELS_PER_BEAT}
          scrollLeft={scrollLeft}
          selectedNoteId={selectedNoteId}
          onVelocityChange={(note, newVel) => onNoteChange(note, { velocity: newVel })}
        />
      )}

      {/* Footer Toggle */}
      <div className="h-6 bg-[#0f1420] border-t border-[#1e2738] flex items-center justify-between px-3 text-[10px] font-mono text-slate-400">
        <div>
          Active: <span className="text-amber-400 font-bold">{activeTrack?.name || 'Track 1'}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowVelocity(!showVelocity)}
          className="hover:text-slate-200"
        >
          {showVelocity ? 'Hide Velocity Lane' : 'Show Velocity Lane'}
        </button>
      </div>
    </div>
  );
}
