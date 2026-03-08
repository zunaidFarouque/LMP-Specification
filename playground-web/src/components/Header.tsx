import { Download } from 'lucide-react';
import { EXAMPLES } from '../constants/examples';

type Props = {
  onExampleSelect: (lmp: string) => void;
  onDownload: () => void;
  canDownload: boolean;
};

export function Header({ onExampleSelect, onDownload, canDownload }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0f1419]/80 backdrop-blur">
      <h1 className="text-lg font-bold tracking-tight">LMP Playground</h1>
      <div className="flex items-center gap-3">
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          onChange={(e) => {
            const val = e.target.value as keyof typeof EXAMPLES;
            if (val && EXAMPLES[val]) onExampleSelect(EXAMPLES[val]);
            e.target.value = '';
          }}
        >
          <option value="">Examples</option>
          <option value="minimal">Minimal</option>
          <option value="chords">Piano + Flute</option>
          <option value="drums">Drums</option>
        </select>
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          Download MIDI
        </button>
      </div>
    </header>
  );
}
