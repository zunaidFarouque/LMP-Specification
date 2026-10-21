import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Volume2,
  Sliders,
  Music2,
  Trash2,
  Layers,
  Upload,
  Check,
  X,
  Disc,
} from 'lucide-react';
import type { StudioTrack } from '../../core/types';
import {
  type DrumMapEntry,
  parseDrumMapText,
} from '../../core/sourceMapBridge';
import { soundFontEngine, FLUID_INDIAN_PERCUSSION_MAP_TEXT } from '../../core/soundfontEngine';

interface Props {
  tracks: StudioTrack[];
  activeTrackId: number;
  hoveredTrackId?: number | null;
  onSelectActiveTrack: (trackId: number) => void;
  onTrackUpdate: (trackId: number, updates: Partial<StudioTrack>) => void;
  onAddTrack: (template: { name: string; channel: number; program: number }) => void;
  onDeleteTrack?: (trackId: number) => void;
  getTrackDrumMaps?: (trackId: number) => DrumMapEntry[];
  onApplyDrumMap?: (trackId: number, maps: DrumMapEntry[]) => void;
}

export const DRUM_MAP_PRESETS = [
  {
    name: '⚡ Fluid Indian Percussion (Tabla Map - SF2)',
    content: FLUID_INDIAN_PERCUSSION_MAP_TEXT,
  },
  {
    name: '🥁 Dholak Studio Map (Folk & Qawwali - SF2)',
    content: `@MAP Dhum=36\n@MAP ClsGe=37\n@MAP Ka=38\n@MAP Meend=39\n@MAP FngKe=40\n@MAP LdGe=43\n@MAP Ta=48\n@MAP Tin=50\n@MAP Chhit=52\n@MAP Re=54\n@MAP Thap=57\n@MAP Kre=58\n@MAP Dha=60\n@MAP Dhin=62\n@MAP Tirkita=64\n@MAP TaDhin=65`,
  },
  {
    name: '🪘 Khol Suite Map (Bengal Kirtan - SF2)',
    content: `@MAP Ghet=36\n@MAP ClsGhet=37\n@MAP Ke=38\n@MAP SldGhet=39\n@MAP Prsd1=41\n@MAP Prsd2=42\n@MAP Prsd3=43\n@MAP Ta=48\n@MAP SftTa=49\n@MAP Tini=50\n@MAP Jhi=52\n@MAP Krena=58\n@MAP Dha=60\n@MAP Dhe=61\n@MAP Dhin=62`,
  },
  {
    name: '🥁 Mridangam Suite Map (Carnatic King - SF2)',
    content: `@MAP Dheem=36\n@MAP ClsThoppi=37\n@MAP Ka=38\n@MAP Gumki=39\n@MAP LdThoppi=43\n@MAP Nam=48\n@MAP Kin=48\n@MAP Chapu=50\n@MAP Araichapu=51\n@MAP Tha=52\n@MAP Tarikita=58\n@MAP Dhom=60\n@MAP Dhin=62\n@MAP Klam=64`,
  },
  {
    name: '🪘 Pakhawaj Suite Map (Ancient Dhrupad - SF2)',
    content: `@MAP Dhumma=36\n@MAP ClsDhum=37\n@MAP Kat=38\n@MAP SldDhum=39\n@MAP OpnKe=40\n@MAP SftKe=42\n@MAP Ta=48\n@MAP Din=50\n@MAP Sur=50\n@MAP Tit=52\n@MAP Chhapa=57\n@MAP DhetDhet=58\n@MAP Dha=60\n@MAP Dhin=62\n@MAP KatDha=63`,
  },
  {
    name: '🔔 Indian Folk & Auxiliary Map (SF2)',
    content: `@MAP Manjeera=69\n@MAP ManjeeraOpen=70\n@MAP Chimta=71\n@MAP Ghunghroo=74\n@MAP GhunghrooRoll=75\n@MAP Khartaal=76\n@MAP KhartaalTrill=77\n@MAP NagaraBass=78\n@MAP NagaraTreble=79\n@MAP Duff=60\n@MAP Tavil=64`,
  },
  {
    name: 'General MIDI Standard Kit (Ch 10)',
    content: `@MAP kick=36\n@MAP side_stick=37\n@MAP snare=38\n@MAP clap=39\n@MAP snare_elec=40\n@MAP low_floor_tom=41\n@MAP closed_hh=42\n@MAP high_floor_tom=43\n@MAP pedal_hh=44\n@MAP low_tom=45\n@MAP open_hh=46\n@MAP mid_tom=47\n@MAP high_tom=48\n@MAP crash_1=49\n@MAP ride_1=51\n@MAP china=52\n@MAP ride_bell=53\n@MAP tambourine=54\n@MAP splash=55\n@MAP cowbell=56\n@MAP crash_2=57`,
  },
  {
    name: 'Trap & Hip-Hop 808 Kit',
    content: `@MAP sub_kick=36\n@MAP hard_kick=35\n@MAP snare=38\n@MAP clap=39\n@MAP rim=37\n@MAP closed_hat=42\n@MAP open_hat=46\n@MAP pedal_hat=44\n@MAP low_808_tom=41\n@MAP mid_808_tom=45\n@MAP high_808_tom=48\n@MAP crash=49\n@MAP shaker=70\n@MAP cowbell=56`,
  },
  {
    name: 'Soundiron Indian Tablas',
    content: `@MAP ge_open=36\n@MAP ge_slide_up=38\n@MAP ge_slide_fast_up=40\n@MAP ge_slide_down=43\n@MAP ge_slide_high_up=45\n@MAP ka_closed_1=24\n@MAP ka_closed_2=26\n@MAP ka_closed_3=28\n@MAP ne_kinar=50\n@MAP tin_kinar=52\n@MAP tin_sur=55\n@MAP tu_resonant=57\n@MAP tun_bell=59\n@MAP te_center_1=71\n@MAP te_center_2=74\n@MAP tete_dry=95\n@MAP dha_open_1=84\n@MAP dha_open_2=91\n@MAP dhin_resonant=88`,
  },
  {
    name: 'Acoustic Rock Drum Kit',
    content: `@MAP kick=36\n@MAP snare=38\n@MAP side_stick=37\n@MAP closed_hat=42\n@MAP open_hat=46\n@MAP floor_tom=43\n@MAP rack_tom=47\n@MAP crash=49\n@MAP ride=51`,
  },
];

