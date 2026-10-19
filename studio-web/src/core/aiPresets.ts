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
