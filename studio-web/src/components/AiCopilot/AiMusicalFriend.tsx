import { useState, useEffect, useId, useMemo } from 'react';
import {
  Sparkles,
  X,
  Settings,
  Key,
  Play,
  Check,
  Headphones,
  Sliders,
  ExternalLink,
  Wand2,
  FilePlus,
  BookOpen,
  Eye,
  Settings2,
} from 'lucide-react';
import { STYLE_PRESETS, type StylePreset } from '../../core/aiPresets';
import {
  loadAiSettings,
  saveAiSettings,
  generateVariations,
  type AiSettings,
} from '../../core/aiService';
import { parseLmpDocument, replaceTrackInDocument } from '../../core/sourceMapBridge';
import { soundFontSpecManager, type SpecDocument } from '../../core/soundfontSpecManager';
import { SoundFontManagerModal } from '../SoundFontManager/SoundFontManagerModal';
import type { StudioNote, StudioTrack } from '../../core/types';

export interface GeneratedVariationItem {
  id: string;
  title: string;
  lmpCode: string;
  rawText: string;
  notes: StudioNote[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLmp: string;
  tracks?: StudioTrack[];
  activeTrackId?: number;
  onApplyVariation: (lmpCode: string) => void;
  onAuditionContext: (notes: StudioNote[]) => void;
  onAuditionSolo: (notes: StudioNote[]) => void;
  onHoverVariation: (notes: StudioNote[] | null) => void;
}

export function AiMusicalFriend({
  isOpen,
  onClose,
  currentLmp,
  tracks = [],
  activeTrackId,
  onApplyVariation,
  onAuditionContext,
  onAuditionSolo,
  onHoverVariation,
}: Props) {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [mode, setMode] = useState<'new' | 'edit'>('new');
  const [variationCount, setVariationCount] = useState<number>(2);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('blank');
  const [bpm, setBpm] = useState<number>(120);
  const [bars, setBars] = useState<number>(4);
  const [keyScale, setKeyScale] = useState<string>('C Major');
  const [targetTrackId, setTargetTrackId] = useState<string>('all');
  const [targetKit, setTargetKit] = useState<'auto' | 'gm' | 'indian_percussion' | 'trap808'>('auto');
  const [selectedSpecId, setSelectedSpecId] = useState<string>('auto');
  const [availableSpecs, setAvailableSpecs] = useState<SpecDocument[]>([]);
  const [isSpecManagerOpen, setIsSpecManagerOpen] = useState(false);
  const [specManagerInitialTab, setSpecManagerInitialTab] = useState<'soundfonts' | 'bindings' | 'specs'>('specs');
  const [specManagerSelectedSpecId, setSpecManagerSelectedSpecId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [variations, setVariations] = useState<GeneratedVariationItem[]>([]);
  const [activeAuditionId, setActiveAuditionId] = useState<string | null>(null);

  useEffect(() => {
    setAvailableSpecs(soundFontSpecManager.getSpecs());
    const unsub = soundFontSpecManager.subscribe(() => {
      setAvailableSpecs(soundFontSpecManager.getSpecs());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen && activeTrackId !== undefined && activeTrackId !== null) {
      handleTargetTrackChange(String(activeTrackId));
    }
  }, [isOpen, activeTrackId]);

  const effectiveSpecMatch = useMemo(() => {
    const targetTrk =
      targetTrackId !== 'all' && targetTrackId !== 'new'
        ? tracks.find((t) => t.id === Number(targetTrackId))
        : null;
    return soundFontSpecManager.matchSpecForTrack(targetTrk, selectedSpecId);
  }, [targetTrackId, tracks, selectedSpecId]);

  const geminiKeyId = useId();
  const geminiModelId = useId();
  const openAiKeyId = useId();

  const handleTargetTrackChange = (tidStr: string) => {
    setTargetTrackId(tidStr);
    if (tidStr === 'new') {
      setMode('edit');
    }
    if (tidStr !== 'all' && tidStr !== 'new') {
      const tid = Number(tidStr);
      const trk = tracks.find((t) => t.id === tid);
      if (trk) {
        if (trk.soundfont?.includes('Fluid') || /tabla|indian|percussion/i.test(trk.name)) {
          setTargetKit('indian_percussion');
        } else if (trk.channel === 10 || /drum/i.test(trk.name)) {
          setTargetKit('gm');
        }
      }
    }
  };

  const handleSelectPreset = (p: StylePreset) => {
    setSelectedPresetId(p.id);
    setBpm(p.bpm);
    setBars(p.bars);
    setKeyScale(p.keyScale);
    setPrompt(p.prompt);
  };

  const handleApplyVariation = (v: GeneratedVariationItem) => {
    if (targetTrackId !== 'all' && targetTrackId !== 'new') {
      const tid = Number(targetTrackId);
      const merged = replaceTrackInDocument(currentLmp, tid, v.lmpCode);
      onApplyVariation(merged);
    } else if (targetTrackId === 'new') {
      const nextId = (tracks?.length || 0) + 1;
      const merged = replaceTrackInDocument(currentLmp, nextId, v.lmpCode);
      onApplyVariation(merged);
    } else {
      onApplyVariation(v.lmpCode);
    }
  };

  const handleSaveSettings = (st: AiSettings) => {
    setSettings(st);
    saveAiSettings(st);
  };

  const handleGenerate = async () => {
    if (settings.provider === 'gemini' && !settings.geminiApiKey.trim()) {
      setShowSettings(true);
      setErrorMessage('Please enter your Google Gemini API key.');
      return;
    }
    if (settings.provider === 'openai' && !settings.openaiApiKey.trim()) {
      setShowSettings(true);
      setErrorMessage('Please enter your OpenAI / OpenRouter API key.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);
    setVariations([]);

    try {
      const activePreset = STYLE_PRESETS.find((p) => p.id === selectedPresetId);
      const effectivePrompt =
        prompt.trim() ||
        (activePreset && activePreset.id !== 'blank'
          ? activePreset.prompt
          : 'Compose a complete, loopable multi-track musical piece with rich groove and melodies.');

      const targetTrackObj =
        targetTrackId !== 'all' && targetTrackId !== 'new'
          ? tracks.find((t) => t.id === Number(targetTrackId))
          : undefined;

      const results = await generateVariations({
        prompt: effectivePrompt,
        variationCount,
        settings,
        mode,
        currentLmp,
        bpm,
        bars,
        keyScale,
        targetKit,
        targetTrackId:
          targetTrackId === 'all' || targetTrackId === 'new' ? targetTrackId : Number(targetTrackId),
        targetTrack: targetTrackObj,
        selectedSpecId,
        trackName: targetTrackObj?.name,
      });

      const parsedItems: GeneratedVariationItem[] = results.map((res, idx) => {
        const parsed = parseLmpDocument(res.lmpCode);
        const allNotes = parsed.tracks.flatMap((t) => t.notes);
        return {
          id: `var_${Date.now()}_${idx}`,
          title: res.title,
          lmpCode: res.lmpCode,
          rawText: res.rawText,
          notes: allNotes,
        };
      });

      setVariations(parsedItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm select-none animate-fadeIn">
      <div className="w-full max-w-xl bg-[#0d121c] border-l border-[#1e2738] flex flex-col h-full shadow-2xl text-slate-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2738] bg-[#141b27]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-violet-500 text-slate-950 font-bold shadow-md">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">AI Musical Friend</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {settings.provider === 'gemini' ? settings.geminiModel : settings.openaiModel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Generate & audition multiple musical ideas with ghost notes</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showSettings ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-[#1b2536] text-slate-300 border-[#222c3f]'
              }`}
              title="API Key & Model Settings"
            >
              <Settings size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1b2536] text-slate-400 hover:text-slate-200 border border-[#222c3f]"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Settings Box */}
        {showSettings && (
          <div className="p-3.5 bg-[#101622] border-b border-[#1e2738] space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-[#1e2738]">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Key size={12} className="text-amber-400" />
                BYOK Provider Settings
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] underline"
              >
                Free Gemini Key <ExternalLink size={10} />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveSettings({ ...settings, provider: 'gemini' })}
                className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  settings.provider === 'gemini'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-[#161e2c] border-[#222c3f] text-slate-400'
                }`}
              >
                <span>Google Gemini</span>
                <span className="text-[10px] text-slate-400">Gemini 3.5 Flash Lite default</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveSettings({ ...settings, provider: 'openai' })}
                className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  settings.provider === 'openai'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-[#161e2c] border-[#222c3f] text-slate-400'
                }`}
              >
                <span>OpenAI / Ollama / Custom</span>
                <span className="text-[10px] text-slate-400">Compatible custom endpoints</span>
              </button>
            </div>

            {settings.provider === 'gemini' ? (
              <div className="space-y-2">
                <div>
                  <label htmlFor={geminiKeyId} className="block text-[10px] text-slate-400 mb-1">
                    Gemini API Key
                  </label>
                  <input
                    id={geminiKeyId}
                    type="password"
                    placeholder="AIzaSy..."
                    value={settings.geminiApiKey}
                    onChange={(e) => handleSaveSettings({ ...settings, geminiApiKey: e.target.value })}
                    className="w-full bg-[#0a0d14] border border-[#222c3f] rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor={geminiModelId} className="block text-[10px] text-slate-400 mb-1">
                    Model
                  </label>
                  <select
                    id={geminiModelId}
                    value={settings.geminiModel}
                    onChange={(e) => handleSaveSettings({ ...settings, geminiModel: e.target.value })}
                    className="w-full bg-[#0a0d14] border border-[#222c3f] rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Default: Fastest, Highly Musical)</option>
                    <option value="gemma-4-31b">Gemma 4 31B (Open-Weights Leader)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor={openAiKeyId} className="block text-[10px] text-slate-400 mb-1">
                  API Key
                </label>
                <input
                  id={openAiKeyId}
                  type="password"
                  placeholder="sk-..."
                  value={settings.openaiApiKey}
                  onChange={(e) => handleSaveSettings({ ...settings, openaiApiKey: e.target.value })}
                  className="w-full bg-[#0a0d14] border border-[#222c3f] rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-950/80 border-b border-red-800 text-red-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage('')} className="text-red-400">
              ✕
            </button>
          </div>
        )}

        {/* Main Form Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Workflow Mode Tabs */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Generation Mode
            </label>
            <div className="grid grid-cols-2 gap-1 bg-[#141b27] p-1 rounded-lg border border-[#222c3f]">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'new' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wand2 size={13} /> Compose New Loop
              </button>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'edit' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders size={13} /> Enhance Current Project
              </button>
            </div>
          </div>

          {/* Style Presets Chips */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Style Inspiration
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    selectedPresetId === p.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-200 font-bold'
                      : 'bg-[#131926] border-[#222c3f] text-slate-300 hover:bg-[#182030]'
                  }`}
                >
                  <div className="text-xs flex items-center gap-1.5">
                    {p.id === 'blank' && <FilePlus size={12} className="text-amber-400 shrink-0" />}
                    <span>{p.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {p.id === 'blank' ? 'Blank Canvas' : `${p.bpm} BPM • ${p.keyScale}`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Multi-Variation Count & Musical Parameters */}
          <div className="p-3 bg-[#131926] border border-[#222c3f] rounded-xl grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Variations: <span className="text-amber-400">{variationCount} Ideas</span>
              </label>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={variationCount}
                onChange={(e) => setVariationCount(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none mt-2"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Length: <span className="text-amber-400">{bars} Bars</span>
              </label>
              <select
                value={bars}
                onChange={(e) => setBars(Number(e.target.value))}
                className="w-full bg-[#0a0d14] border border-[#222c3f] rounded px-2 py-1 text-xs text-slate-200 font-mono"
              >
                <option value={2}>2 Bars</option>
                <option value={4}>4 Bars (Standard)</option>
                <option value={8}>8 Bars (Extended)</option>
              </select>
            </div>
          </div>

          {/* Target Track Selection */}
          <div className="p-3 bg-[#131926] border border-[#222c3f] rounded-xl flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Target Track:
              </label>
              {targetTrackId !== 'all' && targetTrackId !== 'new' && (
                <span className="text-[10px] text-amber-400 font-mono">Single-Track Infill</span>
              )}
            </div>
            <select
              value={targetTrackId}
              onChange={(e) => handleTargetTrackChange(e.target.value)}
              className="w-full bg-[#0a0d14] border border-[#222c3f] rounded px-2 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="all">🎵 Entire Song (All Tracks)</option>
              {tracks.map((trk) => (
                <option key={trk.id} value={String(trk.id)}>
                  Track {trk.id}: {trk.name} ({trk.soundfont ? `SF2: ${trk.soundfont}` : trk.channel === 10 ? 'Ch 10 Drums' : `Patch ${trk.program}`})
                </option>
              ))}
              <option value="new">➕ Add as New Track</option>
            </select>
          </div>

          {/* AI Specification & Instrument Guide (Context Optimization) */}
          <div className="p-3 bg-[#131926] border border-[#222c3f] rounded-xl flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <BookOpen size={13} className="text-amber-400" />
                Attached Instrument Specification:
              </label>
              {effectiveSpecMatch.spec ? (
                <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {effectiveSpecMatch.isOverridden ? 'Manual Override' : 'Auto-Matched'}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono">None (Core LMP only)</span>
              )}
            </div>

            {/* Current Attached Doc Info Card */}
            {effectiveSpecMatch.spec ? (
              <div className="p-2.5 bg-[#0a0d14] border border-[#222c3f] rounded-lg flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                    📄 {effectiveSpecMatch.spec.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {effectiveSpecMatch.spec.fileName} • {effectiveSpecMatch.reason}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSpecManagerInitialTab('specs');
                    setSpecManagerSelectedSpecId(effectiveSpecMatch.spec?.id || null);
                    setIsSpecManagerOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium flex items-center gap-1 border border-slate-700 shrink-0 transition-colors"
                >
                  <Eye size={12} />
                  View Spec
                </button>
              </div>
            ) : (
              <div className="p-2 bg-[#0a0d14] border border-[#222c3f] rounded-lg text-[11px] text-slate-400">
                {effectiveSpecMatch.reason}
              </div>
            )}

            {/* Spec Selector Dropdown */}
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedSpecId}
                onChange={(e) => setSelectedSpecId(e.target.value)}
                className="flex-1 bg-[#0a0d14] border border-[#222c3f] rounded px-2 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-400"
              >
                <option value="auto">⚡ Auto (Match based on track soundfont/name/program)</option>
                <option value="none">🚫 None (Core LMP only, saves prompt tokens)</option>
                <optgroup label="Available Instrument Specifications">
                  {availableSpecs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.fileName})
                    </option>
                  ))}
                </optgroup>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSpecManagerInitialTab('bindings');
                  setIsSpecManagerOpen(true);
                }}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Open SoundFont & Spec Manager"
              >
                <Settings2 size={14} />
              </button>
            </div>
          </div>

