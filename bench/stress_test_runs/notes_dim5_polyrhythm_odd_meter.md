# Batcher Notes: Polyrhythm & Odd Meter

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: 7/8, 5/4 meter, bar math, 3:2 and 4:3 polyrhythms, time signature transitions

## Summary Metrics
- Total Evaluated Runs: 10
- Strict Mode Validity: 10 / 10 (100.0%)
- Loose Mode Validity:  10 / 10 (100.0%)

## Case Breakdown
### odd-01-clean-7-8-progression: Clean 7/8 progressive metal groove (3.5 quarter notes per bar)
- Expected Category: `clean`
- Token Count: 182
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-02-bar-math-hallucination-7-8: Bar math error: assuming 7/8 bar is 7.0 beats (Bar 2 starting at beat 8.0)
- Expected Category: `severe_musical_error`
- Token Count: 145
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `rhythmic_math_hallucination`

### odd-03-clean-5-4-jazz: Clean 5/4 jazz comping (5.0 quarter notes per bar)
- Expected Category: `clean`
- Token Count: 211
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-04-loop-in-7-8-fractional-boundary: Repeating loop spanning 7/8 bar (1.0-4.5:1/4 42)
- Expected Category: `clean`
- Token Count: 83
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-05-loop-decimal-in-7-8: Repeating loop with decimal interval in 7/8 (1.0-4.5:0.5 42)
- Expected Category: `syntax_strict_error`
- Token Count: 51
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `common_llm_slip`

### odd-06-triplet-polyrhythm-3-against-2: Triplet polyrhythm (3 against 2) within quarter notes
- Expected Category: `clean`
- Token Count: 83
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-07-cross-meter-polyrhythm-4-against-3: Cross-track polyrhythm: 4 beats against 3 dotted eighths
- Expected Category: `clean`
- Token Count: 150
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-08-timesig-shift-mid-piece: Mid-stream time signature modulation: 4/4 to 7/8 then back to 4/4
- Expected Category: `clean`
- Token Count: 328
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-09-asymmetric-accent-subdivision-7-8: Asymmetric 2+2+3 accent subdivision in 7/8 groove
- Expected Category: `clean`
- Token Count: 155
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### odd-10-mixed-fractional-subdivision-5-4: Mixed eighth and triplet subdivisions across 5/4 measures
- Expected Category: `clean`
- Token Count: 135
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

