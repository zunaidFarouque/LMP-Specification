# Batcher Notes: Translation & Reconstruction

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: Roundtrip fidelity, origin timeline indexing, track header validation, markdown fencing

## Summary Metrics
- Total Evaluated Runs: 10
- Strict Mode Validity: 8 / 10 (80.0%)
- Loose Mode Validity:  9 / 10 (90.0%)

## Case Breakdown
### trans-01-clean-roundtrip: Clean two-track composition for exact roundtrip fidelity
- Expected Category: `clean`
- Token Count: 143
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### trans-02-origin-mismatch: Origin mismatch (@ORIGIN 1 declared, but events start at 0.0)
- Expected Category: `semantic_timing_offset`
- Token Count: 68
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `index_confusion`

### trans-03-track-name-with-space: Track name with space (@TRACK 1 Acoustic Guitar without underscore)
- Expected Category: `syntax_error`
- Token Count: 39
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `regex_violation`

### trans-04-missing-channel-track2: Multi-track missing @CHANNEL on Track 2 (strict error, loose warning)
- Expected Category: `recoverable_strict_error`
- Token Count: 57
- Strict Mode: ❌ FAIL: LMP: Each track must declare @CHANNEL before events.
- Loose Mode: ⚠️ PASS (Recovered with warnings: LMP [loose]: Track 2 (Flute) missing @CHANNEL; assuming channel 1)
- Prompt Adherence Quirk: `missing_declaration`

### trans-05-tempo-before-track: TEMPO meta-event placed before @TRACK 1 declaration
- Expected Category: `syntax_error`
- Token Count: 42
- Strict Mode: ❌ FAIL: LMP: Events must appear after at least one @TRACK declaration.
- Loose Mode: ❌ FAIL: LMP: Events must appear after at least one @TRACK declaration.
- Prompt Adherence Quirk: `ordering_error`

### trans-06-triplet-quantization-drift: Triplet micro-timing precision (1.333, 1.667) across 4 bars
- Expected Category: `clean`
- Token Count: 102
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### trans-07-track-channel-collision: Two tracks sharing channel 1 with conflicting programs
- Expected Category: `clean_with_midi_quirk`
- Token Count: 72
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `channel_assignment_overlap`

### trans-08-markdown-fences-wrapping: LMP wrapped inside ```lmp ... ``` markdown fences with prose preamble
- Expected Category: `preprocessed_clean`
- Token Count: 72
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `format_adherence`

### trans-09-markdown-numbered-list-comment: Numbered list prefix in trailing comments (e.g. 1. Verse progression)
- Expected Category: `clean_trailing_filter`
- Token Count: 56
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `markdown_leak`

### trans-10-multitrack-inherit-all: Track state inheritance using @INHERIT 1
- Expected Category: `clean`
- Token Count: 80
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

