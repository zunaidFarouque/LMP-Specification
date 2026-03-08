import { useState } from 'react';
import { PianoRoll } from './PianoRoll';
import { DrumMapLoader } from './DrumMapLoader';
import type { DrumMap } from '../utils/drumMap';
import type { ParsedMidi } from '../hooks/useLmpCore';

type Props = {
  midi: Uint8Array | null;
  sourceMap: Map<string, number> | null;
  drumMap: DrumMap | null;
  onDrumMapChange: (map: DrumMap | null) => void;
  onDecompile: (buf: Uint8Array) => void;
  parseMidi: ((buf: Uint8Array) => ParsedMidi | null) | null;
};

export function PreviewPanel({ midi, sourceMap, drumMap, onDrumMapChange, onDecompile, parseMidi }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [drumMapFileName, setDrumMapFileName] = useState<string | undefined>();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.mid')) return;
    try {
      const buf = await file.arrayBuffer();
      onDecompile(new Uint8Array(buf));
    } catch (err) {
      console.error('Decompile error:', err);
    }
  };

  return (
    <section className="flex flex-col flex-1 min-h-[300px] lg:min-h-0 relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50 gap-2 flex-wrap">
        <label className="text-sm font-medium text-slate-400">MIDI Preview</label>
        <DrumMapLoader
          onLoad={(map, filename) => {
            onDrumMapChange(map);
            setDrumMapFileName(filename);
          }}
          onReset={() => {
            onDrumMapChange(null);
            setDrumMapFileName(undefined);
          }}
          currentFile={drumMapFileName}
        />
      </div>
      <div
        className={`flex-1 overflow-auto bg-slate-900/30 relative ${dragOver ? 'drag-over' : ''}`}
        onDragEnter={(e) => {
          handleDrag(e);
          setDragOver(true);
        }}
        onDragOver={handleDrag}
        onDragLeave={(e) => {
          handleDrag(e);
          setDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10 border-2 border-dashed border-slate-700 rounded-lg m-2 transition-opacity ${
            dragOver ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden
        >
          <p className="text-slate-500 text-sm">Drop .mid file here to decompile to LMP</p>
        </div>
        <PianoRoll
          midi={midi}
          sourceMap={sourceMap}
          drumMap={drumMap}
          parseMidi={parseMidi}
        />
      </div>
    </section>
  );
}
