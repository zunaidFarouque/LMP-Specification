import { SoundFont2 } from 'soundfont2';
import type { DrumMapEntry } from './sourceMapBridge';

export interface SoundFontPresetInfo {
  bank: number;
  preset: number;
  name: string;
}

export interface StoredSoundFontMetadata {
  id: string;
  name: string;
  sizeBytes: number;
  addedAt: number;
}

export const FLUID_INDIAN_PERCUSSION_MAP: DrumMapEntry[] = [
  // Bayān (Bass Drum)
  { name: 'Ge', midi: 36 },
  { name: 'ClsGe', midi: 37 },
  { name: 'Ke', midi: 38 },
  { name: 'Ka', midi: 38 },
  { name: 'SldGe', midi: 39 },
  { name: 'KeAlt', midi: 40 },
  { name: 'KeAlt2', midi: 41 },
  { name: 'SldGeLong', midi: 43 },
  { name: 'ClsGeHeavy', midi: 45 },

  // Dayān (Treble Drum)
  { name: 'Na', midi: 48 },
  { name: 'Ta', midi: 48 },
  { name: 'NaAlt', midi: 49 },
  { name: 'Tin', midi: 50 },
  { name: 'Tun', midi: 50 },
  { name: 'TeAlt', midi: 51 },
  { name: 'Te', midi: 52 },
  { name: 'Ti', midi: 52 },
  { name: 'Tu', midi: 53 },
  { name: 'Re', midi: 54 },
  { name: 'TuAlt', midi: 55 },
  { name: 'TeSharp', midi: 56 },
  { name: 'Thap', midi: 57 },
  { name: 'Tran', midi: 58 },
  { name: 'TiFast', midi: 59 },

  // Compound Strokes (Dual Hand)
  { name: 'Dha', midi: 60 },
  { name: 'Ra', midi: 61 },
  { name: 'Dhin', midi: 62 },
  { name: 'TinAlt', midi: 63 },
  { name: 'Tak', midi: 64 },
  { name: 'TranAlt', midi: 65 },

  // Auxiliary Percussion
  { name: 'Manjeera', midi: 69 },
  { name: 'ManjeeraOpen', midi: 70 },
  { name: 'Chimta', midi: 71 },
  { name: 'Manjeera2', midi: 80 },
  { name: 'ManjeeraOpen2', midi: 81 },
];

export const FLUID_INDIAN_PERCUSSION_MAP_TEXT = FLUID_INDIAN_PERCUSSION_MAP
  .map((m) => `@MAP ${m.name}=${m.midi}`)
  .join('\n');

