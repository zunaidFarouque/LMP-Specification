import { useState, useCallback, useRef, useEffect } from 'react';

const MIN_PANEL_PERCENT = 20;
const MAX_PANEL_PERCENT = 80;
const DEFAULT_EDITOR_PERCENT = 50;
const LG_BREAKPOINT = 1024;

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

export function ResizableSplit({ left, right }: Props) {
  const [editorPercent, setEditorPercent] = useState(DEFAULT_EDITOR_PERCENT);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= LG_BREAKPOINT);
  const isDragging = useRef(false);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= LG_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const container = document.querySelector('[data-resize-container]');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(MIN_PANEL_PERCENT, Math.min(MAX_PANEL_PERCENT, percent));
    setEditorPercent(clamped);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  const leftWidth = isDesktop ? `${editorPercent}%` : '100%';

  return (
    <div
      data-resize-container
      className="flex flex-col lg:flex-row flex-1 min-h-0 w-full"
    >
      <div
        className="flex flex-col min-h-[300px] lg:min-h-0 shrink-0"
        style={{ width: leftWidth }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={editorPercent}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        className="hidden lg:block w-1.5 flex-shrink-0 bg-slate-700 hover:bg-amber-500/70 cursor-col-resize transition-colors shrink-0 select-none"
      />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 min-h-[300px] lg:min-h-0">
        {right}
      </div>
    </div>
  );
}
