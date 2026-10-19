/**
 * LMP Empirical Stress Test Suite (Tiered Agent Architecture Simulation)
 *
 * Simulates lightweight model (Flash-Lite) variance across 5 core dimensions:
 * - Dim 1: Creative Melodic & Harmonic
 * - Dim 2: Complex Drums & Modifiers
 * - Dim 3: Translation & Reconstruction
 * - Dim 4: Production Nuance & Automation
 * - Dim 5: Polyrhythm & Odd Meter
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compile, decompile, parseMidi } from '../../compiler-js/src/index.js';
import { countTokens } from '../src/token-counter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to test compilation in strict and loose modes
function testCompile(lmpText) {
  let strictOk = false;
  let strictError = null;
  let looseOk = false;
  let looseWarnings = [];
  let looseError = null;
  let midiStrict = null;
  let midiLoose = null;

  // Strict mode
  try {
    midiStrict = compile(lmpText, { loose: false });
    strictOk = true;
  } catch (err) {
    strictError = { message: err.message, line: err.line, col: err.col };
  }

  // Loose mode
  try {
    const res = compile(lmpText, { loose: true });
    midiLoose = res.midi;
    looseWarnings = res.warnings || [];
    looseOk = true;
  } catch (err) {
    looseError = { message: err.message, line: err.line, col: err.col };
  }

  return {
    strict: { ok: strictOk, error: strictError, midiLength: midiStrict ? midiStrict.length : 0 },
    loose: { ok: looseOk, warnings: looseWarnings, error: looseError, midiLength: midiLoose ? midiLoose.length : 0 },
    tokens: countTokens(lmpText)
  };
}

// 50 Empirical Stress Test Cases
const TEST_SUITE = {
  dim1_melodic_harmonic: {
    name: 'Creative Melodic & Harmonic',
    description: 'Chords, 7ths, voice leading, syncopation, SPN variations, and legato phrasing',
    runs: [
      {
        id: 'mel-01-clean-7ths',
        name: 'Clean diatonic 7th chords with syncopated soprano melody',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Piano_Chords
@CHANNEL 1
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C4,E4,G4,B4
2.0 D4,F4,A4,C5
3.0 G3,B3,D4,F4
4.0 C4,E4,G4,B4 _ 2.0

@TRACK 2 Flute_Lead
@CHANNEL 2
@DEFAULT_VEL 95
@RULE LEGATO=TRUE

1.0 E5
1.75 G5
2.25 A5
3.0 B5
3.5 C6 _ 1.5
`
      },
      {
        id: 'mel-02-spaces-in-chord',
        name: 'Space inside comma-separated chord (C4, E4, G4, B4)',
        expectedCategory: 'syntax_error',
        promptAdherence: 'common_llm_slip',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4, E4, G4, B4 80 1.0
`
      },
      {
        id: 'mel-03-chord-symbol-hallucination',
        name: 'Hallucinated chord symbol (Cmaj7, Dm7) instead of SPN note pitches',
        expectedCategory: 'semantic_syntax_error',
        promptAdherence: 'knowledge_leak',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 Cmaj7 80 1.0
2.0 Dm7 80 1.0
3.0 G7 80 1.0
`
      },
      {
        id: 'mel-04-missing-underscore-col3',
        name: 'Missing underscore in column 3 (intended duration 2.0 interpreted as velocity 2)',
        expectedCategory: 'silent_semantic_error',
        promptAdherence: 'syntax_confusion',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@DEFAULT_VEL 85
@DEFAULT_DUR 0.25
1.0 C4 2.0
2.0 E4 2.0
`
      },
      {
        id: 'mel-05-enharmonic-accidentals',
        name: 'Enharmonic sharp and flat combinations (Eb4, F#4, Bb3, Db5)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Neo_Soul
@CHANNEL 1
1.0 Eb4,G4,Bb4,Db5 85 1.0
2.0 Ab3,C4,Eb4,Gb4 85 1.0
3.0 Db4,F4,Ab4,C5 85 1.0
`
      },
      {
        id: 'mel-06-unicode-accidentals',
        name: 'Unicode accidental symbols (E♭4, F♯4) instead of ascii b/#',
        expectedCategory: 'syntax_error',
        promptAdherence: 'typographic_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 E♭4,G4,B♭4 80 1.0
2.0 F♯4,A4,C♯5 80 1.0
`
      },
      {
        id: 'mel-07-legato-unterminated-phrase',
        name: 'Legato phrase without terminating explicit length on final note',
        expectedCategory: 'edge_case_semantic',
        promptAdherence: 'partial',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Flute
@CHANNEL 1
@RULE LEGATO=TRUE
1.0 C5
2.0 D5
3.0 E5
4.0 G5
`
      },
      {
        id: 'mel-08-multiline-continuation-plus',
        name: 'Multi-line polyphony with + continuation and varying durations',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C3 _ 4.0
+ E4,G4 _ 2.0
+ B4 _ 1.0
`
      },
      {
        id: 'mel-09-blank-line-before-continuation',
        name: 'Blank line before + continuation (triggers orphaned continuation error)',
        expectedCategory: 'syntax_error',
        promptAdherence: 'formatting_error',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C3 _ 4.0

+ E4,G4 _ 2.0
`
      },
      {
        id: 'mel-10-lowercase-spn',
        name: 'Lowercase Scientific Pitch Notation (c4, eb4, f#4)',
        expectedCategory: 'clean',
        promptAdherence: 'case_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 c4,e4,g4,b4 80 1.0
2.0 d4,f#4,a4 80 1.0
`
      }
    ]
  },

  dim2_complex_drums: {
    name: 'Complex Drums & Modifiers',
    description: 'GM Channel 10, rolls, ghost hits, hi-hat modifiers, repeating loops',
    runs: [
      {
        id: 'drum-01-clean-modifiers',
        name: 'Clean repeating 16th hats with | V accent and | R rest modifiers',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 124
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=70-85

1.0 36 120
2.0 38 115
3.0 36 118
4.0 38 115

1.0-5.0:1/4 42
| R 2.0 4.0
| V [1.5 2.5 3.5 4.5] 110
`
      },
      {
        id: 'drum-02-decimal-interval',
        name: 'Decimal interval in repeating note (1.0-5.0:0.25 42)',
        expectedCategory: 'syntax_strict_error',
        promptAdherence: 'common_llm_slip',
        lmp: `@LMP 1.0
@BPM 124
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:0.25 42 90 0.25
`
      },
      {
        id: 'drum-03-loop-endbeat-off-by-one',
        name: 'Loop EndBeat off-by-one (1.0-4.0:1/4 cuts off beat 4.0 in 4/4 bar)',
        expectedCategory: 'musical_boundary_error',
        promptAdherence: 'arithmetic_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
// Intended to fill full 4-beat bar, but 4.0 is exclusive so beat 4 is missing!
1.0-4.0:1/4 42 90 0.25
`
      },
      {
        id: 'drum-04-blank-line-before-modifier',
        name: 'Blank line between repeating note and | modifier (orphaned modifier)',
        expectedCategory: 'syntax_error',
        promptAdherence: 'formatting_error',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10

1.0-5.0:1/2 42

| R 2.0 4.0
`
      },
      {
        id: 'drum-05-modifier-commas-in-brackets',
        name: 'Modifier with commas inside brackets (| V [1.5, 2.5, 3.5] 110)',
        expectedCategory: 'syntax_edge_case',
        promptAdherence: 'punctuation_slip',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42
| V [1.5, 2.5, 3.5] 110
`
      },
      {
        id: 'drum-06-lowercase-modifier',
        name: 'Lowercase modifier token (| v [1.5 2.5] 110 and | r 2.0)',
        expectedCategory: 'case_sensitivity_error',
        promptAdherence: 'case_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42
| r 2.0 4.0
| v [1.5 2.5] 110
`
      },
      {
        id: 'drum-07-unmapped-drum-names',
        name: 'Unmapped drum names (kick, snare) without @MAP declaration',
        expectedCategory: 'syntax_error',
        promptAdherence: 'missing_declaration',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
1.0 kick 110 0.25
2.0 snare 110 0.25
3.0 kick 110 0.25
4.0 snare 110 0.25
`
      },
      {
        id: 'drum-08-ghost-notes-seeded-rules',
        name: 'Ghost notes with low velocity humanization and @RULE VEL',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 100
@SEED 42
@TRACK 1 Drums
@CHANNEL 10
@MAP kick=36
@MAP snare=38
@MAP hihat=42
@RULE hihat VEL=65-80

1.0 kick 115
1.75 snare 30 0.1 // ghost note
2.0 snare 110
2.75 snare 25 0.1 // ghost note
3.0 kick 115
4.0 snare 110
1.0-5.0:1/2 hihat
`
      },
      {
        id: 'drum-09-modifier-range-hyphen',
        name: 'Modifier range syntax (| V [1.0-3.0] 110)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/4 42
| V [1.0-3.0] 115
`
      },
      {
        id: 'drum-10-modifier-unbracketed',
        name: 'Modifier without brackets (| V 1.5 2.5 110)',
        expectedCategory: 'syntax_edge_case',
        promptAdherence: 'syntax_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
1.0-5.0:1/2 42
| V 1.5 2.5 110
`
      }
    ]
  },

  dim3_translation_reconstruction: {
    name: 'Translation & Reconstruction',
    description: 'Roundtrip fidelity, origin timeline indexing, track header validation, markdown fencing',
    runs: [
      {
        id: 'trans-01-clean-roundtrip',
        name: 'Clean two-track composition for exact roundtrip fidelity',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 110
@TIMESIG 4/4
@TRACK 1 Bass
@CHANNEL 1
@PROGRAM 33
1.0 C2 100 1.0
2.0 G2 95 1.0
3.0 A2 100 1.0
4.0 F2 95 1.0

@TRACK 2 Keys
@CHANNEL 2
@PROGRAM 4
1.0 C4,E4,G4 80 2.0
3.0 A3,C4,E4 80 2.0
`
      },
      {
        id: 'trans-02-origin-mismatch',
        name: 'Origin mismatch (@ORIGIN 1 declared, but events start at 0.0)',
        expectedCategory: 'semantic_timing_offset',
        promptAdherence: 'index_confusion',
        lmp: `@LMP 1.0
@BPM 120
@ORIGIN 1
@TRACK 1 Piano
@CHANNEL 1
0.0 C4 80 1.0
1.0 E4 80 1.0
2.0 G4 80 1.0
`
      },
      {
        id: 'trans-03-track-name-with-space',
        name: 'Track name with space (@TRACK 1 Acoustic Guitar without underscore)',
        expectedCategory: 'syntax_error',
        promptAdherence: 'regex_violation',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Acoustic Guitar
@CHANNEL 1
1.0 C4 80 1.0
`
      },
      {
        id: 'trans-04-missing-channel-track2',
        name: 'Multi-track missing @CHANNEL on Track 2 (strict error, loose warning)',
        expectedCategory: 'recoverable_strict_error',
        promptAdherence: 'missing_declaration',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0

@TRACK 2 Flute
1.0 G5 85 1.0
`
      },
      {
        id: 'trans-05-tempo-before-track',
        name: 'TEMPO meta-event placed before @TRACK 1 declaration',
        expectedCategory: 'syntax_error',
        promptAdherence: 'ordering_error',
        lmp: `@LMP 1.0
1.0 TEMPO 130.0
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0
`
      },
      {
        id: 'trans-06-triplet-quantization-drift',
        name: 'Triplet micro-timing precision (1.333, 1.667) across 4 bars',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0 C4 80 0.333
1.333 D4 80 0.333
1.667 E4 80 0.333
2.0 F4 80 0.333
2.333 G4 80 0.333
2.667 A4 80 0.333
`
      },
      {
        id: 'trans-07-track-channel-collision',
        name: 'Two tracks sharing channel 1 with conflicting programs',
        expectedCategory: 'clean_with_midi_quirk',
        promptAdherence: 'channel_assignment_overlap',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
1.0 C4 80 1.0

@TRACK 2 Strings
@CHANNEL 1
@PROGRAM 48
1.0 G4 80 1.0
`
      },
      {
        id: 'trans-08-markdown-fences-wrapping',
        name: 'LMP wrapped inside ```lmp ... ``` markdown fences with prose preamble',
        expectedCategory: 'preprocessed_clean',
        promptAdherence: 'format_adherence',
        lmp: `Here is your requested LMP music file:

\`\`\`lmp
@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4,E4,G4 80 2.0
\`\`\`

Enjoy the MIDI playback!
`
      },
      {
        id: 'trans-09-markdown-numbered-list-comment',
        name: 'Numbered list prefix in trailing comments (e.g. 1. Verse progression)',
        expectedCategory: 'clean_trailing_filter',
        promptAdherence: 'markdown_leak',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Piano
@CHANNEL 1
1.0 C4 80 1.0

Structure notes:
1. Verse progression
2. Chorus progression
`
      },
      {
        id: 'trans-10-multitrack-inherit-all',
        name: 'Track state inheritance using @INHERIT 1',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Master
@CHANNEL 1
@DEFAULT_VEL 85
@DEFAULT_DUR 0.5
@PROGRAM 0
1.0 C4 85 0.5

@TRACK 2 Slave
@CHANNEL 2
@INHERIT 1
2.0 E4
`
      }
    ]
  },

  dim4_production_nuance: {
    name: 'Production Nuance & Automation',
    description: 'CC 11 swells, CC 64 sustain, Pitch Bend slides, ordering rules, value clamping',
    runs: [
      {
        id: 'prod-01-clean-cc-and-pb',
        name: 'Clean CC64 sustain, CC11 expression swell, and Pitch Bend glide',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 70
@TRACK 1 Ambient_Pad
@CHANNEL 1
@PROGRAM 89
@PBRANGE 12

// CC Sustain Down
1.0 CC 64 127
// CC11 Expression Swell
1.0 CC 11 30
2.0 CC 11 65
3.0 CC 11 110
4.0 CC 11 40

// Pitch Bend slide
1.0 PB 0.0
2.5 PB 2.0
3.5 PB 4.0
4.0 PB 0.0

1.0 C3,G3,D4 _ 4.0
`
      },
      {
        id: 'prod-02-inverted-same-beat-ordering',
        name: 'Same-beat event ordering inverted (Note written before CC and PB)',
        expectedCategory: 'clean_compiler_reordered',
        promptAdherence: 'ordering_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
// Note declared first
1.0 C4 80 1.0
// CC declared after note on beat 1.0
1.0 CC 64 127
// PB declared after note on beat 1.0
1.0 PB 1.0
`
      },
      {
        id: 'prod-03-hanging-pitch-bend',
        name: 'Hanging Pitch Bend (PB 2.0 without explicit reset to 0.0)',
        expectedCategory: 'clean_auto_reset',
        promptAdherence: 'hanging_state',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Lead
@CHANNEL 1
@PBRANGE 2
1.0 PB 2.0
1.0 C4 80 1.0
2.0 D4 80 1.0
// Model omitted PB 0.0 reset!
`
      },
      {
        id: 'prod-04-underscore-in-cc',
        name: 'Underscore placeholder in CC row (1.0 CC 64 _ or 1.0 CC _ 127)',
        expectedCategory: 'syntax_strict_error',
        promptAdherence: 'spec_misunderstanding',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0 CC 64 _
1.0 C4 80 1.0
`
      },
      {
        id: 'prod-05-missing-col4-in-cc',
        name: 'Missing column 4 in CC row (1.0 CC 64)',
        expectedCategory: 'syntax_strict_error',
        promptAdherence: 'column_omission',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0 CC 64
1.0 C4 80 1.0
`
      },
      {
        id: 'prod-06-pb-exceeding-pbrange',
        name: 'Pitch Bend exceeding @PBRANGE (PB 7.0 when @PBRANGE is 2)',
        expectedCategory: 'clean_clamped',
        promptAdherence: 'parameter_overflow',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Lead
@CHANNEL 1
@PBRANGE 2
1.0 PB 7.0
1.0 C4 80 1.0
`
      },
      {
        id: 'prod-07-pb-with-duration-col4',
        name: 'Pitch bend with superfluous duration in Col 4 (1.0 PB 2.0 1.0)',
        expectedCategory: 'clean_col4_ignored',
        promptAdherence: 'syntax_drift',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Lead
@CHANNEL 1
1.0 PB 2.0 1.0
1.0 C4 80 1.0
`
      },
      {
        id: 'prod-08-cc-repeating-loop-hallucination',
        name: 'Hallucinated repeating loop for CC (1.0-5.0:1/4 CC 11 60)',
        expectedCategory: 'syntax_error',
        promptAdherence: 'feature_generalization_hallucination',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0-5.0:1/4 CC 11 60
`
      },
      {
        id: 'prod-09-cc-out-of-range-value',
        name: 'CC value out of 0-127 range (1.0 CC 11 150)',
        expectedCategory: 'clean_clamped',
        promptAdherence: 'range_overflow',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0 CC 11 150
1.0 C4 80 1.0
`
      },
      {
        id: 'prod-10-multiple-cc-same-beat',
        name: 'Multiple simultaneous CC messages on beat 1.0 (CC64, CC11, CC1)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TRACK 1 Synth
@CHANNEL 1
1.0 CC 64 127
1.0 CC 11 100
1.0 CC 1 64
1.0 C4 80 1.0
`
      }
    ]
  },

  dim5_polyrhythm_odd_meter: {
    name: 'Polyrhythm & Odd Meter',
    description: '7/8, 5/4 meter, bar math, 3:2 and 4:3 polyrhythms, time signature transitions',
    runs: [
      {
        id: 'odd-01-clean-7-8-progression',
        name: 'Clean 7/8 progressive metal groove (3.5 quarter notes per bar)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25

// Bar 1 (beats 1.0 to 4.5)
1.0 36 120
1.5 36 110
2.0 38 125
2.5 36 110
3.0 36 120
3.25 36 115

// Bar 2 (starts at beat 4.5, spans to 8.0)
4.5 36 120
5.0 36 110
5.5 38 125
6.0 36 110
6.5 36 120
6.75 36 115
`
      },
      {
        id: 'odd-02-bar-math-hallucination-7-8',
        name: 'Bar math error: assuming 7/8 bar is 7.0 beats (Bar 2 starting at beat 8.0)',
        expectedCategory: 'severe_musical_error',
        promptAdherence: 'rhythmic_math_hallucination',
        lmp: `@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
// LLM assumes 7/8 means 7 quarter note beats per measure!
1.0 36 120
2.0 38 120
3.0 36 120
4.0 38 120
5.0 36 120
6.0 38 120
7.0 36 120
// Bar 2 starts at beat 8.0 instead of 4.5!
8.0 36 120
`
      },
      {
        id: 'odd-03-clean-5-4-jazz',
        name: 'Clean 5/4 jazz comping (5.0 quarter notes per bar)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 160
@TIMESIG 5/4
@TRACK 1 Piano
@CHANNEL 1
// Bar 1: beats 1.0 to 6.0 (span = 5.0 beats)
1.0 C3,E3,G3,Bb3 80 1.5
2.5 F3,A3,C4,Eb4 80 1.5
4.0 G3,B3,D4,F4 80 2.0

// Bar 2: starts at beat 6.0
6.0 C3,E3,G3,Bb3 80 1.5
7.5 F3,A3,C4,Eb4 80 1.5
9.0 G3,B3,D4,F4 80 2.0
`
      },
      {
        id: 'odd-04-loop-in-7-8-fractional-boundary',
        name: 'Repeating loop spanning 7/8 bar (1.0-4.5:1/4 42)',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
// 1.0 to 4.5 step 0.25 generates 14 sixteenth notes (7 eighths)
1.0-4.5:1/4 42 90 0.2
`
      },
      {
        id: 'odd-05-loop-decimal-in-7-8',
        name: 'Repeating loop with decimal interval in 7/8 (1.0-4.5:0.5 42)',
        expectedCategory: 'syntax_strict_error',
        promptAdherence: 'common_llm_slip',
        lmp: `@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
1.0-4.5:0.5 42 90 0.2
`
      },
      {
        id: 'odd-06-triplet-polyrhythm-3-against-2',
        name: 'Triplet polyrhythm (3 against 2) within quarter notes',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Lead
@CHANNEL 1
1.0 C5 90 0.333
1.333 D5 90 0.333
1.667 E5 90 0.333
2.0 G5 95 1.0
`
      },
      {
        id: 'odd-07-cross-meter-polyrhythm-4-against-3',
        name: 'Cross-track polyrhythm: 4 beats against 3 dotted eighths',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Straight_Pulse
@CHANNEL 1
1.0 C4 80 0.8
2.0 C4 80 0.8
3.0 C4 80 0.8
4.0 C4 80 0.8

@TRACK 2 Dotted_Cross_Rhythm
@CHANNEL 2
1.0 E4 90 0.7
1.75 G4 90 0.7
2.5 B4 90 0.7
3.25 D5 90 0.7
`
      },
      {
        id: 'odd-08-timesig-shift-mid-piece',
        name: 'Mid-stream time signature modulation: 4/4 to 7/8 then back to 4/4',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 120
@TIMESIG 4/4
@TRACK 1 Synth
@CHANNEL 1

// Measure 1: 4/4 (beats 1.0 to 5.0)
1.0 C4 80 1.0
2.0 D4 80 1.0
3.0 E4 80 1.0
4.0 F4 80 1.0

// Measure 2: 7/8 (beat 5.0, spans 3.5 beats to 8.5)
5.0 TS 7 8
5.0 G4 85 0.5
5.5 A4 85 0.5
6.0 B4 85 0.5
6.5 C5 85 0.5
7.0 D5 85 0.5
7.5 E5 85 0.5
8.0 F5 85 0.5

// Measure 3: Return to 4/4 at beat 8.5
8.5 TS 4 4
8.5 G5 90 1.0
9.5 A5 90 1.0
10.5 B5 90 1.0
11.5 C6 95 1.0
`
      },
      {
        id: 'odd-09-asymmetric-accent-subdivision-7-8',
        name: 'Asymmetric 2+2+3 accent subdivision in 7/8 groove',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Bass
@CHANNEL 1
// 2 + 2 + 3 grouping: downbeats at 1.0, 2.0, 3.0
1.0 D2 110 0.5
1.5 D2 75 0.5
2.0 F2 110 0.5
2.5 F2 75 0.5
3.0 G2 115 0.5
3.5 G2 80 0.5
4.0 A2 80 0.5
`
      },
      {
        id: 'odd-10-mixed-fractional-subdivision-5-4',
        name: 'Mixed eighth and triplet subdivisions across 5/4 measures',
        expectedCategory: 'clean',
        promptAdherence: 'high',
        lmp: `@LMP 1.0
@BPM 150
@TIMESIG 5/4
@TRACK 1 Marimba
@CHANNEL 1
1.0 C4 85 0.5
1.5 D4 85 0.5
2.0 E4 85 0.333
2.333 F4 85 0.333
2.667 G4 85 0.333
3.0 A4 90 1.0
4.0 B4 90 1.0
5.0 C5 95 1.0
`
      }
    ]
  }
};

// Execute Stress Test Suite
function runStressSuite() {
  console.log('='.repeat(80));
  console.log('  LMP EMPIRICAL STRESS TEST HARNESS — LIGHTWEIGHT MODEL (FLASH_LITE) SIMULATION');
  console.log('='.repeat(80));

  const runsDir = path.join(__dirname);
  const resultsByDim = {};
  let totalRuns = 0;
  let strictPasses = 0;
  let loosePasses = 0;
  let totalTokens = 0;

  for (const [dimKey, dimData] of Object.entries(TEST_SUITE)) {
    console.log(`\n>>> [Tier 1 Orchestrator] Starting Dimension: ${dimData.name}`);
    const dimResults = [];

    for (const run of dimData.runs) {
      totalRuns++;
      const res = testCompile(run.lmp);
      if (res.strict.ok) strictPasses++;
      if (res.loose.ok) loosePasses++;
      totalTokens += res.tokens;

      const runRecord = {
        id: run.id,
        dimension: dimKey,
        name: run.name,
        expectedCategory: run.expectedCategory,
        promptAdherence: run.promptAdherence,
        tokens: res.tokens,
        strict: res.strict,
        loose: res.loose,
        rawLmp: run.lmp
      };

      dimResults.push(runRecord);

      // Write individual run file for Tier 2 batchers
      const runFilePath = path.join(runsDir, `${run.id}.json`);
      fs.writeFileSync(runFilePath, JSON.stringify(runRecord, null, 2), 'utf-8');

      const strictStatus = res.strict.ok ? 'PASS' : `FAIL (${res.strict.error?.message})`;
      const looseStatus = res.loose.ok ? (res.loose.warnings.length ? `PASS [${res.loose.warnings.length} warns]` : 'PASS') : `FAIL (${res.loose.error?.message})`;
      console.log(`  [Tier 3 Worker] ${run.id.padEnd(35)} | Strict: ${res.strict.ok ? '✓' : '✗'} | Loose: ${res.loose.ok ? '✓' : '✗'} | Tok: ${res.tokens}`);
      if (!res.strict.ok) {
        console.log(`      Strict Err: ${res.strict.error?.message}`);
      }
      if (res.loose.warnings.length) {
        console.log(`      Loose Warns: ${res.loose.warnings.join('; ')}`);
      }
    }

    resultsByDim[dimKey] = {
      name: dimData.name,
      description: dimData.description,
      totalRuns: dimData.runs.length,
      strictPass: dimResults.filter(r => r.strict.ok).length,
      loosePass: dimResults.filter(r => r.loose.ok).length,
      runs: dimResults
    };

    // Write Tier 2 batcher summary note
    const batcherNotePath = path.join(runsDir, `notes_${dimKey}.md`);
    const batcherNote = `# Batcher Notes: ${dimData.name}

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: ${dimData.description}

## Summary Metrics
- Total Evaluated Runs: ${dimData.runs.length}
- Strict Mode Validity: ${resultsByDim[dimKey].strictPass} / ${dimData.runs.length} (${((resultsByDim[dimKey].strictPass / dimData.runs.length) * 100).toFixed(1)}%)
- Loose Mode Validity:  ${resultsByDim[dimKey].loosePass} / ${dimData.runs.length} (${((resultsByDim[dimKey].loosePass / dimData.runs.length) * 100).toFixed(1)}%)

## Case Breakdown
${dimResults.map(r => `### ${r.id}: ${r.name}
- Expected Category: \`${r.expectedCategory}\`
- Token Count: ${r.tokens}
- Strict Mode: ${r.strict.ok ? '✅ PASS' : '❌ FAIL: ' + r.strict.error?.message}
- Loose Mode: ${r.loose.ok ? (r.loose.warnings.length ? '⚠️ PASS (Recovered with warnings: ' + r.loose.warnings.join(', ') + ')' : '✅ PASS') : '❌ FAIL: ' + r.loose.error?.message}
- Prompt Adherence Quirk: \`${r.promptAdherence}\`
`).join('\n')}
`;
    fs.writeFileSync(batcherNotePath, batcherNote, 'utf-8');
  }

  // Tier 1 Summary
  const tier1SummaryPath = path.join(runsDir, 'tier1_orchestrator_summary.json');
  const summaryData = {
    timestamp: new Date().toISOString(),
    totalRuns,
    strictPasses,
    strictValidityRate: `${((strictPasses / totalRuns) * 100).toFixed(1)}%`,
    loosePasses,
    looseValidityRate: `${((loosePasses / totalRuns) * 100).toFixed(1)}%`,
    totalTokens,
    avgTokensPerComposition: Math.round(totalTokens / totalRuns),
    dimensions: resultsByDim
  };
  fs.writeFileSync(tier1SummaryPath, JSON.stringify(summaryData, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(80));
  console.log('  STRESS TEST RUN COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total Runs:             ${totalRuns}`);
  console.log(`Strict Validity Rate:   ${summaryData.strictValidityRate} (${strictPasses}/${totalRuns})`);
  console.log(`Loose Validity Rate:    ${summaryData.looseValidityRate} (${loosePasses}/${totalRuns})`);
  console.log(`Total Tokens Tested:    ${totalTokens}`);
  console.log(`Results saved to:       ${runsDir}`);
  console.log('='.repeat(80));

  return summaryData;
}

runStressSuite();
