import React, { useState, useRef, useCallback } from 'react';

interface Props {
  arrangerNode: React.ReactNode;
  pianoRollNode: React.ReactNode;
  editorNode: React.ReactNode;
}

export function DockableWorkspace({ arrangerNode, pianoRollNode, editorNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  // Left arranger width in pixels (e.g. 270px)
  const [arrangerWidth, setArrangerWidth] = useState<number>(270);
  // Center vs Right split: percentage of remaining width (Piano Roll vs Code Editor)
  const [pianoRollPercent, setPianoRollPercent] = useState<number>(60);
  // Active dragging state
  const [isResizing, setIsResizing] = useState<'arranger' | 'editor' | null>(null);

  // Dragging left divider (Arranger width)
  const handleArrangerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('arranger');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = moveEvent.clientX - rect.left;
      const maxWidth = Math.max(300, Math.floor(rect.width * 0.45));
      setArrangerWidth(Math.max(180, Math.min(maxWidth, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Dragging center divider (Piano Roll vs Code Editor)
  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('editor');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const area = editorAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const pct = (relativeX / rect.width) * 100;
      setPianoRollPercent(Math.max(20, Math.min(85, pct)));
    };

    const onMouseUp = () => {
      setIsResizing(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex flex-row min-h-0 min-w-0 relative overflow-hidden select-none">
      {/* 1. Track Mixer & Arranger Panel */}
      <div
        className="flex flex-col min-h-0 shrink-0 border-r border-[#1e2738]"
        style={{ width: `${arrangerWidth}px` }}
      >
        {arrangerNode}
      </div>

      {/* Resize Handle 1 (Arranger) */}
      <div
        role="separator"
        aria-label="Resize Tracks"
        onMouseDown={handleArrangerResize}
        className={`w-1.5 shrink-0 cursor-col-resize transition-colors z-20 ${
          isResizing === 'arranger' ? 'bg-amber-400' : 'bg-[#161d2a] hover:bg-amber-500/80 active:bg-amber-400'
        }`}
      />

      {/* Main Workspace (Piano Roll + Code Editor) */}
      <div ref={editorAreaRef} className="flex-1 flex flex-row min-h-0 min-w-0 relative">
        {/* 2. Interactive Piano Roll */}
        <div
          className="flex flex-col min-h-0 min-w-0"
          style={{ width: `${pianoRollPercent}%` }}
        >
          {pianoRollNode}
        </div>

        {/* Resize Handle 2 (Editor) */}
        <div
          role="separator"
          aria-label="Resize Editor"
          onMouseDown={handleEditorResize}
          className={`w-1.5 shrink-0 cursor-col-resize transition-colors z-20 ${
            isResizing === 'editor' ? 'bg-amber-400' : 'bg-[#161d2a] hover:bg-amber-500/80 active:bg-amber-400'
          }`}
        />

        {/* 3. Live Code Editor */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {editorNode}
        </div>
      </div>

      {/* Fullscreen drag overlay to prevent text selection / pointer capture during resizing */}
      {isResizing !== null && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />
      )}
    </div>
  );
}
