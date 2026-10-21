import {
  Play,
  Pause,
  Square,
  Repeat,
  Sparkles,
  Download,
  MousePointer,
  Pencil,
  Eraser,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Layers,
  Music,
} from 'lucide-react';
import type { ToolMode, SnapResolution, TransportState } from '../../core/types';

interface Props {
  transport: TransportState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onBpmChange: (bpm: number) => void;
  onMasterVolumeChange: (vol: number) => void;
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  snap: SnapResolution;
  onSnapChange: (snap: SnapResolution) => void;
  soundPreview?: boolean;
  onToggleSoundPreview?: () => void;
  collapseCommons?: boolean;
  onToggleCollapseCommons?: () => void;
  scrollLock: boolean;
  onToggleScrollLock: () => void;
  onOpenAiFriend: () => void;
  onOpenSoundFontManager?: () => void;
  onDownloadMidi: () => void;
  canDownload: boolean;
}

export function TransportBar({
  transport,
  onPlay,
  onPause,
  onStop,
  onToggleLoop,
  onBpmChange,
  onMasterVolumeChange,
  activeTool,
  onSelectTool,
  snap,
  onSnapChange,
  soundPreview = true,
  onToggleSoundPreview,
  collapseCommons = true,
  onToggleCollapseCommons,
  scrollLock,
  onToggleScrollLock,
  onOpenAiFriend,
  onOpenSoundFontManager,
  onDownloadMidi,
  canDownload,
}: Props) {
  const isPlaying = transport.state === 'playing';

  return (
    <header className="h-13 bg-[#0d121c] border-b border-[#1e2738] flex items-center justify-between px-3.5 py-1.5 gap-3 select-none z-20">
      {/* Brand & Transport controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2 border-r border-[#1e2738]">
          <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-orange-400 bg-clip-text text-transparent">
            LMP Studio
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            v2.0
          </span>
        </div>

        {/* Transport buttons */}
        <div className="flex items-center gap-1 bg-[#141b27] p-1 rounded-lg border border-[#222c3f]">
          <button
            type="button"
            onClick={isPlaying ? onPause : onPlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-[#1b2536] text-slate-200 hover:bg-[#253247] hover:text-white'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={onStop}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#1f293b] transition-colors"
            title="Stop"
          >
            <Square size={13} className="fill-current" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-1.5 rounded-md transition-colors ${
              transport.isLooping
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f293b]'
            }`}
            title="Loop Playback"
          >
            <Repeat size={13} />
          </button>
        </div>

        {/* BPM & TimeSig Counter */}
        <div className="flex items-center gap-2 bg-[#141b27] px-2.5 py-1 rounded-lg border border-[#222c3f] text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase">BPM</span>
            <input
              type="number"
              min={40}
              max={300}
              value={Math.round(transport.bpm)}
              onChange={(e) => onBpmChange(Number(e.target.value))}
              className="w-13 bg-transparent font-mono text-amber-300 font-bold focus:outline-none focus:ring-0 text-center text-xs"
            />
          </div>
          <span className="text-slate-600">|</span>
          <div className="font-mono text-slate-300 text-[11px] font-bold">
            {transport.timeSig[0]}/{transport.timeSig[1]}
          </div>
        </div>

        {/* Tools (Pointer, Pencil, Eraser) + Audition Sound Preview */}
        <div className="flex items-center gap-0.5 bg-[#141b27] p-1 rounded-lg border border-[#222c3f]">
          <button
            type="button"
            onClick={() => onSelectTool('pointer')}
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'pointer'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f293b]'
            }`}
            title="Pointer / Select Tool (V)"
          >
            <MousePointer size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSelectTool('pencil')}
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'pencil'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f293b]'
            }`}
            title="Pencil / Draw Note Tool (B)"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSelectTool('eraser')}
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'eraser'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f293b]'
            }`}
            title="Eraser Tool (E)"
          >
            <Eraser size={14} />
          </button>

          <span className="w-px h-4 bg-[#253247] mx-0.5" />

          {/* Sound Preview / Audition Toggle Button */}
          <button
            type="button"
            onClick={onToggleSoundPreview}
            className={`p-1.5 rounded-md transition-all ${
              soundPreview
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-[#1f293b]'
            }`}
            title={soundPreview ? 'Audition Preview ON: Hear notes while dragging or inserting' : 'Audition Preview OFF'}
          >
            {soundPreview ? <Volume2 size={14} className="text-amber-400" /> : <VolumeX size={14} />}
          </button>
        </div>

        {/* Snap to Grid */}
        <div className="flex items-center gap-1.5 bg-[#141b27] px-2 py-1 rounded-lg border border-[#222c3f] text-xs">
          <span className="text-[10px] uppercase font-mono text-slate-400">Snap:</span>
          <select
            value={snap}
            onChange={(e) => onSnapChange(e.target.value as SnapResolution)}
            className="bg-transparent font-mono text-slate-200 focus:outline-none text-xs cursor-pointer"
          >
            <option value="1/4" className="bg-[#141b27]">1/4 Beat</option>
            <option value="1/8" className="bg-[#141b27]">1/8 Note</option>
            <option value="1/16" className="bg-[#141b27]">1/16 Note</option>
            <option value="1/32" className="bg-[#141b27]">1/32 Note</option>
            <option value="1/12" className="bg-[#141b27]">1/12 Triplet</option>
            <option value="free" className="bg-[#141b27]">Off (Free)</option>
          </select>
        </div>
      </div>

      {/* Right controls: Scroll Lock, Volume, AI Copilot, Download */}
      <div className="flex items-center gap-2.5">
        {/* Collapse Common Chords Toggle */}
        <button
          type="button"
          onClick={onToggleCollapseCommons}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            collapseCommons
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-[#141b27] text-slate-400 border-[#222c3f] hover:text-slate-200 hover:bg-[#1b2536]'
          }`}
          title={
            collapseCommons
              ? 'Collapse Common Chords: ON (Notes with identical beat, velocity & duration merge into one chord)'
              : 'Collapse Common Chords: OFF (Always creates separate note lines)'
          }
        >
          <Layers size={12} className={collapseCommons ? 'text-amber-400' : 'text-slate-400'} />
          <span className="text-[11px] font-mono">Collapse Chords</span>
        </button>

        {/* Selection-Only Scroll Lock */}
        <button
          type="button"
          onClick={onToggleScrollLock}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            scrollLock
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : 'bg-[#141b27] text-slate-400 border-[#222c3f] hover:text-slate-200 hover:bg-[#1b2536]'
          }`}
          title={
            scrollLock
              ? 'Selection Focus ON: Clicking note centers code line without auto-jumping during playback'
              : 'Selection Focus OFF'
          }
        >
          {scrollLock ? <Lock size={12} className="text-blue-400" /> : <Unlock size={12} />}
          <span className="text-[11px] font-mono">Sync Focus</span>
        </button>

        {/* Master Volume */}
        <div className="flex items-center gap-1.5 bg-[#141b27] px-2.5 py-1 rounded-lg border border-[#222c3f] text-xs">
          <Volume2 size={13} className="text-slate-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={transport.masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="w-16 accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
            title={`Master Volume: ${Math.round(transport.masterVolume * 100)}%`}
          />
        </div>

        {/* SoundFonts & Specs Manager Button */}
        <button
          type="button"
          onClick={onOpenSoundFontManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold bg-[#141b27] text-slate-300 border-[#222c3f] hover:text-amber-300 hover:border-amber-500/50 hover:bg-[#1b2536] transition-all"
          title="Manage SoundFonts, program banks, and instrument markdown specifications"
        >
          <Music size={13} className="text-amber-400" />
          <span className="text-[11px] font-mono">SoundFonts & Specs</span>
        </button>

        {/* AI Copilot Button */}
        <button
          type="button"
          onClick={onOpenAiFriend}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/20 via-violet-500/25 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/50 text-amber-300 transition-all shadow-md active:scale-95 group"
        >
          <Sparkles size={14} className="text-amber-400 group-hover:rotate-12 transition-transform" />
          <span>AI Musical Friend</span>
        </button>

        {/* Download MIDI */}
        <button
          type="button"
          onClick={onDownloadMidi}
          disabled={!canDownload}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Download size={13} />
          <span>Export MIDI</span>
        </button>
      </div>
    </header>
  );
}
