import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Sliders,
  Layers,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Check,
  Search,
  Music,
  BookOpen,
} from 'lucide-react';
import {
  soundFontSpecManager,
  type SpecDocument,
  type SoundFontProgramBinding,
} from '../../core/soundfontSpecManager';
import { soundFontEngine, type StoredSoundFontMetadata } from '../../core/soundfontEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'soundfonts' | 'bindings' | 'specs';
  selectedSpecIdForView?: string | null;
}

export function SoundFontManagerModal({
  isOpen,
  onClose,
  initialTab = 'soundfonts',
  selectedSpecIdForView,
}: Props) {
  const [activeTab, setActiveTab] = useState<'soundfonts' | 'bindings' | 'specs'>(initialTab);

  // Specs state
  const [specs, setSpecs] = useState<SpecDocument[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>('');
  const [specSearch, setSpecSearch] = useState<string>('');
  const [specTitle, setSpecTitle] = useState<string>('');
  const [specContent, setSpecContent] = useState<string>('');
  const [isEditingSpec, setIsEditingSpec] = useState<boolean>(false);
  const [specSaveSuccess, setSpecSaveSuccess] = useState<boolean>(false);

  // Bindings state
  const [bindings, setBindings] = useState<SoundFontProgramBinding[]>([]);
  const [bindingSearch, setBindingSearch] = useState<string>('');
  const [editingBinding, setEditingBinding] = useState<SoundFontProgramBinding | null>(null);
  const [isCreatingBinding, setIsCreatingBinding] = useState<boolean>(false);

  // Soundfonts state
  const [storedSf, setStoredSf] = useState<StoredSoundFontMetadata[]>([]);
  const [hasIndian, setHasIndian] = useState<boolean>(false);
  const [hasCarnatic, setHasCarnatic] = useState<boolean>(false);
  const [hasFolk, setHasFolk] = useState<boolean>(false);
  const [activeSourceId, setActiveSourceId] = useState<string>('default-gm');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    refreshData();
    const unsub = soundFontSpecManager.subscribe(() => refreshData());
    const unsubEngine = soundFontEngine.subscribe(() => {
      setActiveSourceId(soundFontEngine.getActiveSourceId());
      setStoredSf(soundFontEngine.getStoredSoundfonts());
    });
    return () => {
      unsub();
      unsubEngine();
    };
  }, [isOpen]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (selectedSpecIdForView) {
      setSelectedSpecId(selectedSpecIdForView);
      const doc = soundFontSpecManager.getSpec(selectedSpecIdForView);
      if (doc) {
        setSpecTitle(doc.title);
        setSpecContent(doc.content);
        setActiveTab('specs');
      }
    }
  }, [selectedSpecIdForView]);

  const refreshData = () => {
    const allSpecs = soundFontSpecManager.getSpecs();
    setSpecs(allSpecs);
    if (!selectedSpecId && allSpecs.length > 0) {
      setSelectedSpecId(allSpecs[0].id);
      setSpecTitle(allSpecs[0].title);
      setSpecContent(allSpecs[0].content);
    } else if (selectedSpecId) {
      const cur = allSpecs.find((s) => s.id === selectedSpecId);
      if (cur) {
        setSpecTitle(cur.title);
        setSpecContent(cur.content);
      }
    }

    setBindings(soundFontSpecManager.getBindings());
    setStoredSf(soundFontEngine.getStoredSoundfonts());
    setHasIndian(soundFontEngine.hasLocalFluidPercussion());
    setHasCarnatic(soundFontEngine.hasLocalCarnaticPercussion());
    setHasFolk(soundFontEngine.hasLocalFolkPercussion());
    setActiveSourceId(soundFontEngine.getActiveSourceId());
  };

  const handleSelectSpec = (spec: SpecDocument) => {
    setSelectedSpecId(spec.id);
    setSpecTitle(spec.title);
    setSpecContent(spec.content);
    setIsEditingSpec(false);
  };

  const handleSaveSpec = () => {
    const cur = specs.find((s) => s.id === selectedSpecId);
    if (!cur) return;
    const updated: SpecDocument = {
      ...cur,
      title: specTitle.trim() || cur.title,
      content: specContent,
      updatedAt: Date.now(),
    };
    soundFontSpecManager.saveSpec(updated);
    setIsEditingSpec(false);
    setSpecSaveSuccess(true);
    setTimeout(() => setSpecSaveSuccess(false), 2000);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const doc = soundFontSpecManager.importMarkdownFile(file.name, content);
        handleSelectSpec(doc);
        setActiveTab('specs');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUploadSoundfont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadSuccess('');
    try {
      const ok = await soundFontEngine.loadAndStoreCustomFile(file);
      if (ok) {
        setUploadSuccess(`Successfully loaded ${file.name}`);
        setTimeout(() => setUploadSuccess(''), 3000);
      } else {
        setUploadError(`Failed to parse ${file.name} as a valid SoundFont2 file.`);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading SoundFont');
    }
    e.target.value = '';
  };

  const handleSaveBinding = (binding: SoundFontProgramBinding) => {
    soundFontSpecManager.saveBinding(binding);
    setEditingBinding(null);
    setIsCreatingBinding(false);
  };

  if (!isOpen) return null;

  const filteredSpecs = specs.filter(
    (s) =>
      s.title.toLowerCase().includes(specSearch.toLowerCase()) ||
      s.fileName.toLowerCase().includes(specSearch.toLowerCase()) ||
      s.instrumentFamily.toLowerCase().includes(specSearch.toLowerCase())
  );

  const filteredBindings = bindings.filter(
    (b) =>
      b.soundfontName.toLowerCase().includes(bindingSearch.toLowerCase()) ||
      b.programRange.toLowerCase().includes(bindingSearch.toLowerCase()) ||
      b.description.toLowerCase().includes(bindingSearch.toLowerCase()) ||
      b.specId.toLowerCase().includes(bindingSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b] bg-[#141e33]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                SoundFont & Instrument Specification Manager
              </h2>
              <p className="text-xs text-slate-400">
                Connect soundfonts, program banks, and instrument markdown specifications for dynamic AI orchestration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-[#1e293b] bg-[#0f172a]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('soundfonts')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'soundfonts'
                  ? 'border-amber-400 text-amber-300 bg-[#1e293b]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Music className="w-4 h-4" />
              SoundFonts Library
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {(hasIndian ? 1 : 0) + (hasCarnatic ? 1 : 0) + (hasFolk ? 1 : 0) + storedSf.length + 1}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bindings')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'bindings'
                  ? 'border-amber-400 text-amber-300 bg-[#1e293b]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Program & Bank Bindings
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {bindings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('specs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'specs'
                  ? 'border-amber-400 text-amber-300 bg-[#1e293b]/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-4 h-4" />
              Markdown Specifications
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {specs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            {activeTab === 'specs' && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors border border-slate-700">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Import Markdown (.md)
                <input
                  type="file"
                  accept=".md,.markdown,.txt"
                  onChange={handleImportMarkdown}
                  className="hidden"
                />
              </label>
            )}

            {activeTab === 'soundfonts' && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload Custom SoundFont (.sf2)
                <input
                  type="file"
                  accept=".sf2,.SF2"
                  onChange={handleUploadSoundfont}
                  className="hidden"
                />
              </label>
            )}

            {activeTab === 'bindings' && (
              <button
                onClick={() => {
                  setEditingBinding({
                    id: 'bind_custom_' + Date.now(),
                    soundfontId: '*',
                    soundfontName: 'Any SoundFont',
                    programRange: '0-127',
                    bank: '*',
                    channel: 10,
                    specId: specs[0]?.id || 'spec_tabla',
                    description: 'Custom Program Binding',
                    isBuiltIn: false,
                  });
                  setIsCreatingBinding(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Program Binding
              </button>
            )}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-hidden p-6">
          {/* TAB 1: SOUNDFONTS */}
          {activeTab === 'soundfonts' && (
            <div className="h-full flex flex-col gap-4 overflow-y-auto pr-1">
              {uploadSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {uploadSuccess}
                </div>
              )}
              {uploadError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default GM Engine */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    activeSourceId === 'default-gm'
                      ? 'bg-slate-800/80 border-amber-400/80 shadow-lg'
                      : 'bg-[#141e33] border-[#1e293b] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Built-in WebAudio Synth
                      </span>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">
                        General MIDI Synthesizer
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Polyphonic multi-oscillator synth with melodic SPN oscillators and filtered noise generator for Channel 10 drums.
                      </p>
                    </div>
                    {activeSourceId === 'default-gm' && (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Bank 0-128 • All GM Patches</span>
                    <button
                      onClick={() => soundFontEngine.selectSource('default-gm')}
                      className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                        activeSourceId === 'default-gm'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {activeSourceId === 'default-gm' ? 'Selected' : 'Use as Default'}
                    </button>
                  </div>
                </div>

                {/* Fluid Indian Percussion */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    activeSourceId === 'fluid-indian'
                      ? 'bg-slate-800/80 border-amber-400/80 shadow-lg'
                      : 'bg-[#141e33] border-[#1e293b] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          SoundFont 2.04 (.sf2)
                        </span>
                        {hasIndian ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Available (Private Subrepo)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            Remote / Not Pulled
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">
                        Fluid Indian Percussion (Tabla Suite)
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Acoustic studio recordings of Bayān and Dayān across 12 chromatic scale tonics (Sa=C..B) and GM Drum Kit preset 116.
                      </p>
                    </div>
                    {activeSourceId === 'fluid-indian' && (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">12.8 MB • Bank 41 • 3-Tier Multi-Velocity</span>
                    <button
                      onClick={() => soundFontEngine.selectSource('fluid-indian')}
                      disabled={!hasIndian}
                      className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                        !hasIndian
                          ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                          : activeSourceId === 'fluid-indian'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {activeSourceId === 'fluid-indian' ? 'Selected' : 'Use as Default'}
                    </button>
                  </div>
                </div>

                {/* Fluid Carnatic Percussion */}
                <div className="p-4 rounded-xl border bg-[#141e33] border-[#1e293b] hover:border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          SoundFont 2.04 (.sf2)
                        </span>
                        {hasCarnatic && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Available on PC
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">
                        Fluid Carnatic Percussion (Mridangam, Pakhawaj, Kanjeera, Ghatam)
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        South Indian concert king Mridangam, ancient Dhrupad Pakhawaj, lizard-skin Kanjeera with gumki pitch glides, and baked clay Ghatam.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">9.0 MB • Banks 42, 44, 45, 46 • Presets 119-122</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Auto-Routed via @SF2</span>
                  </div>
                </div>

                {/* Fluid Folk Percussion */}
                <div className="p-4 rounded-xl border bg-[#141e33] border-[#1e293b] hover:border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          SoundFont 2.04 (.sf2)
                        </span>
                        {hasFolk && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Available on PC
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">
                        Fluid Folk Percussion (Dholak, Khol, Folk Auxiliary)
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Punchy Qawwali Dholak, terracotta Gaudiya Kirtan Khol, Punjabi Dhol, Duff, Tavil, Ghunghroo, and Nagara.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">3.5 MB • Banks 41, 43, 47 • Presets 117, 118, 123</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Auto-Routed via @SF2</span>
                  </div>
                </div>

                {/* User Stored SoundFonts */}
                {storedSf.map((s) => (
                  <div
                    key={s.id}
                    className={`p-4 rounded-xl border transition-all ${
                      activeSourceId === s.id
                        ? 'bg-slate-800/80 border-amber-400/80 shadow-lg'
                        : 'bg-[#141e33] border-[#1e293b] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Custom User SoundFont
                        </span>
                        <h3 className="text-sm font-bold text-slate-100 mt-2">{s.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Stored in your browser IndexedDB • {(s.sizeBytes / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => soundFontEngine.deleteStoredSoundFont(s.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete from storage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Custom Bank / Presets</span>
                      <button
                        onClick={() => soundFontEngine.selectSource(s.id)}
                        className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                          activeSourceId === s.id
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {activeSourceId === s.id ? 'Selected' : 'Use as Default'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PROGRAM BINDINGS */}
          {activeTab === 'bindings' && (
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={bindingSearch}
                    onChange={(e) => setBindingSearch(e.target.value)}
                    placeholder="Search program, bank, or instrument..."
                    className="w-full pl-9 pr-3 py-1.5 bg-[#141e33] border border-[#1e293b] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  onClick={() => soundFontSpecManager.resetBindingsToDefault()}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/60"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </button>
              </div>

              {/* Binding Edit / Create Modal Inline Card */}
              {editingBinding && (
                <div className="p-4 bg-[#141e33] border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    {isCreatingBinding ? 'Create New Program Binding' : 'Edit Program Binding'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">SoundFont Name / Pattern</label>
                      <input
                        type="text"
                        value={editingBinding.soundfontName}
                        onChange={(e) =>
                          setEditingBinding({
                            ...editingBinding,
                            soundfontName: e.target.value,
                            soundfontId: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                          })
                        }
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Program / Preset Range</label>
                      <input
                        type="text"
                        value={editingBinding.programRange}
                        onChange={(e) =>
                          setEditingBinding({ ...editingBinding, programRange: e.target.value })
                        }
                        placeholder="e.g. 117 or 0-11 or *"
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Bank MSB (optional)</label>
                      <input
                        type="text"
                        value={editingBinding.bank ?? '*'}
                        onChange={(e) =>
                          setEditingBinding({ ...editingBinding, bank: e.target.value })
                        }
                        placeholder="e.g. 41 or *"
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Linked Spec Markdown</label>
                      <select
                        value={editingBinding.specId}
                        onChange={(e) =>
                          setEditingBinding({ ...editingBinding, specId: e.target.value })
                        }
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-slate-200"
                      >
                        {specs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ({s.fileName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs block mb-1">Description / Notes</label>
                    <input
                      type="text"
                      value={editingBinding.description}
                      onChange={(e) =>
                        setEditingBinding({ ...editingBinding, description: e.target.value })
                      }
                      className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-xs text-slate-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setEditingBinding(null);
                        setIsCreatingBinding(false);
                      }}
                      className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveBinding(editingBinding)}
                      className="px-4 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-xs"
                    >
                      Save Binding
                    </button>
                  </div>
                </div>
              )}

              {/* Bindings Table */}
              <div className="flex-1 overflow-auto border border-[#1e293b] rounded-xl bg-[#141e33]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f172a] border-b border-[#1e293b] text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">SoundFont / Kit</th>
                      <th className="py-2.5 px-3">Program Range</th>
                      <th className="py-2.5 px-3">Bank</th>
                      <th className="py-2.5 px-3">Linked Spec Markdown</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {filteredBindings.map((b) => {
                      const linkedSpec = specs.find((s) => s.id === b.specId);
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {b.soundfontName}
                          </td>
                          <td className="py-2 px-3 font-mono text-amber-300 font-bold">
                            {b.programRange}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{b.bank ?? '*'}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => {
                                setSelectedSpecId(b.specId);
                                setActiveTab('specs');
                              }}
                              className="text-amber-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {linkedSpec ? linkedSpec.fileName : b.specId}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-slate-400 truncate max-w-xs">
                            {b.description}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingBinding(b);
                                  setIsCreatingBinding(false);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-700"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => soundFontSpecManager.deleteBinding(b.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MARKDOWN SPECIFICATIONS */}
          {activeTab === 'specs' && (
            <div className="h-full flex gap-4 overflow-hidden">
              {/* Left sidebar: Spec List */}
              <div className="w-72 flex flex-col gap-2 border-r border-[#1e293b] pr-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)}
                    placeholder="Search specifications..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-[#141e33] border border-[#1e293b] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {filteredSpecs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSpec(s)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors border ${
                        selectedSpecId === s.id
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 font-semibold'
                          : 'bg-[#141e33]/60 border-transparent hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold truncate">{s.title}</span>
                        {s.isBuiltIn && (
                          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span className="truncate">{s.fileName}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => soundFontSpecManager.resetSpecsToDefault()}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 py-1.5 rounded-lg border border-slate-700/60 hover:bg-slate-800"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Specs to Built-in
                </button>
              </div>

              {/* Right area: Spec Viewer / Editor */}
              <div className="flex-1 flex flex-col h-full bg-[#141e33] border border-[#1e293b] rounded-xl overflow-hidden">
                {/* Spec Toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e293b] bg-[#0f172a]">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    {isEditingSpec ? (
                      <input
                        type="text"
                        value={specTitle}
                        onChange={(e) => setSpecTitle(e.target.value)}
                        className="bg-[#141e33] border border-slate-700 rounded px-2 py-0.5 text-xs font-bold text-amber-300"
                      />
                    ) : (
                      <h3 className="text-xs font-bold text-slate-200">{specTitle}</h3>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      (
                      {specs.find((s) => s.id === selectedSpecId)?.fileName ||
                        'spec.md'}
                      )
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {specSaveSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved!
                      </span>
                    )}

                    {isEditingSpec ? (
                      <>
                        <button
                          onClick={() => {
                            const cur = specs.find((s) => s.id === selectedSpecId);
                            if (cur) {
                              setSpecTitle(cur.title);
                              setSpecContent(cur.content);
                            }
                            setIsEditingSpec(false);
                          }}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveSpec}
                          className="flex items-center gap-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-xs transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Spec
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingSpec(true)}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors border border-slate-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Markdown
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Editor / Viewer */}
                <div className="flex-1 p-4 overflow-auto">
                  {isEditingSpec ? (
                    <textarea
                      value={specContent}
                      onChange={(e) => setSpecContent(e.target.value)}
                      className="w-full h-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                    />
                  ) : (
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                      {specContent || 'No content.'}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
