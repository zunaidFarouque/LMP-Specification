# Batcher Notes: Creative Melodic & Harmonic

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: Chords, 7ths, voice leading, syncopation, SPN variations, and legato phrasing

## Summary Metrics
- Total Evaluated Runs: 10
- Strict Mode Validity: 9 / 10 (90.0%)
- Loose Mode Validity:  10 / 10 (100.0%)

## Case Breakdown
### mel-01-clean-7ths: Clean diatonic 7th chords with syncopated soprano melody
- Expected Category: `clean`
- Token Count: 181
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### mel-02-spaces-in-chord: Space inside comma-separated chord (C4, E4, G4, B4)
- Expected Category: `syntax_error`
- Token Count: 49
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `common_llm_slip`

### mel-03-chord-symbol-hallucination: Hallucinated chord symbol (Cmaj7, Dm7) instead of SPN note pitches
- Expected Category: `semantic_syntax_error`
- Token Count: 63
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `knowledge_leak`

### mel-04-missing-underscore-col3: Missing underscore in column 3 (intended duration 2.0 interpreted as velocity 2)
- Expected Category: `silent_semantic_error`
- Token Count: 60
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `syntax_confusion`

### mel-05-enharmonic-accidentals: Enharmonic sharp and flat combinations (Eb4, F#4, Bb3, Db5)
- Expected Category: `clean`
- Token Count: 91
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### mel-06-unicode-accidentals: Unicode accidental symbols (E♭4, F♯4) instead of ascii b/#
- Expected Category: `syntax_error`
- Token Count: 66
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `typographic_drift`

### mel-07-legato-unterminated-phrase: Legato phrase without terminating explicit length on final note
- Expected Category: `edge_case_semantic`
- Token Count: 59
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `partial`

### mel-08-multiline-continuation-plus: Multi-line polyphony with + continuation and varying durations
- Expected Category: `clean`
- Token Count: 59
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### mel-09-blank-line-before-continuation: Blank line before + continuation (triggers orphaned continuation error)
- Expected Category: `syntax_error`
- Token Count: 49
- Strict Mode: ❌ FAIL: LMP: Orphaned same-beat continuation (+).
- Loose Mode: ⚠️ PASS (Recovered with warnings: LMP [loose]: Detached continuation (+) after blank line at line 7; attaching to beat 1)
- Prompt Adherence Quirk: `formatting_error`

### mel-10-lowercase-spn: Lowercase Scientific Pitch Notation (c4, eb4, f#4)
- Expected Category: `clean`
- Token Count: 66
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `case_drift`