          {/* User Prompt */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Creative Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Add an infectious syncopated bassline with ghost notes, or compose a 4-bar neo-soul chord groove..."
              className="w-full bg-[#0a0d14] border border-[#222c3f] rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none font-sans"
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles size={15} />
            <span>{isGenerating ? `Generating ${variationCount} Variations...` : `Generate ${variationCount} Musical Variations`}</span>
          </button>

          {/* Generated Variations List */}
          {variations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Audition Variations ({variations.length})
              </h4>

              {variations.map((v) => (
                <div
                  key={v.id}
                  onMouseEnter={() => onHoverVariation(v.notes)}
                  onMouseLeave={() => onHoverVariation(null)}
                  className="p-3 bg-[#131926] border border-[#222c3f] hover:border-purple-500/60 rounded-xl space-y-2 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-300">{v.title}</span>
                    <span className="text-[10px] font-mono text-purple-300">
                      {v.notes.length} notes (Ghost Overlay Active)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {/* Audition Context */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAuditionId(v.id);
                        onAuditionContext(v.notes);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                        activeAuditionId === v.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#1f293b] hover:bg-[#28354c] text-slate-200'
                      }`}
                    >
                      <Play size={12} className="fill-current text-amber-400" />
                      <span>Full Context</span>
                    </button>

                    {/* Solo Audition */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAuditionId(v.id);
                        onAuditionSolo(v.notes);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#1f293b] hover:bg-[#28354c] text-xs font-semibold text-slate-200 transition-colors"
                    >
                      <Headphones size={12} className="text-purple-400" />
                      <span>Solo Audition</span>
                    </button>

                    {/* Apply to Code */}
                    <button
                      type="button"
                      onClick={() => handleApplyVariation(v)}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                    >
                      <Check size={13} />
                      <span>{targetTrackId !== 'all' ? 'Apply to Track' : 'Apply Song'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SoundFontManagerModal
        isOpen={isSpecManagerOpen}
        onClose={() => setIsSpecManagerOpen(false)}
        initialTab={specManagerInitialTab}
        selectedSpecIdForView={specManagerSelectedSpecId}
      />
    </div>
  );
}
