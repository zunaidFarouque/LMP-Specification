# Batcher Notes: Complex Drums & Modifiers

## Objective
Evaluate model reliability, syntax compliance, and failure modes for: GM Channel 10, rolls, ghost hits, hi-hat modifiers, repeating loops

## Summary Metrics
- Total Evaluated Runs: 10
- Strict Mode Validity: 9 / 10 (90.0%)
- Loose Mode Validity:  10 / 10 (100.0%)

## Case Breakdown
### drum-01-clean-modifiers: Clean repeating 16th hats with | V accent and | R rest modifiers
- Expected Category: `clean`
- Token Count: 131
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### drum-02-decimal-interval: Decimal interval in repeating note (1.0-5.0:0.25 42)
- Expected Category: `syntax_strict_error`
- Token Count: 44
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `common_llm_slip`

### drum-03-loop-endbeat-off-by-one: Loop EndBeat off-by-one (1.0-4.0:1/4 cuts off beat 4.0 in 4/4 bar)
- Expected Category: `musical_boundary_error`
- Token Count: 82
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `arithmetic_drift`

### drum-04-blank-line-before-modifier: Blank line between repeating note and | modifier (orphaned modifier)
- Expected Category: `syntax_error`
- Token Count: 50
- Strict Mode: ❌ FAIL: LMP: Orphaned modifier (|) — must follow a repeating note.
- Loose Mode: ⚠️ PASS (Recovered with warnings: LMP [loose]: Detached modifier (|) after blank line at line 8; attaching to repeating note)
- Prompt Adherence Quirk: `formatting_error`

### drum-05-modifier-commas-in-brackets: Modifier with commas inside brackets (| V [1.5, 2.5, 3.5] 110)
- Expected Category: `syntax_edge_case`
- Token Count: 60
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `punctuation_slip`

### drum-06-lowercase-modifier: Lowercase modifier token (| v [1.5 2.5] 110 and | r 2.0)
- Expected Category: `case_sensitivity_error`
- Token Count: 66
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `case_drift`

### drum-07-unmapped-drum-names: Unmapped drum names (kick, snare) without @MAP declaration
- Expected Category: `syntax_error`
- Token Count: 72
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `missing_declaration`

### drum-08-ghost-notes-seeded-rules: Ghost notes with low velocity humanization and @RULE VEL
- Expected Category: `clean`
- Token Count: 143
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### drum-09-modifier-range-hyphen: Modifier range syntax (| V [1.0-3.0] 110)
- Expected Category: `clean`
- Token Count: 54
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `high`

### drum-10-modifier-unbracketed: Modifier without brackets (| V 1.5 2.5 110)
- Expected Category: `syntax_edge_case`
- Token Count: 52
- Strict Mode: ✅ PASS
- Loose Mode: ✅ PASS
- Prompt Adherence Quirk: `syntax_drift`

