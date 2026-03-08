import { useCallback, useMemo, useState } from 'react';
import { buildPianoRollData, parseLmpDrumMap } from '../utils/pianoRollData';
import type { PianoRollData } from '../utils/pianoRollData';
import { PianoRoll } from './PianoRoll';
import { GM_DRUM_MAP } from '../constants/gmDrumMap';

type LoadedDrumMap = { id: string; name: string; map: Record<number, string> };

type PreviewPanelProps = {
  midi: Uint8Array | null;
  sourceMap: Map<string, number> | null;
  onDecompiledLmp: (text: string) => void;
  decompile: (buffer: Uint8Array) => string;
  lmpText?: string;
  onHighlightLine?: (line: number | null) => void;
};

export function PreviewPanel({
  midi,
  sourceMap,
  onDecompiledLmp,
  decompile,
  lmpText = '',
  onHighlightLine,
}: PreviewPanelProps) {
  const [useInlineDrummap, setUseInlineDrummap] = useState(false);
  const [drumMaps, setDrumMaps] = useState<LoadedDrumMap[]>([]);
  const [selectedDrumMapId, setSelectedDrumMapId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.toLowerCase().endsWith('.mid')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer;
        if (!buf?.byteLength) return;
        try {
          const text = decompile(new Uint8Array(buf));
          onDecompiledLmp(text);
        } catch {
          // ignore
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [decompile, onDecompiledLmp]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const handleLoadDrumMap = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as Record<string, string>;
        const map: Record<number, string> = {};
        for (const [k, v] of Object.entries(json)) {
          const n = parseInt(k, 10);
          if (!Number.isNaN(n)) map[n] = v;
        }
        const name = file.name || `Drum map ${Date.now()}`;
        const id = `loaded-${Date.now()}`;
        setDrumMaps((prev) => [...prev, { id, name, map }]);
        setSelectedDrumMapId(id);
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleDeleteDrumMap = useCallback((id: string) => {
    setDrumMaps((prev) => prev.filter((d) => d.id !== id));
    setSelectedDrumMapId((current) => (current === id ? null : current));
  }, []);

  const baseDrumMap = useMemo((): Record<number, string> => {
    if (selectedDrumMapId === null) return GM_DRUM_MAP;
    const loaded = drumMaps.find((d) => d.id === selectedDrumMapId);
    return loaded?.map ?? GM_DRUM_MAP;
  }, [drumMaps, selectedDrumMapId]);

  const drumMap = useMemo((): Record<number, string> => {
    const inline = useInlineDrummap && lmpText ? parseLmpDrumMap(lmpText) : null;
    if (inline && Object.keys(inline).length > 0) return { ...baseDrumMap, ...inline };
    return baseDrumMap;
  }, [baseDrumMap, useInlineDrummap, lmpText]);

  const pianoRollData = useMemo((): PianoRollData | null => {
    if (!midi?.length) return null;
    return buildPianoRollData(midi, drumMap ?? null);
  }, [midi, drumMap]);

  return (
    <section className="flex flex-col min-h-0 flex-1 min-w-0 border-l border-slate-800 bg-slate-900/30">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <label className="text-sm font-medium text-slate-400">MIDI Preview</label>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Drum map:</span>
          <select
            value={selectedDrumMapId ?? ''}
            onChange={(e) => setSelectedDrumMapId(e.target.value ? e.target.value : null)}
            className="text-sm rounded border border-slate-600 bg-slate-800 text-slate-200 px-2 py-1 min-w-[140px]"
          >
            <option value="">Default (GM)</option>
            {drumMaps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <label className="text-sm text-slate-300 cursor-pointer">
            <span className="inline-block px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm">
              Load…
            </span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleLoadDrumMap}
            />
          </label>
          {selectedDrumMapId && drumMaps.some((d) => d.id === selectedDrumMapId) && (
            <button
              type="button"
              onClick={() => handleDeleteDrumMap(selectedDrumMapId)}
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200"
              title="Remove this drum map"
            >
              Delete
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={useInlineDrummap}
            onChange={(e) => setUseInlineDrummap(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
          />
          Use inline drummap
        </label>
      </div>
      <div
        className={`flex-1 flex flex-col min-h-0 overflow-hidden border-b border-slate-800 ${
          isDragging ? 'bg-emerald-900/20' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {!midi || midi.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-slate-500 text-sm text-center">
            <p>Compile LMP or drop a .mid file to decompile</p>
          </div>
        ) : !pianoRollData ? (
          <div className="flex-1 flex items-center justify-center p-6 text-slate-500 text-sm">
            Failed to parse MIDI
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <PianoRoll
              data={pianoRollData}
              sourceMap={sourceMap}
              onHighlightLine={onHighlightLine ?? (() => {})}
            />
          </div>
        )}
      </div>
    </section>
  );
}
