# Batcher Notes: Production Nuance & Automation

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: CC 11 swells, CC 64 sustain, Pitch Bend slides, ordering rules, value clamping

## Summary Metrics
- Total Evaluated Runs: 10
- Strict Mode Validity: 8 / 10 (80.0%)
- Loose Mode Validity:  10 / 10 (100.0%)

## Case Breakdown
### prod-01-clean-cc-and-pb: Clean CC64 sustain, CC11 expression swell, and Pitch Bend glide
- Expected Category: `clean`
- Token Count: 168
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### prod-02-inverted-same-beat-ordering: Same-beat event ordering inverted (Note written before CC and PB)
- Expected Category: `clean_compiler_reordered`
- Token Count: 101
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `ordering_drift`

### prod-03-hanging-pitch-bend: Hanging Pitch Bend (PB 2.0 without explicit reset to 0.0)
- Expected Category: `clean_auto_reset`
- Token Count: 80
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `hanging_state`

### prod-04-underscore-in-cc: Underscore placeholder in CC row (1.0 CC 64 _ or 1.0 CC _ 127)
- Expected Category: `syntax_strict_error`
- Token Count: 46
- Strict Mode: ❌ FAIL: LMP: CC requires numeric controller number and value; underscore is invalid.
- Loose Mode: ⚠️ PASS (Recovered with warnings: LMP [loose]: Invalid CC row at beat 1 (underscore invalid); skipping)
- Prompt Adherence Quirk: `spec_misunderstanding`

### prod-05-missing-col4-in-cc: Missing column 4 in CC row (1.0 CC 64)
- Expected Category: `syntax_strict_error`
- Token Count: 45
- Strict Mode: ❌ FAIL: LMP: CC requires both controller number (column 3) and value (column 4).
- Loose Mode: ⚠️ PASS (Recovered with warnings: LMP [loose]: Invalid CC row at beat 1 (missing controller number or value); skipping)
- Prompt Adherence Quirk: `column_omission`

### prod-06-pb-exceeding-pbrange: Pitch Bend exceeding @PBRANGE (PB 7.0 when @PBRANGE is 2)
- Expected Category: `clean_clamped`
- Token Count: 52
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `parameter_overflow`

### prod-07-pb-with-duration-col4: Pitch bend with superfluous duration in Col 4 (1.0 PB 2.0 1.0)
- Expected Category: `clean_col4_ignored`
- Token Count: 51
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `syntax_drift`

### prod-08-cc-repeating-loop-hallucination: Hallucinated repeating loop for CC (1.0-5.0:1/4 CC 11 60)
- Expected Category: `syntax_error`
- Token Count: 42
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `feature_generalization_hallucination`

### prod-09-cc-out-of-range-value: CC value out of 0-127 range (1.0 CC 11 150)
- Expected Category: `clean_clamped`
- Token Count: 47
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `range_overflow`

### prod-10-multiple-cc-same-beat: Multiple simultaneous CC messages on beat 1.0 (CC64, CC11, CC1)
- Expected Category: `clean`
- Token Count: 67
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

