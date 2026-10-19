import { useRef, useCallback } from 'react';
import type { StudioNote } from '../../core/types';

interface Props {
  notes: StudioNote[];
  totalBeats: number;
  pixelsPerBeat: number;
  scrollLeft: number;
  onVelocityChange: (note: StudioNote, newVelocity: number) => void;
  selectedNoteId: string | null;
}

export function VelocityLane({
  notes,
  totalBeats,
  pixelsPerBeat,
  scrollLeft,
  onVelocityChange,
  selectedNoteId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (note: StudioNote, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startY = e.clientY;
      const initialVel = note.velocity;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = startY - moveEvent.clientY; // drag up increases
        const deltaVel = Math.round(deltaY * 1.5);
        const newVel = Math.max(1, Math.min(127, initialVel + deltaVel));
        onVelocityChange(note, newVel);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [onVelocityChange]
  );

  const laneWidth = totalBeats * pixelsPerBeat;

  return (
    <div className="h-20 bg-[#0c1017] border-t border-[#1e2738] relative flex flex-col select-none">
      <div className="flex items-center justify-between px-3 py-1 bg-[#10151f] border-b border-[#1e2738] text-[10px] font-mono text-slate-400">
        <span>NOTE VELOCITY (1–127)</span>
        <span className="text-amber-400/80">Click/drag stalk handle to adjust</span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ transform: `translateX(-${scrollLeft}px)` }}
      >
        <svg width={laneWidth} height="100%" className="absolute inset-0">
          {/* Velocity Guide Lines (25%, 50%, 75%, 100%) */}
          <line x1={0} y1="25%" x2={laneWidth} y2="25%" stroke="#1a2333" strokeDasharray="3 3" />
          <line x1={0} y1="50%" x2={laneWidth} y2="50%" stroke="#1a2333" strokeDasharray="3 3" />
          <line x1={0} y1="75%" x2={laneWidth} y2="75%" stroke="#1a2333" strokeDasharray="3 3" />

          {/* Note Velocity Stalks */}
          {notes.map((note) => {
            const x = (note.beat - 1.0) * pixelsPerBeat + 3;
            const heightPercent = (note.velocity / 127) * 80; // max 80% of lane height
            const isSelected = note.id === selectedNoteId;

            return (
              <g
                key={note.id}
                className="cursor-ns-resize group"
                onMouseDown={(e) => handleMouseDown(note, e)}
              >
                {/* Vertical Stalk */}
                <line
                  x1={x}
                  y1={`${100 - heightPercent}%`}
                  x2={x}
                  y2="100%"
                  stroke={isSelected ? '#38bdf8' : '#f59e0b'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-colors group-hover:stroke-amber-300"
                />
                {/* Grab Hit Area */}
                <circle
                  cx={x}
                  cy={`${100 - heightPercent}%`}
                  r={8}
                  fill="transparent"
                  className="cursor-ns-resize"
                />
                {/* Handle Head */}
                <circle
                  cx={x}
                  cy={`${100 - heightPercent}%`}
                  r={isSelected ? 4.5 : 3.5}
                  fill={isSelected ? '#38bdf8' : '#f59e0b'}
                  stroke={isSelected ? '#ffffff' : 'transparent'}
                  strokeWidth={1}
                  className="transition-colors group-hover:fill-amber-300 group-hover:stroke-white group-hover:stroke-[1.5]"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
