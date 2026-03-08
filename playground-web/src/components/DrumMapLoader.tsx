import { useRef } from 'react';
import { parseDrumMap } from '../utils/drumMap';
import type { DrumMap } from '../utils/drumMap';

type Props = {
  onLoad: (map: DrumMap, filename?: string) => void;
  onReset?: () => void;
  currentFile?: string;
};

export function DrumMapLoader({ onLoad, onReset, currentFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      const map = parseDrumMap(xml);
      onLoad(map, file.name);
    } catch (err) {
      console.error('Drum map error:', err);
    }
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".drm"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3 py-1.5 rounded-lg transition-colors"
      >
        Load drum map
      </button>
      <span className="text-xs text-slate-500">
        {currentFile ?? 'GM (default)'}
        {currentFile && onReset && (
          <button type="button" onClick={onReset} className="ml-1.5 text-amber-500 hover:text-amber-400">
            Reset
          </button>
        )}
      </span>
    </div>
  );
}
