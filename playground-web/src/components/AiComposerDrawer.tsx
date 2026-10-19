import { useState, useRef, useEffect, useId } from 'react';
import {
  Sparkles,
  X,
  Settings,
  Key,
  Play,
  Check,
  RotateCcw,
  Sliders,
  Music,
  ExternalLink,
  Copy,
  Layers,
  Wand2,
  Square,
  History,
  FilePlus,
} from 'lucide-react';
import { STYLE_PRESETS, type StylePreset } from '../constants/aiPresets';
import {
  LMP_SYSTEM_INSTRUCTION,
  buildUserPrompt,
  type GenerationMode,
} from '../constants/aiPrompts';
import {
  loadAiSettings,
  saveAiSettings,
  generateLmpMusic,
  extractLmpCode,
  type AiSettings,
} from '../services/aiService';

export interface GeneratedTake {
  id: string;
  takeNumber: number;
  title: string;
  timestamp: number;
  prompt: string;
  rawText: string;
  lmpCode: string;
  bpm: number;
  bars: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLmp: string;
  onApplyLmp: (lmpCode: string, autoPlay?: boolean) => void;
  onCompileValidation?: (lmpCode: string) => { success: boolean; bytes?: number; error?: string };
}

const COMMON_KEYS = [
  'C Major',
  'A Minor',
  'G Major',
  'E Minor',
  'D Minor',
  'F Major',
  'D Major',
  'B Minor',
  'Eb Major',
  'C Minor',
  'F# Minor',
  'A Dorian',
];

