import builtinSpecsJson from './builtinSpecsData.json';
import type { StudioTrack } from './types';

export interface SpecDocument {
  id: string;
  title: string;
  fileName: string;
  instrumentFamily: string;
  content: string;
  isBuiltIn: boolean;
  updatedAt: number;
}

export interface SoundFontProgramBinding {
  id: string;
  soundfontId: string; // e.g. 'Fluid_Indian_Percussion', 'Fluid_Folk_Percussion', 'Fluid_Carnatic_Percussion', 'default-gm', '*'
  soundfontName: string;
  programRange: string; // e.g. '116', '117', '118', '0-11', '120-122', '*'
  bank?: number | string; // e.g. 41, 42, 43, 44, 45, 46, 47, 128, '*'
  channel?: number; // e.g. 10 or undefined
  specId: string; // ID of the linked SpecDocument
  description: string;
  isBuiltIn: boolean;
}

const GM_DRUMS_DEFAULT_SPEC = `# General MIDI & 808 Drums Specification
==============================================
## Standard Channel 10 Drum Map & Trap / Electronic Percussion
**Standard Channel:** Channel 10  
**Programs:** Standard GM Drum Kits (Acoustic, Room, Power, Electronic, TR-808, Jazz, Brush)  

---

## 1. Core General MIDI Percussion Map (MIDI Notes 35 - 81)
| MIDI | Instrument | Alias | Role |
|:---:|---|---|---|
| **35** | Acoustic Bass Drum | \`acoustic_kick\` | Deep acoustic downbeat |
| **36** | Bass Drum 1 (Standard Kick) | \`kick\`, \`bd\` | Primary punchy kick |
| **37** | Side Stick / Rimshot | \`rim\`, \`sidestick\` | Wooden rim contact |
| **38** | Acoustic Snare | \`snare\`, \`sd\` | Full acoustic backbeat |
| **39** | Hand Clap | \`clap\` | Group handclap / backbeat layer |
| **40** | Electric Snare | \`elec_snare\` | Compressed electronic pop |
| **41** | Low Floor Tom | \`low_floor_tom\` | Low resonant tom |
| **42** | Closed Hi-Hat | \`closed_hh\`, \`closedhat\`, \`ch\` | Steady 8th/16th pulse |
| **44** | Pedal Hi-Hat | \`pedal_hh\`, \`pedalhat\` | Foot splash / chick |
| **46** | Open Hi-Hat | \`open_hh\`, \`openhat\`, \`oh\` | Ringing off-beat hat |
| **49** | Crash Cymbal 1 | \`crash\` | Dynamic measure downbeat |
| **51** | Ride Cymbal 1 | \`ride\` | Smooth legato groove pulse |
| **54** | Tambourine | \`tambourine\` | Handheld shake/accent |
| **56** | Cowbell | \`cowbell\` | Syncopated Latin/funk bell |
| **70** | Maracas / Shaker | \`shaker\` | High-frequency subdivision |

---

## 2. TR-808 Electronic Kit Mapping
| MIDI | Instrument | Typical Alias | Application |
|:---:|---|---|---|
| **35** | Sub-Bass 808 Kick | \`sub_kick\` | Tuned deep bass decay |
| **36** | Punchy 808 Kick | \`kick\` | Immediate transient punch |
| **38** | 808 Snare | \`snare\` | Snappy noise burst |
| **39** | 808 Clap | \`clap\` | Stereo gated handclap |
| **42** | 808 Closed Hat | \`closed_hat\` | Rapid trap hi-hat rolls |
| **46** | 808 Open Hat | \`open_hat\` | Sizzle and syncopation |
`;

