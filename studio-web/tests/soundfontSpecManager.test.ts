import { describe, test, expect, beforeEach } from 'bun:test';
import {
  soundFontSpecManager,
  BUILTIN_SPECS,
  BUILTIN_BINDINGS,
  type SpecDocument,
  type SoundFontProgramBinding,
} from '../src/core/soundfontSpecManager';
import { getEffectiveSystemInstruction } from '../src/core/aiService';

describe('SoundFont & Instrument Specification Manager', () => {
  beforeEach(() => {
    soundFontSpecManager.resetSpecsToDefault();
    soundFontSpecManager.resetBindingsToDefault();
  });

  test('loads all built-in instrument specifications from ecosystem', () => {
    const specs = soundFontSpecManager.getSpecs();
    expect(specs.length).toBeGreaterThanOrEqual(8);

    const ids = specs.map((s) => s.id);
    expect(ids).toContain('spec_tabla');
    expect(ids).toContain('spec_dholak');
    expect(ids).toContain('spec_khol');
    expect(ids).toContain('spec_mridangam');
    expect(ids).toContain('spec_pakhawaj');
    expect(ids).toContain('spec_kanjeera_ghatam');
    expect(ids).toContain('spec_folk_auxiliary');
    expect(ids).toContain('spec_gm_drums');

    const dholakSpec = soundFontSpecManager.getSpec('spec_dholak');
    expect(dholakSpec).toBeDefined();
    expect(dholakSpec?.title).toContain('Dholak');
    expect(dholakSpec?.content).toContain('Dhum');
    expect(dholakSpec?.content).toContain('Keherwa');

    const tablaSpec = soundFontSpecManager.getSpec('spec_tabla');
    expect(tablaSpec).toBeDefined();
    expect(tablaSpec?.title).toContain('Tabla');
    expect(tablaSpec?.content).toContain('Keherwa');
    expect(tablaSpec?.content).toContain('Teental');
    expect(tablaSpec?.content).toContain('Roopak');
    expect(tablaSpec?.content).toContain('LMP Implementation Rules');
    // Ensure host developer code snippets (C++, Python, TypeScript) are stripped from AI spec
    expect(tablaSpec?.content).not.toContain('import fluidsynth');
    expect(tablaSpec?.content).not.toContain('SpessaSynthEngine');
    expect(tablaSpec?.content).not.toContain('Option A: Loading in Web Audio');
  });

  test('programMatches correctly handles single programs, lists, ranges, and wildcards', () => {
    expect(soundFontSpecManager.programMatches(117, '117')).toBe(true);
    expect(soundFontSpecManager.programMatches(116, '117')).toBe(false);

    expect(soundFontSpecManager.programMatches(116, '116, 117, 118')).toBe(true);
    expect(soundFontSpecManager.programMatches(118, '116, 117, 118')).toBe(true);
    expect(soundFontSpecManager.programMatches(120, '116, 117, 118')).toBe(false);

    expect(soundFontSpecManager.programMatches(5, '0-11')).toBe(true);
    expect(soundFontSpecManager.programMatches(0, '0-11')).toBe(true);
    expect(soundFontSpecManager.programMatches(11, '0-11')).toBe(true);
    expect(soundFontSpecManager.programMatches(12, '0-11')).toBe(false);

    expect(soundFontSpecManager.programMatches(45, '*')).toBe(true);
  });

  test('dynamically matches Tabla specification for Program 116 or Tabla track', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Indian_Tabla',
      soundfont: 'Fluid_Indian_Percussion',
      channel: 10,
      program: 116,
    });
    expect(result.spec?.id).toBe('spec_tabla');
    expect(result.isOverridden).toBe(false);
  });

  test('dynamically matches Dholak specification for Program 117 or Dholak track', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Qawwali_Dholak',
      soundfont: 'Fluid_Folk_Percussion',
      channel: 10,
      program: 117,
    });
    expect(result.spec?.id).toBe('spec_dholak');
    expect(result.spec?.fileName).toBe('readme_Dholak.md');
  });

  test('dynamically matches Mridangam specification for Program 120 or Carnatic track', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Carnatic_Rhythm',
      soundfont: 'Fluid_Carnatic_Percussion',
      channel: 10,
      program: 120,
    });
    expect(result.spec?.id).toBe('spec_mridangam');
    expect(result.spec?.title).toContain('Mridangam');
  });

  test('dynamically matches Khol specification for Program 118', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Kirtan_Groove',
      soundfont: 'Fluid_Folk_Percussion',
      channel: 10,
      program: 118,
    });
    expect(result.spec?.id).toBe('spec_khol');
    expect(result.spec?.fileName).toBe('readme_Khol.md');
  });

  test('dynamically matches General MIDI drums for Channel 10 with GM program', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Acoustic_Drums',
      soundfont: 'default-gm',
      channel: 10,
      program: 0,
    });
    expect(result.spec?.id).toBe('spec_gm_drums');
  });

  test('returns null for purely melodic / harmonic tracks to save prompt tokens', () => {
    const result = soundFontSpecManager.matchSpecForTrack({
      name: 'Grand_Piano',
      soundfont: 'default-gm',
      channel: 1,
      program: 0,
    });
    expect(result.spec).toBeNull();
    expect(result.reason).toContain('Melodic or harmonic');
  });

  test('respects explicit user override over auto-detection', () => {
    const result = soundFontSpecManager.matchSpecForTrack(
      {
        name: 'Grand_Piano',
        soundfont: 'default-gm',
        channel: 1,
        program: 0,
      },
      'spec_pakhawaj'
    );
    expect(result.spec?.id).toBe('spec_pakhawaj');
    expect(result.isOverridden).toBe(true);
  });

  test('respects explicit "none" selection to strip all instrument specs', () => {
    const result = soundFontSpecManager.matchSpecForTrack(
      {
        name: 'Indian_Tabla',
        soundfont: 'Fluid_Indian_Percussion',
        channel: 10,
        program: 116,
      },
      'none'
    );
    expect(result.spec).toBeNull();
    expect(result.isOverridden).toBe(true);
  });

  test('supports importing custom user markdown specifications', () => {
    const customDoc = soundFontSpecManager.importMarkdownFile(
      'readme_Custom_Congas.md',
      '# Congas Specification\n@MAP Tumbao=60\n@MAP Slap=62',
      'Latin Congas Suite'
    );

    expect(customDoc.id).toContain('spec_custom_readme_custom_congas');
    expect(customDoc.title).toBe('Latin Congas Suite');
    expect(soundFontSpecManager.getSpec(customDoc.id)).toBeDefined();

    // Bind custom spec to program 124
    soundFontSpecManager.saveBinding({
      id: 'bind_custom_congas',
      soundfontId: 'Custom_Latin_Percussion',
      soundfontName: 'Custom Latin Percussion',
      programRange: '124',
      bank: '*',
      channel: 10,
      specId: customDoc.id,
      description: 'Latin Congas Tumbao & Slap',
      isBuiltIn: false,
    });

    const match = soundFontSpecManager.matchSpecForTrack({
      name: 'Salsa_Congas',
      soundfont: 'Custom_Latin_Percussion',
      channel: 10,
      program: 124,
    });

    expect(match.spec?.id).toBe(customDoc.id);
    expect(match.spec?.content).toContain('@MAP Tumbao=60');
  });

  test('getEffectiveSystemInstruction attaches ONLY the targeted instrument specification', () => {
    // 1. When targeting Dholak:
    const dholakRes = getEffectiveSystemInstruction({
      targetTrack: {
        name: 'Dholak_Beat',
        channel: 10,
        program: 117,
        soundfont: 'Fluid_Folk_Percussion',
      },
    });

    expect(dholakRes.attachedSpec?.id).toBe('spec_dholak');
    expect(dholakRes.systemInstruction).toContain('Dholak Studio');
    // Ensure it does NOT contain other irrelevant specs (token isolation):
    expect(dholakRes.systemInstruction).not.toContain('Mridangam Studio Specification');
    expect(dholakRes.systemInstruction).not.toContain('Khol Studio Specification');

    // 2. When targeting Mridangam:
    const mridangamRes = getEffectiveSystemInstruction({
      targetTrack: {
        name: 'Carnatic_Track',
        channel: 10,
        program: 120,
        soundfont: 'Fluid_Carnatic_Percussion',
      },
    });
    expect(mridangamRes.attachedSpec?.id).toBe('spec_mridangam');
    expect(mridangamRes.systemInstruction).toContain('Mridangam Studio Specification');
    expect(mridangamRes.systemInstruction).not.toContain('Dholak Studio Specification');

    // 3. When targeting piano with none:
    const pianoRes = getEffectiveSystemInstruction({
      targetTrack: { name: 'Piano', channel: 1, program: 0 },
      selectedSpecId: 'none',
    });
    expect(pianoRes.attachedSpec).toBeNull();
    expect(pianoRes.systemInstruction).not.toContain('ATTACHED INSTRUMENT SPECIFICATION');
  });
});