export const INSTRUMENT_PRESETS = [
  { name: 'Acoustic Grand Piano', program: 0, channel: 1, soundfont: 'default-gm' },
  { name: 'Bright Acoustic Piano', program: 1, channel: 1, soundfont: 'default-gm' },
  { name: 'Electric Rhodes', program: 4, channel: 2, soundfont: 'default-gm' },
  { name: 'Harpsichord', program: 6, channel: 2, soundfont: 'default-gm' },
  { name: 'Drawbar Organ', program: 16, channel: 3, soundfont: 'default-gm' },
  { name: 'Acoustic Guitar', program: 24, channel: 3, soundfont: 'default-gm' },
  { name: 'Electric Clean Guitar', program: 27, channel: 3, soundfont: 'default-gm' },
  { name: 'Slap Bass', program: 36, channel: 4, soundfont: 'default-gm' },
  { name: 'Synth Bass', program: 38, channel: 4, soundfont: 'default-gm' },
  { name: 'Strings Pad', program: 48, channel: 5, soundfont: 'default-gm' },
  { name: 'Synth Strings', program: 50, channel: 5, soundfont: 'default-gm' },
  { name: 'Trumpet', program: 56, channel: 6, soundfont: 'default-gm' },
  { name: 'Brass Section', program: 61, channel: 6, soundfont: 'default-gm' },
  { name: 'Soprano Sax', program: 64, channel: 7, soundfont: 'default-gm' },
  { name: 'Flute', program: 73, channel: 7, soundfont: 'default-gm' },
  { name: 'Lead Synth', program: 80, channel: 8, soundfont: 'default-gm' },
  { name: 'Warm Pad', program: 89, channel: 9, soundfont: 'default-gm' },
  { name: 'Channel 10 Drums (GM)', program: 0, channel: 10, soundfont: 'default-gm' },
  { name: 'Fluid Indian Percussion (Tabla SF2)', program: 116, channel: 10, soundfont: 'Fluid_Indian_Percussion' },
  { name: 'Fluid Dholak Studio (SF2)', program: 117, channel: 10, soundfont: 'Fluid_Folk_Percussion' },
  { name: 'Fluid Khol Suite (SF2)', program: 118, channel: 10, soundfont: 'Fluid_Folk_Percussion' },
  { name: 'Fluid Mridangam Suite (SF2)', program: 120, channel: 10, soundfont: 'Fluid_Carnatic_Percussion' },
  { name: 'Fluid Pakhawaj Suite (SF2)', program: 119, channel: 10, soundfont: 'Fluid_Carnatic_Percussion' },
  { name: 'Fluid Kanjeera Suite (SF2)', program: 121, channel: 10, soundfont: 'Fluid_Carnatic_Percussion' },
  { name: 'Fluid Ghatam Suite (SF2)', program: 122, channel: 10, soundfont: 'Fluid_Carnatic_Percussion' },
  { name: 'Fluid Folk & Auxiliary (SF2)', program: 123, channel: 10, soundfont: 'Fluid_Folk_Percussion' },
];