export const BUILTIN_SPECS: SpecDocument[] = [
  {
    id: 'spec_tabla',
    title: 'Tabla Suite (Bayān & Dayān)',
    fileName: 'readme_Fluid_Indian_Percussion.md',
    instrumentFamily: 'Hindustani Classical',
    content: (builtinSpecsJson as Record<string, string>)['readme_Fluid_Indian_Percussion.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_dholak',
    title: 'Dholak Studio (Folk & Qawwali)',
    fileName: 'readme_Dholak.md',
    instrumentFamily: 'Indian Folk & Popular',
    content: (builtinSpecsJson as Record<string, string>)['readme_Dholak.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_khol',
    title: 'Khol / Mridanga (Bengal Kirtan)',
    fileName: 'readme_Khol.md',
    instrumentFamily: 'Bengali Devotional & Folk',
    content: (builtinSpecsJson as Record<string, string>)['readme_Khol.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_mridangam',
    title: 'Mridangam Suite (Carnatic King)',
    fileName: 'readme_Mridangam.md',
    instrumentFamily: 'Carnatic Classical',
    content: (builtinSpecsJson as Record<string, string>)['readme_Mridangam.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_pakhawaj',
    title: 'Pakhawaj Suite (Ancient Dhrupad)',
    fileName: 'readme_Pakhawaj.md',
    instrumentFamily: 'Ancient Classical & Dhrupad',
    content: (builtinSpecsJson as Record<string, string>)['readme_Pakhawaj.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_kanjeera_ghatam',
    title: 'Kanjeera & Ghatam (Carnatic Upapakkavadyam)',
    fileName: 'readme_Kanjeera_Ghatam.md',
    instrumentFamily: 'Carnatic Secondary Ensemble',
    content: (builtinSpecsJson as Record<string, string>)['readme_Kanjeera_Ghatam.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_folk_auxiliary',
    title: 'Indian Folk & Auxiliary (Duff, Tavil, Bells, Cymbals)',
    fileName: 'readme_Folk_Auxiliary.md',
    instrumentFamily: 'Regional Folk & Idiophones',
    content: (builtinSpecsJson as Record<string, string>)['readme_Folk_Auxiliary.md'] || '',
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
  {
    id: 'spec_gm_drums',
    title: 'General MIDI & 808 Drums',
    fileName: 'readme_GM_Drums.md',
    instrumentFamily: 'Western / Electronic',
    content: GM_DRUMS_DEFAULT_SPEC,
    isBuiltIn: true,
    updatedAt: Date.now(),
  },
];

export const BUILTIN_BINDINGS: SoundFontProgramBinding[] = [
  // Tabla Suite: Fluid_Indian_Percussion, Program 116 or 0-11 (Sa=C..B) on Bank 41 or GM Bank 128
  {
    id: 'bind_tabla_main',
    soundfontId: 'Fluid_Indian_Percussion',
    soundfontName: 'Fluid Indian Percussion',
    programRange: '116, 0-11',
    bank: '*',
    channel: 10,
    specId: 'spec_tabla',
    description: 'Tabla Suite (Dayan & Bayan) with all classical bols and meends',
    isBuiltIn: true,
  },
  // Dholak Suite: Fluid_Folk_Percussion, Program 117
  {
    id: 'bind_dholak',
    soundfontId: 'Fluid_Folk_Percussion',
    soundfontName: 'Fluid Folk Percussion',
    programRange: '117',
    bank: '*',
    channel: 10,
    specId: 'spec_dholak',
    description: 'Dholak Studio (Qawwali, Ghazal, Folk Dhumma & Chhati)',
    isBuiltIn: true,
  },
  // Khol Suite: Fluid_Folk_Percussion, Program 118 or 0-11 (Bank 43)
  {
    id: 'bind_khol',
    soundfontId: 'Fluid_Folk_Percussion',
    soundfontName: 'Fluid Folk Percussion',
    programRange: '118, 0-11',
    bank: '43',
    channel: 10,
    specId: 'spec_khol',
    description: 'Bengal Kirtan & Baul Terracotta Khol (Ghet & Tini)',
    isBuiltIn: true,
  },
  // Folk & Auxiliary: Fluid_Folk_Percussion, Program 123 (Bank 47)
  {
    id: 'bind_folk_aux',
    soundfontId: 'Fluid_Folk_Percussion',
    soundfontName: 'Fluid Folk Percussion',
    programRange: '123',
    bank: '47',
    channel: 10,
    specId: 'spec_folk_auxiliary',
    description: 'Regional Folk, Chimta, Manjeera, Ghunghroo, Nagara',
    isBuiltIn: true,
  },
  // Mridangam Suite: Fluid_Carnatic_Percussion, Program 120 or 0-11 (Bank 42)
  {
    id: 'bind_mridangam',
    soundfontId: 'Fluid_Carnatic_Percussion',
    soundfontName: 'Fluid Carnatic Percussion',
    programRange: '120, 0-11',
    bank: '42',
    channel: 10,
    specId: 'spec_mridangam',
    description: 'Carnatic King of Percussion (Chapu, Dheem, Gumki)',
    isBuiltIn: true,
  },
  // Pakhawaj Suite: Fluid_Carnatic_Percussion, Program 119 or 0-11 (Bank 44)
  {
    id: 'bind_pakhawaj',
    soundfontId: 'Fluid_Carnatic_Percussion',
    soundfontName: 'Fluid Carnatic Percussion',
    programRange: '119, 0-11',
    bank: '44',
    channel: 10,
    specId: 'spec_pakhawaj',
    description: 'Ancient Dhrupad Pakhawaj (Wet dough bass & open palm)',
    isBuiltIn: true,
  },
  // Kanjeera: Fluid_Carnatic_Percussion, Program 121 (Bank 45)
  {
    id: 'bind_kanjeera',
    soundfontId: 'Fluid_Carnatic_Percussion',
    soundfontName: 'Fluid Carnatic Percussion',
    programRange: '121',
    bank: '45',
    channel: 10,
    specId: 'spec_kanjeera_ghatam',
    description: 'Lizard-Skin Frame Drum with vocal-like Gumki glides',
    isBuiltIn: true,
  },
  // Ghatam: Fluid_Carnatic_Percussion, Program 122 (Bank 46)
  {
    id: 'bind_ghatam',
    soundfontId: 'Fluid_Carnatic_Percussion',
    soundfontName: 'Fluid Carnatic Percussion',
    programRange: '122',
    bank: '46',
    channel: 10,
    specId: 'spec_kanjeera_ghatam',
    description: 'Carnatic Baked Clay Pot (Belly, Mouth & Neck tones)',
    isBuiltIn: true,
  },
  // General MIDI Drums fallback
  {
    id: 'bind_gm_drums',
    soundfontId: '*',
    soundfontName: 'General MIDI / Default Synth',
    programRange: '*',
    channel: 10,
    specId: 'spec_gm_drums',
    description: 'Standard General MIDI Channel 10 Drum Kits & 808s',
    isBuiltIn: true,
  },
];

const STORAGE_SPECS_KEY = 'lmp_soundfont_specs_v3';
const STORAGE_BINDINGS_KEY = 'lmp_soundfont_bindings_v3';

class SoundFontSpecManager {
  private specs: Map<string, SpecDocument> = new Map();
  private bindings: SoundFontProgramBinding[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error('SpecManager listener error:', err);
      }
    }
  }

  private loadFromStorage() {
    // 1. Load default specs
    this.specs.clear();
    for (const s of BUILTIN_SPECS) {
      this.specs.set(s.id, { ...s });
    }

    // 2. Overlay user customized / imported specs
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSpecs = window.localStorage.getItem(STORAGE_SPECS_KEY);
        if (storedSpecs) {
          const parsed = JSON.parse(storedSpecs) as SpecDocument[];
          for (const s of parsed) {
            this.specs.set(s.id, s);
          }
        }
      } catch (e) {
        console.warn('Failed to load custom specs from localStorage:', e);
      }
    }

    // 3. Load bindings
    this.bindings = [...BUILTIN_BINDINGS];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedBindings = window.localStorage.getItem(STORAGE_BINDINGS_KEY);
        if (storedBindings) {
          const parsed = JSON.parse(storedBindings) as SoundFontProgramBinding[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.bindings = parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to load custom bindings from localStorage:', e);
      }
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const allSpecs = Array.from(this.specs.values());
      window.localStorage.setItem(STORAGE_SPECS_KEY, JSON.stringify(allSpecs));
      window.localStorage.setItem(STORAGE_BINDINGS_KEY, JSON.stringify(this.bindings));
    } catch (e) {
      console.error('Failed to save specs/bindings to localStorage:', e);
    }
  }

  // --- Specifications API ---
  public getSpecs(): SpecDocument[] {
    return Array.from(this.specs.values());
  }

  public getSpec(id: string): SpecDocument | null {
    return this.specs.get(id) || null;
  }

  public saveSpec(spec: SpecDocument): void {
    spec.updatedAt = Date.now();
    this.specs.set(spec.id, spec);
    this.saveToStorage();
    this.notify();
  }

  public deleteSpec(id: string): boolean {
    const s = this.specs.get(id);
    if (!s || s.isBuiltIn) return false;
    this.specs.delete(id);
    // Remove bindings pointing to deleted spec
    this.bindings = this.bindings.filter((b) => b.specId !== id);
    this.saveToStorage();
    this.notify();
    return true;
  }

  public resetSpecsToDefault(): void {
    this.specs.clear();
    for (const s of BUILTIN_SPECS) {
      this.specs.set(s.id, { ...s });
    }
    this.saveToStorage();
    this.notify();
  }

  // --- Program Bindings API ---
  public getBindings(): SoundFontProgramBinding[] {
    return [...this.bindings];
  }

  public saveBinding(binding: SoundFontProgramBinding): void {
    const idx = this.bindings.findIndex((b) => b.id === binding.id);
    if (idx >= 0) {
      this.bindings[idx] = binding;
    } else {
      this.bindings.push(binding);
    }
    this.saveToStorage();
    this.notify();
  }

  public deleteBinding(id: string): boolean {
    const idx = this.bindings.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    this.bindings.splice(idx, 1);
    this.saveToStorage();
    this.notify();
    return true;
  }

  public resetBindingsToDefault(): void {
    this.bindings = [...BUILTIN_BINDINGS];
    this.saveToStorage();
    this.notify();
  }

  /**
   * Helper: checks if a track's program matches a given range string.
   * e.g. "116", "116, 117", "0-11", "*"
   */
  public programMatches(targetProgram: number | undefined, rangeStr: string): boolean {
    if (rangeStr === '*' || rangeStr.trim() === '') return true;
    if (targetProgram === undefined) return false;

    const parts = rangeStr.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part === '*') return true;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          if (targetProgram >= startStr && targetProgram <= endStr) return true;
        }
      } else {
        const pNum = parseInt(part, 10);
        if (!isNaN(pNum) && pNum === targetProgram) return true;
      }
    }
    return false;
  }

  /**
   * Dynamic Matcher: Determines which specification markdown file should be appended
   * for a given track, taking into account SoundFont, Program, Channel, and Track Name.
   */
  public matchSpecForTrack(
    track?: Partial<StudioTrack> | null,
    explicitSpecId?: string | null
  ): {
    spec: SpecDocument | null;
    matchedBinding: SoundFontProgramBinding | null;
    reason: string;
    isOverridden: boolean;
  } {
    // 1. Manual user override takes precedence
    if (explicitSpecId !== undefined && explicitSpecId !== null && explicitSpecId !== 'auto') {
      if (explicitSpecId === 'none') {
        return {
          spec: null,
          matchedBinding: null,
          reason: 'User explicitly selected None (Core LMP only, no instrument specs)',
          isOverridden: true,
        };
      }
      const s = this.getSpec(explicitSpecId);
      if (s) {
        return {
          spec: s,
          matchedBinding: null,
          reason: `User manually selected ${s.title}`,
          isOverridden: true,
        };
      }
    }

    if (!track) {
      return {
        spec: null,
        matchedBinding: null,
        reason: 'No track context provided',
        isOverridden: false,
      };
    }

    const trkSoundfont = (track.soundfont || '').toLowerCase();
    const trkName = (track.name || '').toLowerCase();
    const trkProg = track.program;
    const trkChan = track.channel;

    // 2. Iterate bindings in priority order (specific soundfonts & programs first, wildcards last)
    const sortedBindings = [...this.bindings].sort((a, b) => {
      const aSfWild = a.soundfontId === '*' ? 1 : 0;
      const bSfWild = b.soundfontId === '*' ? 1 : 0;
      if (aSfWild !== bSfWild) return aSfWild - bSfWild;
      const aProgWild = a.programRange === '*' ? 1 : 0;
      const bProgWild = b.programRange === '*' ? 1 : 0;
      return aProgWild - bProgWild;
    });

    for (const b of sortedBindings) {
      const bSf = b.soundfontId.toLowerCase();

      // Soundfont match
      const sfMatch =
        bSf === '*' ||
        trkSoundfont.includes(bSf) ||
        (b.soundfontName && trkSoundfont.includes(b.soundfontName.toLowerCase()));

      if (!sfMatch && bSf !== '*') continue;

      // Channel match
      if (b.channel !== undefined && trkChan !== undefined && b.channel !== trkChan) {
        continue;
      }

      // Program range match
      if (trkProg !== undefined && !this.programMatches(trkProg, b.programRange)) {
        continue;
      }

      const foundSpec = this.getSpec(b.specId);
      if (foundSpec) {
        return {
          spec: foundSpec,
          matchedBinding: b,
          reason: `Matched binding '${b.description}' (Program ${trkProg ?? 'any'})`,
          isOverridden: false,
        };
      }
    }

    // 3. Fallback Heuristics by Instrument Name
    if (/dholak/i.test(trkName)) {
      const s = this.getSpec('spec_dholak');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Dholak)', isOverridden: false };
    }
    if (/tabla/i.test(trkName)) {
      const s = this.getSpec('spec_tabla');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Tabla)', isOverridden: false };
    }
    if (/khol/i.test(trkName)) {
      const s = this.getSpec('spec_khol');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Khol)', isOverridden: false };
    }
    if (/mridangam/i.test(trkName)) {
      const s = this.getSpec('spec_mridangam');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Mridangam)', isOverridden: false };
    }
    if (/pakhawaj/i.test(trkName)) {
      const s = this.getSpec('spec_pakhawaj');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Pakhawaj)', isOverridden: false };
    }
    if (/kanjeera|ghatam/i.test(trkName)) {
      const s = this.getSpec('spec_kanjeera_ghatam');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Kanjeera/Ghatam)', isOverridden: false };
    }
    if (/folk|aux|chimta|manjeera/i.test(trkName)) {
      const s = this.getSpec('spec_folk_auxiliary');
      if (s) return { spec: s, matchedBinding: null, reason: 'Matched track name (Folk Auxiliary)', isOverridden: false };
    }
    if (trkChan === 10 || /drum|percussion|808|beat/i.test(trkName)) {
      const s = this.getSpec('spec_gm_drums');
      if (s) return { spec: s, matchedBinding: null, reason: 'General percussion / Channel 10 match', isOverridden: false };
    }

    return {
      spec: null,
      matchedBinding: null,
      reason: 'Melodic or harmonic track (No percussive drum map needed)',
      isOverridden: false,
    };
  }

  /**
   * Import custom markdown text as a new specification
   */
  public importMarkdownFile(fileName: string, content: string, title?: string): SpecDocument {
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const cleanId = 'spec_custom_' + baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_' + Date.now();
    const doc: SpecDocument = {
      id: cleanId,
      title: title || baseName.replace(/_/g, ' '),
      fileName: fileName.endsWith('.md') ? fileName : `${fileName}.md`,
      instrumentFamily: 'Custom User Specification',
      content,
      isBuiltIn: false,
      updatedAt: Date.now(),
    };
    this.saveSpec(doc);
    return doc;
  }
}

export const soundFontSpecManager = new SoundFontSpecManager();
