export interface StylePreset {
  id: string;
  name: string;
  category: 'Custom' | 'Electronic' | 'Hip-Hop/Soul' | 'Acoustic/World' | 'Rock/Metal' | 'Orchestral';
  bpm: number;
  keyScale: string;
  bars: number;
  timeSig: string;
  description: string;
  prompt: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'blank',
    name: 'Blank / Custom',
    category: 'Custom',
    bpm: 120,
    keyScale: 'C Major',
    bars: 4,
    timeSig: '4/4',
    description: 'Clean canvas without pre-filled prompts or stylistic constraints.',
    prompt: '',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Darksynth',
    category: 'Electronic',
    bpm: 130,
    keyScale: 'D Minor',
    bars: 4,
    timeSig: '4/4',
    description: 'Heavy rolling 16th-note saw bass, punchy electro drums, and pitch-bent analog arps.',
    prompt: '4-bar darksynth loop with driving 16th bass in D minor, punchy 4-on-the-floor kick, snappy snare on 2 and 4, 16th hi-hats with accent rolls, and an eerie pitch-bent lead arpeggio.',
  },
  {
    id: 'lofi_chillhop',
    name: 'Lo-Fi Chillhop',
    category: 'Hip-Hop/Soul',
    bpm: 82,
    keyScale: 'Eb Major',
    bars: 4,
    timeSig: '4/4',
    description: 'Warm 7th/9th electric piano chords, relaxed swung drums with ghost snares, and vinyl vibe.',
    prompt: '4-bar mellow Lo-Fi hip hop progression in Eb Major with lush Maj7/9th Rhodes chords, laid-back boom-bap kick and snare with ghost notes (vel 40), and lazy 8th hi-hats.',
  },
  {
    id: 'neo_soul',
    name: 'Neo-Soul Groove',
    category: 'Hip-Hop/Soul',
    bpm: 90,
    keyScale: 'F# Minor',
    bars: 4,
    timeSig: '4/4',
    description: 'Sophisticated 9th/11th chord extensions, walking syncopated bass, and tight groove.',
    prompt: '4-bar soulful groove featuring sophisticated 9th and 11th chord voicings, syncopated fingerstyle bass with velocity accents, and crisp rimshot drums with swung 16th hats.',
  },
  {
    id: 'liquid_dnb',
    name: 'Liquid Drum & Bass',
    category: 'Electronic',
    bpm: 174,
    keyScale: 'F Minor',
    bars: 4,
    timeSig: '4/4',
    description: 'Fast 174 BPM rolling breakbeat, deep sub-bass slides, and atmospheric chord pads.',
    prompt: 'Fast 174 BPM 4-bar liquid dnb loop. Channel 10 fast breakbeat with ghost snares; deep 808 sub bass with pitch bends up into downbeats; and ethereal sustained minor pad chords.',
  },
  {
    id: 'math_rock',
    name: 'Polyrhythmic Math Rock',
    category: 'Rock/Metal',
    bpm: 140,
    keyScale: 'A Dorian',
    bars: 4,
    timeSig: '7/8',
    description: 'Angular 7/8 odd-meter guitar tapping arpeggios with syncopated ride cymbals.',
    prompt: '4-bar 7/8 time signature groove (@TIMESIG 7/8). Angular tapping guitar pattern in A Dorian, accented 2+2+3 rhythmic pulse, syncopated ride cymbal (51) and bell accents.',
  },
  {
    id: 'keherwa_tabla',
    name: 'Indian Tabla: Keherwa Taal',
    category: 'Acoustic/World',
    bpm: 96,
    keyScale: 'C# Minor',
    bars: 2,
    timeSig: '4/4',
    description: 'Traditional 8-matra Keherwa groove using Fluid Indian Percussion SoundFont with authentic Sam and Khali bols.',
    prompt: '2-bar Keherwa groove (8 Matras in 4/4) for Indian Percussion (@TRACK 1 Tabla_Keherwa, @CHANNEL 10). Use authentic bols: Sam on 1.0 (Dha vel 115), 2.0 Ge (vel 95), 3.0 Na (vel 90), 4.0 Ge (vel 95), Khali on 5.0 (Tin vel 80), 6.0 Ka (vel 85), 7.0 Na (vel 90), 8.0 Ge (vel 95). Include expressive @MAP definitions for Dha, Ge, Na, Tin, Ka.',
  },
  {
    id: 'teental_tabla',
    name: 'Indian Tabla: Teental Classical',
    category: 'Acoustic/World',
    bpm: 108,
    keyScale: 'C# Major',
    bars: 4,
    timeSig: '4/4',
    description: '16-matra classical Teental cycle (Dha Dhin Dhin Dha / Dha Dhin Dhin Dha / Dha Tin Tin Ta / Ta Dhin Dhin Dha).',
    prompt: '4-bar Teental cycle (16 Matras in 4/4) for Tabla (@TRACK 1 Tabla_Teental, @CHANNEL 10). Four vibhags: Bar 1 (1.0-5.0): Dha Dhin Dhin Dha; Bar 2 (5.0-9.0): Dha Dhin Dhin Dha; Bar 3 (9.0-13.0 Khali): Dha Tin Tin Ta; Bar 4 (13.0-17.0): Ta Dhin Dhin Dha. Include @MAP definitions for Dha, Dhin, Tin, Ta, Ge.',
  },
  {
    id: 'roopak_tabla',
    name: 'Indian Tabla: Roopak 7/8 Odd-Meter',
    category: 'Acoustic/World',
    bpm: 112,
    keyScale: 'D Dorian',
    bars: 2,
    timeSig: '7/8',
    description: 'Expressive 7-matra Roopak taal starting on Khali (Tin Tin Na | Dhe Na | Dhe Na) with 7/8 odd-meter.',
    prompt: '2 bars of 7/8 time signature (@TIMESIG 7/8, 1 bar = 3.5 beats) playing Roopak Taal for Indian Percussion (@TRACK 1 Tabla_Roopak, @CHANNEL 10). Phrasing: 3+2+2 subdivision. Vibhag 1 (Khali): Tin, Tin, Na; Vibhag 2: Dhin, Na; Vibhag 3: Dhin, Na. Include @MAP definitions.',
  },
  {
    id: 'acid_303',
    name: 'Acid Techno 303',
    category: 'Electronic',
    bpm: 135,
    keyScale: 'A Minor',
    bars: 4,
    timeSig: '4/4',
    description: 'Continuous 16th-note acid bassline with pitch bends, accents, and 909 kick.',
    prompt: '4-bar raw acid techno sequence with continuous 16th bass notes in A minor, alternating octave jumps, pitch bends (PB 1.0, PB -1.0) on accented 16ths, and pounding 909 kick drum on all quarter notes.',
  },
];