export function TrackMixer({
  tracks,
  activeTrackId,
  hoveredTrackId = null,
  onSelectActiveTrack,
  onTrackUpdate,
  onAddTrack,
  onDeleteTrack,
  getTrackDrumMaps,
  onApplyDrumMap,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [drumMapTrack, setDrumMapTrack] = useState<StudioTrack | null>(null);
  const [drumMapText, setDrumMapText] = useState<string>('');
  const [activeSourceId, setActiveSourceId] = useState<string>(soundFontEngine.getActiveSourceId());
  const [hasLocalFluid, setHasLocalFluid] = useState<boolean>(soundFontEngine.hasLocalFluidPercussion());
  const [storedSoundfonts, setStoredSoundfonts] = useState(soundFontEngine.getStoredSoundfonts());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize soundfont engine (checks local fluid percussion & stored soundfonts)
    soundFontEngine.init().then(() => {
      setActiveSourceId(soundFontEngine.getActiveSourceId());
      setHasLocalFluid(soundFontEngine.hasLocalFluidPercussion());
      setStoredSoundfonts(soundFontEngine.getStoredSoundfonts());
    });

    const unsub = soundFontEngine.subscribe(() => {
      setActiveSourceId(soundFontEngine.getActiveSourceId());
      setHasLocalFluid(soundFontEngine.hasLocalFluidPercussion());
      setStoredSoundfonts(soundFontEngine.getStoredSoundfonts());
    });
    return unsub;
  }, []);

  const handleSourceChange = async (val: string) => {
    if (val === '__load_new__') {
      sfInputRef.current?.click();
      return;
    }
    await soundFontEngine.selectSource(val);
  };

  const handleSfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await soundFontEngine.loadAndStoreCustomFile(file);
    // Reset file input so same file can be re-selected if desired
    if (e.target) e.target.value = '';
  };

  const handleDeleteCustomSoundFont = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Remove this stored SoundFont from your browser storage?')) {
      await soundFontEngine.deleteStoredSoundFont(id);
    }
  };

  const handleOpenDrumMap = (trk: StudioTrack) => {
    setDrumMapTrack(trk);
    const existing = getTrackDrumMaps ? getTrackDrumMaps(trk.id) : [];
    if (existing && existing.length > 0) {
      setDrumMapText(existing.map((m) => `@MAP ${m.name}=${m.midi}`).join('\n'));
    } else if (trk.channel === 10) {
      setDrumMapText(DRUM_MAP_PRESETS[0].content);
    } else {
      setDrumMapText('');
    }
  };

  const handleSelectPreset = (content: string) => {
    setDrumMapText(content);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        const parsed = parseDrumMapText(content);
        if (parsed.length > 0) {
          setDrumMapText(parsed.map((m) => `@MAP ${m.name}=${m.midi}`).join('\n'));
        } else {
          setDrumMapText(content);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleApplyDrumMap = () => {
    if (!drumMapTrack || !onApplyDrumMap) return;
    const parsed = parseDrumMapText(drumMapText);
    onApplyDrumMap(drumMapTrack.id, parsed);
    setDrumMapTrack(null);
  };

  const handleClearDrumMap = () => {
    if (!drumMapTrack || !onApplyDrumMap) return;
    onApplyDrumMap(drumMapTrack.id, []);
    setDrumMapTrack(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1420] border-r border-[#1e2738] select-none text-slate-200">
      {/* Arranger / Mixer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2738] bg-[#131926]">
        <div className="flex items-center gap-2">
          <Sliders size={13} className="text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Tracks & Mixer</span>
          <span className="text-[10px] font-mono text-slate-400">({tracks.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          title="Add New Track"
        >
          <Plus size={12} />
          <span>Track</span>
        </button>
      </div>

      {/* SoundFont / Audio Engine Selector Bar */}
      <div className="px-3 py-2 bg-[#0b0f17] border-b border-[#1e2738] flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Disc
              size={12}
              className={activeSourceId !== 'default-gm' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}
            />
            <span>SoundFont (.sf2)</span>
          </div>
          {activeSourceId.startsWith('sf_') && (
            <button
              type="button"
              onClick={(e) => handleDeleteCustomSoundFont(activeSourceId, e)}
              className="text-[10px] text-slate-500 hover:text-red-400 font-mono transition-colors"
              title="Delete this stored custom .sf2"
            >
              Delete .sf2
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={activeSourceId}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="flex-1 bg-[#131926] border border-[#222c3f] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400 font-medium truncate cursor-pointer"
          >
            {/* Always available Default GM */}
            <option value="default-gm">🎹 General MIDI Synth (Default)</option>

            {/* Only available on user's PC */}
            {hasLocalFluid && (
              <option value="fluid-indian">🥁 Fluid Indian Percussion (.sf2)</option>
            )}

            {/* Previously stored custom soundfonts from IndexedDB */}
            {storedSoundfonts.length > 0 && (
              <optgroup label="Saved SoundFonts">
                {storedSoundfonts.map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    📦 {sf.name} ({(sf.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                  </option>
                ))}
              </optgroup>
            )}

            {/* Action to load new .sf2 */}
            <option value="__load_new__">➕ Load custom .sf2 file...</option>
          </select>

          <input
            ref={sfInputRef}
            type="file"
            accept=".sf2"
            onChange={handleSfUpload}
            className="hidden"
          />
        </div>

        {activeSourceId === 'fluid-indian' && (
          <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Fluid Indian Percussion (PC Local) Active</span>
          </div>
        )}
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1e2738]">
        {tracks.map((track) => {
          const isActive = track.id === activeTrackId;
          const isHoveredTrack = hoveredTrackId === track.id && !isActive;

          return (
            <div
              key={track.id}
              onClick={() => onSelectActiveTrack(track.id)}
              className={`p-2.5 flex flex-col gap-2 cursor-pointer transition-all border-l-4 ${
                isActive
                  ? 'bg-[#182030] border-amber-500 shadow-inner'
                  : isHoveredTrack
                  ? 'bg-[#182030] border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                  : 'bg-[#111724]/70 border-transparent hover:bg-[#151c2c]'
              }`}
            >
              {/* Track Info Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: track.color }}
                  />
                  <input
                    type="text"
                    value={track.name}
                    onChange={(e) => onTrackUpdate(track.id, { name: e.target.value })}
                    className="bg-transparent font-semibold text-xs text-slate-100 focus:outline-none focus:bg-[#0c1017] rounded px-1 max-w-[130px] truncate"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {/* Channel Badge */}
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      track.channel === 10
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                    title={`MIDI Channel ${track.channel}`}
                  >
                    Ch {track.channel}
                  </span>

                  {/* Drum Map / @MAP Manager Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDrumMap(track);
                    }}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
                      track.channel === 10
                        ? 'bg-amber-500/25 text-amber-300 hover:bg-amber-500/40 border border-amber-500/40 font-bold shadow-xs'
                        : 'bg-[#1e2738] text-slate-400 hover:text-slate-200 hover:bg-[#253247]'
                    }`}
                    title="Manage Drum Map & Custom Note Aliases (@MAP)"
                  >
                    <Layers size={10} />
                    <span>@MAP</span>
                  </button>

                  {onDeleteTrack && tracks.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrack(track.id);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-[#25181c] transition-colors"
                      title="Remove Track"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Instrument & Controls Row */}
              <div className="flex items-center justify-between gap-2 text-xs">
                {/* Instrument Dropdown */}
                <select
                  value={
                    track.soundfont && /fluid/i.test(String(track.soundfont))
                      ? `sf_${track.program}`
                      : track.channel === 10
                      ? 'drums'
                      : track.program
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'sf_116') {
                      onTrackUpdate(track.id, {
                        channel: 10,
                        program: 116,
                        soundfont: 'Fluid_Indian_Percussion',
                        name: 'Tabla_Percussion',
                      });
                    } else if (val === 'sf_117') {
                      onTrackUpdate(track.id, {
                        channel: 10,
                        program: 117,
                        soundfont: 'Fluid_Indian_Percussion',
                        name: 'Dholak_Studio',
                      });
                    } else if (val === 'drums') {
                      const newName =
                        track.name.toLowerCase().startsWith('track') ||
                        track.name === 'Rhodes_Chords' ||
                        track.name === 'Slap_Bass'
                          ? 'Drums'
                          : track.name;
                      onTrackUpdate(track.id, {
                        channel: 10,
                        program: 0,
                        soundfont: null,
                        name: newName,
                      });
                    } else {
                      const prg = Number(val);
                      const preset = INSTRUMENT_PRESETS.find((p) => p.program === prg && p.channel !== 10);
                      const targetChannel = track.channel === 10 ? 1 : track.channel;
                      const newName =
                        preset && (track.name.toLowerCase().startsWith('track') || track.name === 'Drums' || track.name.includes('Tabla'))
                          ? preset.name.replace(/\s+/g, '_')
                          : track.name;
                      onTrackUpdate(track.id, {
                        program: prg,
                        channel: targetChannel,
                        soundfont: null,
                        name: newName,
                      });
                    }
                  }}
                  className="bg-[#0b0e14] border border-[#222c3f] rounded px-1.5 py-1 text-[11px] text-slate-300 max-w-[125px] truncate focus:outline-none focus:border-amber-500"
                >
                  {INSTRUMENT_PRESETS.map((inst, idx) => (
                    <option
                      key={idx}
                      value={
                        inst.soundfont === 'Fluid_Indian_Percussion'
                          ? `sf_${inst.program}`
                          : inst.channel === 10
                          ? 'drums'
                          : inst.program
                      }
                    >
                      {inst.name}
                    </option>
                  ))}
                </select>

                {/* Mute & Solo Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackUpdate(track.id, { isMuted: !track.isMuted });
                    }}
                    className={`w-5 h-5 rounded text-[10px] font-bold font-mono flex items-center justify-center transition-colors ${
                      track.isMuted
                        ? 'bg-red-500 text-white font-extrabold shadow-sm'
                        : 'bg-[#1e2738] text-slate-400 hover:text-slate-200'
                    }`}
                    title="Mute Track"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackUpdate(track.id, { isSolo: !track.isSolo });
                    }}
                    className={`w-5 h-5 rounded text-[10px] font-bold font-mono flex items-center justify-center transition-colors ${
                      track.isSolo
                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm'
                        : 'bg-[#1e2738] text-slate-400 hover:text-slate-200'
                    }`}
                    title="Solo Track"
                  >
                    S
                  </button>
                </div>
              </div>

              {/* Fader & Pan Slider Row */}
              <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5 flex-1">
                  <Volume2 size={11} className="text-slate-400" />
                  <input
                    type="range"
                    min={0}
                    max={127}
                    value={track.volume}
                    onChange={(e) => onTrackUpdate(track.id, { volume: Number(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer h-1 bg-[#253247] rounded-lg appearance-none"
                    title={`Volume: ${track.volume} (CC 7)`}
                  />
                  <span className="w-5 text-right tabular-nums">{track.volume}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span>Pan</span>
                  <input
                    type="range"
                    min={0}
                    max={127}
                    value={track.pan}
                    onChange={(e) => onTrackUpdate(track.id, { pan: Number(e.target.value) })}
                    className="w-12 accent-amber-500 cursor-pointer h-1 bg-[#253247] rounded-lg appearance-none"
                    title={`Pan: ${track.pan} (CC 10)`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Track Modal */}
      {showAddModal && (
        <div className="p-3 bg-[#131926] border-t border-[#1e2738] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span>Add Instrument Track</span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {INSTRUMENT_PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onAddTrack(p);
                  setShowAddModal(false);
                }}
                className="p-1.5 rounded bg-[#1c2436] hover:bg-[#253247] text-left text-[11px] font-medium text-slate-300 truncate transition-colors flex items-center gap-1.5"
              >
                <Music2 size={11} className="text-amber-400 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drum Map & Custom @MAP Manager Modal */}
      {drumMapTrack && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#101522] border border-[#222c3f] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2738] bg-[#141b2b]">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-100">
                    Drum Map & Custom Aliases — {drumMapTrack.name}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    Map custom note names (e.g. kick=36) directly into LMP track code
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrumMapTrack(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-[#1e2738] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Preset & Import Action Row */}
            <div className="p-3 bg-[#0d121c] border-b border-[#1e2738] flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0">Preset:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleSelectPreset(e.target.value);
                  }}
                  defaultValue=""
                  className="bg-[#141b27] border border-[#222c3f] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400 w-full truncate cursor-pointer"
                >
                  <option value="" disabled>Select Drum Map Preset...</option>
                  {DRUM_MAP_PRESETS.map((p, idx) => (
                    <option key={idx} value={p.content}>{p.name}</option>
                  ))}
                </select>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".drm,.txt,.lmp,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1e2738] hover:bg-[#253247] text-slate-200 text-xs font-semibold shrink-0 transition-colors"
                title="Import from Cubase .drm, .txt, or LMP file"
              >
                <Upload size={12} />
                <span>Import File</span>
              </button>
            </div>

            {/* Textarea for Plain Text / Editing */}
            <div className="p-3 flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Edit Mappings (plain text: name=midi or @MAP name=midi):</span>
                <span className="text-amber-400 font-semibold">
                  {parseDrumMapText(drumMapText).length} aliases detected
                </span>
              </div>
              <textarea
                value={drumMapText}
                onChange={(e) => setDrumMapText(e.target.value)}
                placeholder={`// Paste or type drum mappings here:\nkick = 36\nsnare = 38\nclosed_hh = 42\nopen_hh = 46`}
                className="w-full flex-1 min-h-[160px] bg-[#090c12] border border-[#1e2738] rounded-lg p-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
              />

              {/* Alias tags preview */}
              <div className="max-h-20 overflow-y-auto flex flex-wrap gap-1 p-1 bg-[#090c12]/50 rounded border border-[#1e2738]/50">
                {parseDrumMapText(drumMapText).map((item, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono"
                  >
                    {item.name} <span className="text-slate-400">({item.midi})</span>
                  </span>
                ))}
                {parseDrumMapText(drumMapText).length === 0 && (
                  <span className="text-[10px] font-mono text-slate-500 italic p-1">
                    No aliases mapped yet. Choose a preset or type your map above.
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2738] bg-[#141b2b]">
              <button
                type="button"
                onClick={handleClearDrumMap}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors font-mono"
              >
                Clear Map
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrumMapTrack(null)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:bg-[#1e2738] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyDrumMap}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
                >
                  <Check size={13} />
                  <span>Apply Map to Track</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