export function AiComposerDrawer({
  isOpen,
  onClose,
  currentLmp,
  onApplyLmp,
  onCompileValidation,
}: Props) {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Musical controls
  const [mode, setMode] = useState<GenerationMode>('new');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('blank');
  const [bpm, setBpm] = useState<number>(120);
  const [bars, setBars] = useState<number>(4);
  const [keyScale, setKeyScale] = useState<string>('C Major');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [extractedCode, setExtractedCode] = useState('');
  const [compileStatus, setCompileStatus] = useState<{ success: boolean; bytes?: number; error?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [takes, setTakes] = useState<GeneratedTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const geminiKeyInputId = useId();
  const geminiModelInputId = useId();
  const openAiKeyInputId = useId();
  const openAiBaseUrlInputId = useId();
  const openAiModelInputId = useId();

  // Load preset details when clicked
  const handleSelectPreset = (preset: StylePreset) => {
    setSelectedPresetId(preset.id);
    setBpm(preset.bpm);
    setBars(preset.bars);
    setKeyScale(preset.keyScale);
    setCustomPrompt(preset.prompt);
  };

  const handleSaveSettings = (newSettings: AiSettings) => {
    setSettings(newSettings);
    saveAiSettings(newSettings);
  };

  // Compile check whenever extracted code changes
  useEffect(() => {
    if (!extractedCode || !onCompileValidation) {
      setCompileStatus(null);
      return;
    }
    const res = onCompileValidation(extractedCode);
    setCompileStatus(res);
  }, [extractedCode, onCompileValidation]);

  const handleGenerate = async () => {
    // Basic API key validation
    if (settings.provider === 'gemini' && !settings.geminiApiKey.trim()) {
      setShowSettings(true);
      setErrorMessage('Please enter your Google Gemini API key to start generating.');
      return;
    }
    if (settings.provider === 'openai' && !settings.openaiApiKey.trim()) {
      setShowSettings(true);
      setErrorMessage('Please enter your OpenAI / OpenRouter API key.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);
    setStreamingText('');
    setExtractedCode('');

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    const activePreset = STYLE_PRESETS.find((p) => p.id === selectedPresetId);
    const userPrompt = buildUserPrompt({
      prompt: customPrompt.trim() || 'Create an original musical composition with rich rhythm, harmony, and melody.',
      mode,
      loopBars: bars,
      bpm,
      keyScale,
      genreName: activePreset?.id === 'blank' ? undefined : activePreset?.name,
      currentLmp,
    });

    try {
      const result = await generateLmpMusic({
        prompt: userPrompt,
        systemInstruction: LMP_SYSTEM_INSTRUCTION,
        settings,
        signal: abortCtrl.signal,
        onChunk: (chunk) => {
          setStreamingText(chunk);
          const interimCode = extractLmpCode(chunk);
          if (interimCode) setExtractedCode(interimCode);
        },
      });

      const finalCode = result.lmpCode || extractLmpCode(result.rawText);
      setExtractedCode(finalCode);

      // Save as a new take
      const newTake: GeneratedTake = {
        id: `take_${Date.now()}`,
        takeNumber: takes.length + 1,
        title: activePreset?.id === 'blank' ? `Custom ${keyScale} Composition` : (activePreset?.name || `Custom ${keyScale} Groove`),
        timestamp: Date.now(),
        prompt: customPrompt.trim() || 'Custom Canvas Composition',
        rawText: result.rawText,
        lmpCode: finalCode,
        bpm,
        bars,
      };

      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped generation manually
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopyCode = () => {
    if (!extractedCode) return;
    navigator.clipboard.writeText(extractedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyTake = (take: GeneratedTake, autoPlay: boolean) => {
    setExtractedCode(take.lmpCode);
    setActiveTakeId(take.id);
    onApplyLmp(take.lmpCode, autoPlay);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0d1117] border-l border-slate-800 flex flex-col h-full shadow-2xl relative text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#161b22]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-violet-500 text-slate-950 shadow-md">
              <Sparkles size={18} className="fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-slate-100">LMP AI Composer</h2>
                <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  BYOK Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Generate, audition & loop MIDI using AI in browser</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'history' ? 'create' : 'history')}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                activeTab === 'history'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="View past takes"
            >
              <History size={14} />
              <span className="font-mono text-[11px]">Takes ({takes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showSettings
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="API Keys & Model Settings"
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title="Close panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Expandable Settings Section */}
        {showSettings && (
          <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Key size={13} className="text-amber-400" />
                AI Provider & API Key (BYOK)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] underline"
              >
                Get Free Gemini Key <ExternalLink size={11} />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveSettings({ ...settings, provider: 'gemini' })}
                className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  settings.provider === 'gemini'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>Google Gemini</span>
                <span className="text-[10px] text-slate-400 font-normal">Free tier available • Fast & creative</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveSettings({ ...settings, provider: 'openai' })}
                className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                  settings.provider === 'openai'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>OpenAI / Ollama / Custom</span>
                <span className="text-[10px] text-slate-400 font-normal">Compatible endpoints & local models</span>
              </button>
            </div>

            {settings.provider === 'gemini' ? (
              <div className="space-y-2">
                <div>
                  <label htmlFor={geminiKeyInputId} className="block text-[11px] text-slate-400 mb-1">
                    Google Gemini API Key
                  </label>
                  <input
                    id={geminiKeyInputId}
                    type="password"
                    placeholder="AIzaSy..."
                    value={settings.geminiApiKey}
                    onChange={(e) => handleSaveSettings({ ...settings, geminiApiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor={geminiModelInputId} className="block text-[11px] text-slate-400 mb-1">
                    Gemini / Gemma Model
                  </label>
                  <select
                    id={geminiModelInputId}
                    value={settings.geminiModel}
                    onChange={(e) => handleSaveSettings({ ...settings, geminiModel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Default: Fastest, Highly Musical & Efficient)</option>
                    <option value="gemma-4-31b">Gemma 4 31B (Open-Weights Leader)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Polyphonic Reasoning)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label htmlFor={openAiKeyInputId} className="block text-[11px] text-slate-400 mb-1">
                    API Key (Optional for local Ollama)
                  </label>
                  <input
                    id={openAiKeyInputId}
                    type="password"
                    placeholder="sk-..."
                    value={settings.openaiApiKey}
                    onChange={(e) => handleSaveSettings({ ...settings, openaiApiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={openAiBaseUrlInputId} className="block text-[11px] text-slate-400 mb-1">
                      Base URL
                    </label>
                    <input
                      id={openAiBaseUrlInputId}
                      type="text"
                      placeholder="https://api.openai.com/v1"
                      value={settings.openaiBaseUrl}
                      onChange={(e) => handleSaveSettings({ ...settings, openaiBaseUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={openAiModelInputId} className="block text-[11px] text-slate-400 mb-1">
                      Model ID
                    </label>
                    <input
                      id={openAiModelInputId}
                      type="text"
                      placeholder="gpt-4o"
                      value={settings.openaiModel}
                      onChange={(e) => handleSaveSettings({ ...settings, openaiModel: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">Quick fill:</span>
                  {['gemma-4-31b', 'gpt-4o', 'gpt-4o-mini', 'deepseek-chat'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSaveSettings({ ...settings, openaiModel: m })}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 italic">
              Keys are strictly stored in your local browser storage and never transmitted to any third-party server.
            </p>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-950/70 border-b border-red-800/80 text-red-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-200">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'history' ? (
            /* Takes History View */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Session Takes ({takes.length})
                </h3>
                {takes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTakes([])}
                    className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Clear all
                  </button>
                )}
              </div>

              {takes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Music size={28} className="mx-auto opacity-40 text-amber-400" />
                  <p className="text-xs">No takes generated in this session yet.</p>
                  <p className="text-[11px] text-slate-400">Generate a loop to start building your take history!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {takes.map((take) => (
                    <div
                      key={take.id}
                      className={`p-3 rounded-xl border transition-all ${
                        activeTakeId === take.id
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            Take #{take.takeNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-200">{take.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(take.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mb-2.5">{take.prompt}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyTake(take, true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
                        >
                          <Play size={12} className="fill-current" />
                          Audition & Play
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTake(take, false)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                        >
                          Load to Editor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Creation View */
            <>
              {/* Generation Mode Selector */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Workflow Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      mode === 'new'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Wand2 size={13} /> New Loop
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('layer')}
                    className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      mode === 'layer'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers size={13} /> Add Track Layer
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('transform')}
                    className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      mode === 'transform'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders size={13} /> Humanize
                  </button>
                </div>
              </div>

              {/* Presets Grid */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Style Presets (1-Click Prompt Recipes)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        selectedPresetId === preset.id
                          ? 'bg-amber-500/15 border-amber-500/70 text-amber-200 shadow-sm'
                          : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="font-semibold text-xs leading-tight mb-1 flex items-center gap-1.5">
                        {preset.id === 'blank' && <FilePlus size={12} className="text-amber-400 shrink-0" />}
                        <span>{preset.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        {preset.id === 'blank' ? (
                          <span className="text-amber-300/80">Clean Canvas</span>
                        ) : (
                          <>
                            <span>{preset.bpm} BPM</span>
                            <span>{preset.keyScale}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Musical Parameters */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">
                    Loop Bars
                  </label>
                  <select
                    value={bars}
                    onChange={(e) => setBars(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 font-mono"
                  >
                    <option value={2}>2 Bars</option>
                    <option value={4}>4 Bars (Standard)</option>
                    <option value={8}>8 Bars (Extended)</option>
                    <option value={16}>16 Bars (Full Section)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">
                    Tempo: {bpm} BPM
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={190}
                    step={1}
                    value={bpm}
                    onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none mt-2"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-semibold">
                    Key / Scale
                  </label>
                  <select
                    value={keyScale}
                    onChange={(e) => setKeyScale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 font-mono"
                  >
                    {COMMON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prompt Textarea */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Creative Direction & Musical Prompt
                </label>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    selectedPresetId === 'blank'
                      ? 'Blank Canvas: Describe any musical idea, rhythm, instrumentation, or progression...'
                      : 'Describe your musical ideas, instruments, rhythm, syncopation, and vibe...'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <Square size={14} className="fill-current" />
                    Stop Generation
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <Sparkles size={15} />
                    Generate Composition
                  </button>
                )}
              </div>

              {/* Live Streaming or Result Preview */}
              {(streamingText || extractedCode) && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Generated LMP</span>
                      {compileStatus && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            compileStatus.success
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {compileStatus.success
                            ? `✓ Valid MIDI (${compileStatus.bytes} bytes)`
                            : 'Compilation Warning'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Copy LMP code"
                      >
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <pre className="p-3 text-[11px] font-mono text-amber-200/90 max-h-48 overflow-y-auto leading-relaxed bg-black/40">
                    {extractedCode || streamingText}
                  </pre>

                  {/* Immediate Audition Bar */}
                  {extractedCode && (
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 border-t border-slate-800 gap-2">
                      <button
                        type="button"
                        onClick={() => onApplyLmp(extractedCode, true)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Play size={13} className="fill-current" />
                        Audition & Play in WebAudio
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyLmp(extractedCode, false)}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                      >
                        Insert in Editor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
