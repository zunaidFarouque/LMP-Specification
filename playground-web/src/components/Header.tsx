import { Download, Play, Pause, Square, Repeat, Sparkles } from 'lucide-react';
import { TEMPLATES, EXAMPLES } from '../constants/examples';
import type { PlaybackState } from '../utils/audioEngine';

type Props = {
  onExampleSelect: (lmp: string) => void;
  onDownload: () => void;
  canDownload: boolean;
  playbackState?: PlaybackState;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  tempoMultiplier?: number;
  onTempoMultiplierChange?: (multiplier: number) => void;
  currentBpm?: number;
  canPlay?: boolean;
  onOpenAiComposer?: () => void;
};

const TEMPLATE_LABELS: Record<keyof typeof TEMPLATES, string> = {
  blank_piano: 'Piano (single track)',
  blank_drums: 'Drums (single track)',
  blank_multi: 'Piano + Drums',
  minimal_headers: 'Headers only',
};

const EXAMPLE_LABELS: Record<keyof typeof EXAMPLES, string> = {
  minimal: 'Minimal',
  chords: 'Chords & Legato',
  drums: 'Drums',
  repeating_velocity: 'Repeating + @RULE velocity',
  custom_map: 'Custom @MAP (Tabla)',
  voice_leading: 'Voice leading (+)',
  repeating_modifiers: 'Repeating modifiers (| R, | V)',
  control_change: 'Control Change (CC)',
  pitch_bend: 'Pitch Bend (PB)',
  tempo_timesig: 'Tempo & Time Signature',
  rest: 'Rest (R)',
  inherit: '@INHERIT',
};

export function Header({
  onExampleSelect,
  onDownload,
  canDownload,
  playbackState = 'stopped',
  onPlay,
  onPause,
  onStop,
  isLooping = false,
  onToggleLoop,
  tempoMultiplier = 1.0,
  onTempoMultiplierChange,
  currentBpm = 120,
  canPlay = false,
  onOpenAiComposer,
}: Props) {
  const isPlaying = playbackState === 'playing';

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#0f1419]/90 backdrop-blur z-20 gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight text-amber-400">LMP Playground</h1>

        {/* Transport Bar */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            type="button"
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canPlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={isPlaying ? 'Pause playback' : 'Play synthesized MIDI'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={playbackState === 'stopped'}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Stop playback"
            aria-label="Stop"
          >
            <Square size={14} className="fill-current" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-1.5 rounded-md transition-colors ${
              isLooping
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={isLooping ? 'Looping enabled' : 'Looping disabled'}
            aria-label="Loop toggle"
          >
            <Repeat size={14} />
          </button>

          {/* Tempo Slider */}
          <div className="flex items-center gap-2 pl-2 pr-1 border-l border-slate-800 text-xs text-slate-400">
            <span className="font-mono tabular-nums text-[11px] min-w-[55px]">
              {currentBpm} BPM
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={tempoMultiplier}
              onChange={(e) => onTempoMultiplierChange?.(parseFloat(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
              title={`Tempo speed: ${tempoMultiplier.toFixed(2)}x`}
            />
          </div>
        </div>

        {/* AI Composer Button */}
        <button
          type="button"
          onClick={onOpenAiComposer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/20 via-violet-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/40 text-amber-300 transition-all shadow-sm active:scale-95 group"
          title="Open AI Music Composer (BYOK / Gemini / OpenAI)"
        >
          <Sparkles size={14} className="text-amber-400 group-hover:rotate-12 transition-transform" />
          <span>AI Composer</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-200"
          onChange={(e) => {
            const val = e.target.value as keyof typeof TEMPLATES;
            if (val && TEMPLATES[val]) onExampleSelect(TEMPLATES[val]);
            e.target.value = '';
          }}
        >
          <option value="">New from template...</option>
          {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((k) => (
            <option key={k} value={k}>
              {TEMPLATE_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-slate-200"
          onChange={(e) => {
            const val = e.target.value as keyof typeof EXAMPLES;
            if (val && EXAMPLES[val]) onExampleSelect(EXAMPLES[val]);
            e.target.value = '';
          }}
        >
          <option value="">Load example...</option>
          {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((k) => (
            <option key={k} value={k}>
              {EXAMPLE_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Download size={14} />
          Download MIDI
        </button>
      </div>
    </header>
  );
}
