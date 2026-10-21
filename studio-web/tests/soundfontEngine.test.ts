import { describe, test, expect, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import {
  SoundFontEngine,
  FLUID_INDIAN_PERCUSSION_MAP,
  FLUID_INDIAN_PERCUSSION_MAP_TEXT,
} from '../src/core/soundfontEngine';
import { getEffectiveSystemInstruction } from '../src/core/aiService';

describe('SoundFontEngine & Fluid Indian Percussion', () => {
  const sfPath = path.resolve(__dirname, '../public/soundfonts/soundfonts/Fluid_Indian_Percussion.sf2');
  let engine: SoundFontEngine;
  let hasSfFile = false;

  beforeAll(async () => {
    engine = new SoundFontEngine();
    if (fs.existsSync(sfPath)) {
      hasSfFile = true;
      const buf = fs.readFileSync(sfPath);
      await engine.loadFromArrayBuffer(buf.buffer, 'Fluid Indian Percussion');
    }
  });

  test('FLUID_INDIAN_PERCUSSION_MAP has verified subcontinental bols and aliases', () => {
    const map = new Map(FLUID_INDIAN_PERCUSSION_MAP.map((m) => [m.name, m.midi]));

    // Bayān (Bass)
    expect(map.get('Ge')).toBe(36);
    expect(map.get('ClsGe')).toBe(37);
    expect(map.get('Ke')).toBe(38);
    expect(map.get('Ka')).toBe(38);
    expect(map.get('SldGe')).toBe(39);
    expect(map.get('SldGeLong')).toBe(43);

    // Dayān (Treble)
    expect(map.get('Na')).toBe(48);
    expect(map.get('Ta')).toBe(48);
    expect(map.get('Tin')).toBe(50);
    expect(map.get('Tun')).toBe(50);
    expect(map.get('Te')).toBe(52);
    expect(map.get('Ti')).toBe(52);
    expect(map.get('Tu')).toBe(53);

    // Compound Strokes (Instant two-drum hits)
    expect(map.get('Dha')).toBe(60);
    expect(map.get('Dhin')).toBe(62);
    expect(map.get('Tak')).toBe(64);

    // Auxiliary Percussion
    expect(map.get('Manjeera')).toBe(69);
    expect(map.get('ManjeeraOpen')).toBe(70);
    expect(map.get('Chimta')).toBe(71);
  });

  test('FLUID_INDIAN_PERCUSSION_MAP_TEXT formats as valid @MAP directives', () => {
    expect(FLUID_INDIAN_PERCUSSION_MAP_TEXT).toContain('@MAP Ge=36');
    expect(FLUID_INDIAN_PERCUSSION_MAP_TEXT).toContain('@MAP Na=48');
    expect(FLUID_INDIAN_PERCUSSION_MAP_TEXT).toContain('@MAP Dha=60');
    expect(FLUID_INDIAN_PERCUSSION_MAP_TEXT).toContain('@MAP Dhin=62');
    expect(FLUID_INDIAN_PERCUSSION_MAP_TEXT).toContain('@MAP Chimta=71');
  });

  test('loads SoundFont2 binary and indexes presets', () => {
    if (!hasSfFile) return;

    expect(engine.getLoaded()).toBe(true);
    const presets = engine.getPresets();
    expect(presets.length).toBeGreaterThanOrEqual(14);

    // Bank 41 Preset 116 (Tabla Master)
    const tablaMaster = presets.find((p) => p.bank === 41 && p.preset === 116);
    expect(tablaMaster).toBeDefined();
    expect(tablaMaster?.name).toContain('Tabla Master');

    // Bank 41 Preset 117 (Dholak Studio)
    const dholak = presets.find((p) => p.bank === 41 && p.preset === 117);
    expect(dholak).toBeDefined();

    // Bank 128 GM Drum channel presets
    const gmPerc = presets.find((p) => p.bank === 128 && p.preset === 116);
    expect(gmPerc).toBeDefined();
  });

  test('resolves multi-velocity zones accurately', () => {
    if (!hasSfFile) return;

    const findZone = (engine as any).findMatchingZone.bind(engine);
    const preset = (engine as any).sf.presets.find(
      (p: any) => p.header?.bank === 41 && p.header?.preset === 116
    );
    expect(preset).toBeDefined();

    // Soft velocity Ge
    const softGe = findZone(preset, 36, 40);
    expect(softGe).toBeDefined();
    expect(softGe.sample?.header?.name).toBe('TB_ge_soft');

    // Medium velocity Ge
    const medGe = findZone(preset, 36, 85);
    expect(medGe).toBeDefined();
    expect(medGe.sample?.header?.name).toBe('TB_ge_med');

    // Hard velocity Ge
    const hardGe = findZone(preset, 36, 120);
    expect(hardGe).toBeDefined();
    expect(hardGe.sample?.header?.name).toBe('TB_ge_hard');

    // Dha (Compound Note 60)
    const dha = findZone(preset, 60, 95);
    expect(dha).toBeDefined();
    expect(dha.sample?.header?.name).toBe('TB_dha_med');

    // Chimta (Note 71)
    const chimta = findZone(preset, 71, 90);
    expect(chimta).toBeDefined();
    expect(chimta.sample?.header?.name).toBe('AUX_chimta_ring');
  });

  test('playNote creates audio buffer and connects WebAudio graph', () => {
    if (!hasSfFile) return;

    // Mock Web Audio Context
    let bufferCreated = false;
    let sourceStarted = false;
    let playbackRateSet = false;

    const mockCtx: any = {
      currentTime: 1.0,
      createBuffer: (channels: number, length: number, sampleRate: number) => {
        bufferCreated = true;
        const pcm = new Float32Array(length);
        return {
          getChannelData: () => pcm,
          length,
          sampleRate,
        };
      },
      createGain: () => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
      }),
      createBufferSource: () => ({
        buffer: null,
        playbackRate: {
          setValueAtTime: (val: number) => {
            playbackRateSet = true;
          },
        },
        connect: () => {},
        start: () => {
          sourceStarted = true;
        },
        stop: () => {},
      }),
    };

    const mockDest: any = {};

    const handled = engine.playNote(mockCtx, mockDest, 36, 115, 0.5, 1.0, { bank: 41, preset: 116 });
    expect(handled).toBe(true);
    expect(bufferCreated).toBe(true);
    expect(sourceStarted).toBe(true);
  });

  test('SoundFont source switching defaults to default-gm and toggles cleanly', async () => {
    const testEngine = new SoundFontEngine();
    expect(testEngine.getActiveSourceId()).toBe('default-gm');
    expect(testEngine.isSoundFontActive()).toBe(false);
    expect(testEngine.getSoundFontName()).toBe('Default GM Engine');

    await testEngine.selectSource('default-gm');
    expect(testEngine.isSoundFontActive()).toBe(false);

    if (hasSfFile) {
      const buf = fs.readFileSync(sfPath);
      await testEngine.loadFromArrayBuffer(buf.buffer, 'Fluid Indian Percussion');
      // When loaded from buffer, soundfont is active
      expect(testEngine.getLoaded()).toBe(true);
    }
  });

  test('AI system instruction includes Indian percussion reference when tabla/percussion is detected', () => {
    // Plain prompt without context
    const plainPrompt = getEffectiveSystemInstruction({
      userPrompt: 'Write a smooth piano jazz ballad',
      currentLmp: '@TRACK 1 Piano\n1.0 C4 80 1.0',
    });
    expect(plainPrompt.attachedSpec).toBeNull();

    // With soundfont loaded or percussion prompt
    const tablaPrompt = getEffectiveSystemInstruction({
      userPrompt: 'Compose a fast Keherwa theka for tabla',
      currentLmp: '@TRACK 1 Tabla\n@CHANNEL 10\n@MAP Dha=60\n1.0 Dha 110',
    });

    expect(tablaPrompt.attachedSpec?.id).toBe('spec_tabla');
    expect(tablaPrompt.systemInstruction).toContain('Tabla Suite');
    expect(tablaPrompt.systemInstruction).toContain('Ge');
    expect(tablaPrompt.systemInstruction).toContain('Dha');
    expect(tablaPrompt.systemInstruction).toContain('Keherwa');

    // With explicit targetKit
    const explicitKitPrompt = getEffectiveSystemInstruction({
      targetKit: 'indian_percussion',
    });
    expect(explicitKitPrompt.attachedSpec?.id).toBe('spec_tabla');
    expect(explicitKitPrompt.systemInstruction).toContain('Tabla Suite');

    const trapPrompt = getEffectiveSystemInstruction({
      targetKit: 'trap808',
    });
    expect(trapPrompt.attachedSpec?.id).toBe('spec_gm_drums');
    expect(trapPrompt.systemInstruction).toContain('808');
  });

  test('playNoteForTrack routes per track cleanly', () => {
    if (!hasSfFile) return;

    const mockCtx: any = {
      currentTime: 1.0,
      createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
      createGain: () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }),
      createBufferSource: () => ({ buffer: null, playbackRate: { setValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }),
    };

    // Track explicitly requesting GM returns false (synth fallback)
    const gmTrack = { channel: 1, program: 0, name: 'Piano', soundfont: 'default-gm' };
    const playedGm = engine.playNoteForTrack(mockCtx, {} as any, 60, 90, 0.5, 1.0, gmTrack);
    expect(playedGm).toBe(false);

    // Track explicitly requesting Fluid Indian Percussion
    const tablaTrack = { channel: 10, program: 116, name: 'Tabla_Drums', soundfont: 'Fluid_Indian_Percussion' };
    const playedTabla = engine.playNoteForTrack(mockCtx, {} as any, 36, 110, 0.5, 1.0, tablaTrack);
    expect(playedTabla).toBe(true);
  });
});