const DB_NAME = 'LmpSoundFontStore';
const STORE_NAME = 'soundfonts';
const DB_VERSION = 1;
const STORAGE_PREF_KEY = 'lmp_selected_sound_source';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class SoundFontEngine {
  private sf: any = null;
  private fluidIndianSf: any = null;
  private fluidCarnaticSf: any = null;
  private fluidFolkSf: any = null;
  private activeSourceId: string = 'default-gm'; // 'default-gm' | 'fluid-indian' | 'fluid-carnatic' | 'fluid-folk' | customId
  private soundFontName: string = 'Default GM Synth';
  private isLoaded: boolean = false;
  private cachedBuffers: Map<string, AudioBuffer> = new Map();
  private presets: SoundFontPresetInfo[] = [];
  private activeBank: number = 41;
  private activePreset: number = 116;

  private hasLocalFluid: boolean = false;
  private hasLocalCarnatic: boolean = false;
  private hasLocalFolk: boolean = false;
  private storedSoundfonts: StoredSoundFontMetadata[] = [];
  private listeners: Set<() => void> = new Set();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Check saved preference or default to 'default-gm'
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_PREF_KEY);
      if (saved) {
        this.activeSourceId = saved;
      }
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public getActiveSourceId(): string {
    return this.activeSourceId;
  }

  public isSoundFontActive(): boolean {
    return this.activeSourceId !== 'default-gm' && this.isLoaded && this.sf !== null;
  }

  public getLoaded(): boolean {
    return this.isLoaded;
  }

  public getSoundFontName(): string {
    if (this.activeSourceId === 'default-gm') {
      return 'Default GM Engine';
    }
    return this.soundFontName;
  }

  public hasLocalFluidPercussion(): boolean {
    return this.hasLocalFluid;
  }

  public getStoredSoundfonts(): StoredSoundFontMetadata[] {
    return this.storedSoundfonts;
  }

  public getPresets(): SoundFontPresetInfo[] {
    return this.presets;
  }

  public setActivePreset(bank: number, preset: number) {
    this.activeBank = bank;
    this.activePreset = preset;
    this.notify();
  }

  /**
   * Initializes soundfont registry:
   * 1. Checks if local Fluid Indian Percussion .sf2 exists on the user's PC.
   * 2. Reads previously stored custom .sf2 soundfonts from IndexedDB.
   * 3. Loads the user's active sound source (or remains on default GM).
   */
  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // 1. Check local Fluid Indian Percussion availability (only exists on user's PC)
      await this.detectLocalFluidSoundFont();

      // 2. Load stored soundfont list from IndexedDB
      await this.refreshStoredList();

      // 3. Activate selected source
      if (this.activeSourceId === 'fluid-indian' && this.hasLocalFluid) {
        await this.loadFluidIndianSoundFont();
      } else if (this.activeSourceId.startsWith('sf_')) {
        const found = this.storedSoundfonts.find((s) => s.id === this.activeSourceId);
        if (found) {
          await this.loadStoredSoundFont(found.id);
        } else {
          // Fall back to default GM if stored file not found
          this.activeSourceId = 'default-gm';
        }
      } else {
        this.activeSourceId = 'default-gm';
      }

      this.notify();
    })();

    return this.initPromise;
  }

  /**
   * Detects if Fluid Indian Percussion .sf2 is present in the public soundfonts folder.
   * Since this repo is private and gitignored, this returns true only on the user's local PC.
   */
  public async detectLocalFluidSoundFont(): Promise<boolean> {
    const checkFile = async (paths: string[]): Promise<boolean> => {
      for (const url of paths) {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) return true;
          const getRes = await fetch(url);
          if (getRes.ok) return true;
        } catch {}
      }
      return false;
    };

    this.hasLocalFluid = await checkFile([
      '/soundfonts/soundfonts/Fluid_Indian_Percussion.sf2',
      '/soundfonts/Fluid_Indian_Percussion.sf2',
    ]);

    this.hasLocalCarnatic = await checkFile([
      '/soundfonts/soundfonts/Fluid_Carnatic_Percussion.sf2',
      '/soundfonts/Fluid_Carnatic_Percussion.sf2',
    ]);

    this.hasLocalFolk = await checkFile([
      '/soundfonts/soundfonts/Fluid_Folk_Percussion.sf2',
      '/soundfonts/Fluid_Folk_Percussion.sf2',
    ]);

    return this.hasLocalFluid || this.hasLocalCarnatic || this.hasLocalFolk;
  }

  public hasLocalCarnaticPercussion(): boolean {
    return this.hasLocalCarnatic;
  }

  public hasLocalFolkPercussion(): boolean {
    return this.hasLocalFolk;
  }

  /**
   * Loads the local Fluid Indian Percussion soundfont
   */
  public async loadFluidIndianSoundFont(): Promise<boolean> {
    const candidates = [
      '/soundfonts/soundfonts/Fluid_Indian_Percussion.sf2',
      '/soundfonts/Fluid_Indian_Percussion.sf2',
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const ok = await this.loadFromArrayBuffer(buf, 'Fluid Indian Percussion');
          if (ok) {
            this.fluidIndianSf = this.sf;
            this.activeSourceId = 'fluid-indian';
            this.savePreference('fluid-indian');
            this.notify();
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  /**
   * Loads the local Fluid Carnatic Percussion soundfont (Mridangam, Pakhawaj, Kanjeera, Ghatam)
   */
  public async loadFluidCarnaticSoundFont(): Promise<boolean> {
    const candidates = [
      '/soundfonts/soundfonts/Fluid_Carnatic_Percussion.sf2',
      '/soundfonts/Fluid_Carnatic_Percussion.sf2',
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const ok = await this.loadFromArrayBuffer(buf, 'Fluid Carnatic Percussion');
          if (ok) {
            this.fluidCarnaticSf = this.sf;
            this.notify();
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  /**
   * Loads the local Fluid Folk Percussion soundfont (Dholak, Khol, Folk Auxiliary)
   */
  public async loadFluidFolkSoundFont(): Promise<boolean> {
    const candidates = [
      '/soundfonts/soundfonts/Fluid_Folk_Percussion.sf2',
      '/soundfonts/Fluid_Folk_Percussion.sf2',
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const ok = await this.loadFromArrayBuffer(buf, 'Fluid Folk Percussion');
          if (ok) {
            this.fluidFolkSf = this.sf;
            this.notify();
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  /**
   * Select a sound source from the dropdown:
   * - 'default-gm': Standard General MIDI synth
   * - 'fluid-indian': Fluid Indian Percussion .sf2 (user's PC)
   * - custom ID: from stored IndexedDB soundfonts
   */
  public async selectSource(sourceId: string): Promise<boolean> {
    if (sourceId === 'default-gm') {
      this.activeSourceId = 'default-gm';
      this.soundFontName = 'Default GM Synth';
      this.isLoaded = false;
      this.sf = null;
      this.cachedBuffers.clear();
      this.savePreference('default-gm');
      this.notify();
      return true;
    }

    if (sourceId === 'fluid-indian') {
      const ok = await this.loadFluidIndianSoundFont();
      return ok;
    }

    if (sourceId.startsWith('sf_')) {
      const ok = await this.loadStoredSoundFont(sourceId);
      return ok;
    }

    return false;
  }

  /**
   * Load a custom .sf2 file uploaded by user, persist in IndexedDB, and make it active
   */
  public async loadAndStoreCustomFile(file: File): Promise<boolean> {
    try {
      const buf = await file.arrayBuffer();
      // 1. Save to IndexedDB
      const meta = await this.saveToIndexedDB(file.name, buf);

      // 2. Parse and activate
      const ok = await this.loadFromArrayBuffer(buf, file.name);
      if (ok) {
        this.activeSourceId = meta.id;
        this.savePreference(meta.id);
        await this.refreshStoredList();
        this.notify();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[SoundFontEngine] Failed to load and store custom .sf2 file:', err);
      return false;
    }
  }

  /**
   * Load stored soundfont from IndexedDB by ID
   */
  public async loadStoredSoundFont(id: string): Promise<boolean> {
    try {
      const item = await this.getFromIndexedDB(id);
      if (!item || !item.buffer) return false;

      const ok = await this.loadFromArrayBuffer(item.buffer, item.name);
      if (ok) {
        this.activeSourceId = id;
        this.savePreference(id);
        this.notify();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[SoundFontEngine] Failed to load stored soundfont:', err);
      return false;
    }
  }

  /**
   * Delete custom soundfont from IndexedDB
   */
  public async deleteStoredSoundFont(id: string): Promise<void> {
    try {
      const db = await openIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      if (this.activeSourceId === id) {
        await this.selectSource('default-gm');
      }
      await this.refreshStoredList();
      this.notify();
    } catch (err) {
      console.warn('[SoundFontEngine] Failed to delete soundfont from storage:', err);
    }
  }

  private savePreference(sourceId: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_PREF_KEY, sourceId);
    }
  }

  private async refreshStoredList(): Promise<void> {
    try {
      const db = await openIndexedDB();
      const list = await new Promise<StoredSoundFontMetadata[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result || [];
          resolve(
            results.map((r: any) => ({
              id: r.id,
              name: r.name,
              sizeBytes: r.sizeBytes,
              addedAt: r.addedAt,
            }))
          );
        };
        req.onerror = () => reject(req.error);
      });
      this.storedSoundfonts = list;
    } catch {
      this.storedSoundfonts = [];
    }
  }

  private async saveToIndexedDB(name: string, buffer: ArrayBuffer): Promise<StoredSoundFontMetadata> {
    const id = `sf_${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const metadata: StoredSoundFontMetadata = {
      id,
      name,
      sizeBytes: buffer.byteLength,
      addedAt: Date.now(),
    };

    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ ...metadata, buffer });
      tx.oncomplete = () => resolve(metadata);
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getFromIndexedDB(id: string): Promise<{ id: string; name: string; buffer: ArrayBuffer } | null> {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Parse SF2 ArrayBuffer into internal preset and zone lookup tables
   */
  public async loadFromArrayBuffer(buffer: ArrayBuffer, name: string = 'Custom SoundFont'): Promise<boolean> {
    try {
      const uint8 = new Uint8Array(buffer);
      this.sf = new SoundFont2(uint8);
      this.soundFontName = name;
      this.cachedBuffers.clear();

      this.presets = [];
      if (Array.isArray(this.sf.presets)) {
        for (const p of this.sf.presets) {
          if (p && p.header) {
            this.presets.push({
              bank: p.header.bank,
              preset: p.header.preset,
              name: p.header.name,
            });
          }
        }
      }

      // Default to Bank 41 Preset 116 if available, otherwise first preset
      const masterPreset = this.presets.find((p) => p.bank === 41 && p.preset === 116);
      if (masterPreset) {
        this.activeBank = 41;
        this.activePreset = 116;
      } else if (this.presets.length > 0) {
        this.activeBank = this.presets[0].bank;
        this.activePreset = this.presets[0].preset;
      }

      this.isLoaded = true;
      return true;
    } catch (err) {
      console.warn('[SoundFontEngine] Failed to parse SoundFont binary:', err);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Find matching zone in preset for a given MIDI key and velocity
   */
  private findMatchingZone(presetObj: any, midi: number, velocity: number): any {
    if (!presetObj || !presetObj.zones) return null;

    // A preset may have 1 or more preset zones pointing to instruments
    for (const pZone of presetObj.zones) {
      const inst = pZone.instrument;
      if (!inst || !inst.zones) continue;

      const instZones = inst.zones;
      // Filter instrument zones by keyRange
      const matchingKeyZones = instZones.filter((z: any) => {
        if (!z.keyRange) return false;
        return midi >= z.keyRange.lo && midi <= z.keyRange.hi;
      });

      if (matchingKeyZones.length === 0) continue;

      // Filter by velocity range (generator 44)
      const matchingVelZone = matchingKeyZones.find((z: any) => {
        const velRange = z.generators?.['44']?.range;
        if (!velRange) return true;
        return velocity >= velRange.lo && velocity <= velRange.hi;
      });

      if (matchingVelZone) return matchingVelZone;

      // Fallback: pick the closest velocity range
      let bestZone = matchingKeyZones[0];
      let minDiff = 999;
      for (const z of matchingKeyZones) {
        const vr = z.generators?.['44']?.range;
        if (!vr) return z;
        const midPoint = (vr.lo + vr.hi) / 2;
        const diff = Math.abs(velocity - midPoint);
        if (diff < minDiff) {
          minDiff = diff;
          bestZone = z;
        }
      }
      return bestZone;
    }

    return null;
  }

  /**
   * Play an acoustic soundfont sample through Web Audio destination
   */
  public playNote(
    ctx: AudioContext,
    dest: AudioNode,
    midi: number,
    velocity: number,
    duration: number,
    when: number,
    options?: { bank?: number; preset?: number }
  ): boolean {
    if (!this.isLoaded || !this.sf) return false;
    return this.playSfInstance(this.sf, ctx, dest, midi, velocity, duration, when, options);
  }

  /**
   * Play note routed specifically for a track based on track-level @SF2 directive or global source
   */
  public playNoteForTrack(
    ctx: AudioContext,
    dest: AudioNode,
    midi: number,
    velocity: number,
    duration: number,
    when: number,
    track: { soundfont?: string | boolean | null; channel: number; program: number; name: string }
  ): boolean {
    const explicitSf = track.soundfont ? String(track.soundfont).trim() : null;

    // 1. Explicitly requested GM synth
    if (explicitSf === 'default-gm' || explicitSf === 'gm') {
      return false;
    }

    // 2. Explicitly requested Fluid Indian Percussion (Tabla)
    if (explicitSf && /fluid[-_]?indian|tabla/i.test(explicitSf)) {
      if (!this.fluidIndianSf && this.hasLocalFluid) {
        this.loadFluidIndianSoundFont().catch(() => {});
      }
      const sfInstance = this.fluidIndianSf || (this.soundFontName.includes('Fluid') ? this.sf : null);
      if (sfInstance) {
        return this.playSfInstance(sfInstance, ctx, dest, midi, velocity, duration, when, {
          bank: track.channel === 10 ? 128 : 41,
          preset: track.program || 116,
        });
      }
    }

    // 3. Explicitly requested Fluid Carnatic Percussion (Mridangam, Pakhawaj, Kanjeera, Ghatam)
    if (explicitSf && /fluid[-_]?carnatic|carnatic|mridangam|pakhawaj|kanjeera|ghatam/i.test(explicitSf)) {
      if (!this.fluidCarnaticSf && this.hasLocalCarnatic) {
        this.loadFluidCarnaticSoundFont().catch(() => {});
      }
      const sfInstance = this.fluidCarnaticSf || this.fluidIndianSf || this.sf;
      if (sfInstance) {
        return this.playSfInstance(sfInstance, ctx, dest, midi, velocity, duration, when, {
          bank: track.channel === 10 ? 128 : (track.program === 119 ? 44 : track.program === 120 ? 42 : track.program === 121 ? 45 : track.program === 122 ? 46 : 42),
          preset: track.program || 120,
        });
      }
    }

    // 4. Explicitly requested Fluid Folk Percussion (Dholak, Khol, Folk Auxiliary)
    if (explicitSf && /fluid[-_]?folk|folk|dholak|khol|auxiliary/i.test(explicitSf)) {
      if (!this.fluidFolkSf && this.hasLocalFolk) {
        this.loadFluidFolkSoundFont().catch(() => {});
      }
      const sfInstance = this.fluidFolkSf || this.fluidIndianSf || this.sf;
      if (sfInstance) {
        return this.playSfInstance(sfInstance, ctx, dest, midi, velocity, duration, when, {
          bank: track.channel === 10 ? 128 : (track.program === 118 ? 43 : track.program === 123 ? 47 : 41),
          preset: track.program || 117,
        });
      }
    }

    // 5. Track has another custom SoundFont name or uses global source
    if (explicitSf) {
      if (this.sf) {
        return this.playSfInstance(this.sf, ctx, dest, midi, velocity, duration, when, {
          bank: track.channel === 10 ? 128 : 0,
          preset: track.program || 0,
        });
      }
    } else if (this.isSoundFontActive()) {
      if (this.activeSourceId === 'fluid-indian') {
        const trkName = track.name.toLowerCase();
        // Route according to instrument identity if sub-soundfonts are loaded
        if (/dholak|khol|folk|aux/i.test(trkName) && this.fluidFolkSf) {
          return this.playSfInstance(this.fluidFolkSf, ctx, dest, midi, velocity, duration, when, {
            bank: track.channel === 10 ? 128 : (track.program === 118 ? 43 : track.program === 123 ? 47 : 41),
            preset: track.program || (trkName.includes('khol') ? 118 : 117),
          });
        }
        if (/mridangam|pakhawaj|kanjeera|ghatam/i.test(trkName) && this.fluidCarnaticSf) {
          return this.playSfInstance(this.fluidCarnaticSf, ctx, dest, midi, velocity, duration, when, {
            bank: track.channel === 10 ? 128 : (track.program === 119 ? 44 : 42),
            preset: track.program || (trkName.includes('pakhawaj') ? 119 : 120),
          });
        }

        const isIndianPerc =
          track.channel === 10 ||
          /tabla|indian|percussion|dholak/i.test(track.name) ||
          track.program === 116 ||
          track.program === 117 ||
          (midi >= 36 && midi <= 81);
        const sfInstance = this.fluidIndianSf || this.sf;
        if (isIndianPerc && sfInstance) {
          return this.playSfInstance(sfInstance, ctx, dest, midi, velocity, duration, when, {
            bank: track.channel === 10 ? 128 : 41,
            preset: track.program || 116,
          });
        }
      } else if (this.sf) {
        return this.playSfInstance(this.sf, ctx, dest, midi, velocity, duration, when, {
          bank: track.channel === 10 ? 128 : 0,
          preset: track.program || 0,
        });
      }
    }

    return false;
  }

  /**
   * Internal player for a specific SoundFont2 instance
   */
  private playSfInstance(
    sfInstance: any,
    ctx: AudioContext,
    dest: AudioNode,
    midi: number,
    velocity: number,
    duration: number,
    when: number,
    options?: { bank?: number; preset?: number }
  ): boolean {
    if (!sfInstance) return false;

    const targetBank = options?.bank ?? this.activeBank;
    const targetPreset = options?.preset ?? this.activePreset;

    // Find preset
    let presetObj = sfInstance.presets?.find(
      (p: any) => p.header?.bank === targetBank && p.header?.preset === targetPreset
    );

    // Fallback search in bank 128 if requested bank wasn't found
    if (!presetObj && targetBank !== 128) {
      presetObj = sfInstance.presets?.find(
        (p: any) => (p.header?.bank === 128 || p.header?.bank === 41) && p.header?.preset === targetPreset
      );
    }
    if (!presetObj && sfInstance.presets?.length > 0) {
      presetObj = sfInstance.presets[0];
    }
    if (!presetObj) return false;

    const zone = this.findMatchingZone(presetObj, midi, velocity);
    if (!zone || !zone.sample || !zone.sample.data) return false;

    const sample = zone.sample;
    const sampleKey = sample.header?.name || `${sample.start}_${sample.end}`;

    // Get or decode AudioBuffer
    let audioBuffer = this.cachedBuffers.get(sampleKey);
    if (!audioBuffer) {
      try {
        const pcmData: Int16Array = sample.data;
        const sampleRate = sample.header?.sampleRate || 32000;
        audioBuffer = ctx.createBuffer(1, pcmData.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }
        this.cachedBuffers.set(sampleKey, audioBuffer);
      } catch (err) {
        console.warn('[SoundFontEngine] Failed to decode sample buffer:', err);
        return false;
      }
    }

    // Playback via BufferSourceNode
    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Calculate rootKey & pitch shifting
      const rootKey =
        zone.generators?.['58']?.value ??
        sample.header?.originalPitch ??
        midi;
      const semitoneOffset = midi - rootKey;
      if (semitoneOffset !== 0) {
        source.playbackRate.setValueAtTime(Math.pow(2, semitoneOffset / 12), when);
      }

      // Dynamic gain & transient envelope
      const gainNode = ctx.createGain();
      const normVel = Math.max(0.1, Math.min(1.0, velocity / 127));
      gainNode.gain.setValueAtTime(normVel, when);

      // Acoustic decay tailored to note duration
      const decayDuration = Math.max(duration, 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, when + decayDuration);

      source.connect(gainNode);
      gainNode.connect(dest);

      source.start(when);
      source.stop(when + decayDuration + 0.1);
      return true;
    } catch {
      return false;
    }
  }
}

export const soundFontEngine = new SoundFontEngine();
