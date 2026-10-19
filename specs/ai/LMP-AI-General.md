# LMP — Lean Musical Protocol (AI Teaching: General)

## 1. Adapter Preamble

You retain your full identity, expertise, and creative voice. This document adds a new output format: LMP. Use it when the user asks for MIDI output.

Musical decisions (what to play, phrasing, style) stay in your domain. LMP syntax (how to encode it) is the taught capability. When outputting MIDI, use LMP syntax as follows.

## 2. Output Context

LMP is a text format that compiles to binary MIDI. The user's environment parses your LMP output and turns it into playable MIDI in the browser. Output only valid LMP; no prose mixed in.

## 3. Musical Concept → LMP Quick Reference

| Musical Idea | LMP Construct |
|--------------|----------------|
| Downbeat, measure | Beat 0.0, 1.0, 2.0... (1 beat = 1 quarter note; 4/4 measure = 4 beats; 7/8 measure = 3.5 beats) |
| Single note at beat 1 | `1.0 C4` |
| Chord at beat 1 | `1.0 C4,E4,G4` |
| Legato phrase | `@RULE LEGATO=TRUE`, omit duration for notes before the next |
| Rest / silence | `R` at beat |
| Pitch bend up 1 semitone | `X.X PB 1.0` |
| Return to center | `X.X PB 0.0` |
| Sustain pedal down | `X.X CC 64 127` |
| Kick on 1 and 3 | `1.0 36`, `3.0 36` |
| Snare on 2 and 4 | `2.0 38`, `4.0 38` |
| Eighth-note hi-hats | `1.0-5.0:1/2 42` |
| Skip beats 2 and 4 | `\| R 2.0 4.0` |
| Accent beats 1 and 3 | `\| V [1.0 3.0] 110` |
| Ghost note | Explicit lower velocity (e.g. 45) |
| Custom drum name | `@MAP kick=36` then `1.0 kick` |

## 4. Lexical Rules

- **Space-separated columns:** Data is space-delimited. One or more spaces or tabs work the same.
- **Comments:** Use `//` at the end of any line. Everything after `//` is ignored.
- **Blank line:** A blank line enters "trailing" mode. Lines that do not start with `@`, a digit, `+`, or `|` are ignored until an LMP-matching line appears again.

## 5. Event Row Format

Each event: `[Beat] [Pitch] [Velocity] [Length]`

- **Beat:** Absolute position (0.0, 1.0, 2.5). 1.0 = one quarter note. Max 3 decimal places.
- **Pitch:** Note (SPN or GM integer or @MAP name) or reserved token (R, CC, PB, TEMPO, TS).
- **Velocity:** 1–127. Optional for notes; uses fallback when omitted.
- **Length:** Duration in beats. Optional for notes; uses fallback when omitted.

**Omitting data:** Use `_` in Column 3 when you want fallback velocity but explicit length: `1.0 C4 _ 2.0`.
- **CRITICAL Column 3 `_` Placeholder Rule:** Column 3 is ALWAYS Velocity, and Column 4 is ALWAYS Duration. If you omit velocity while specifying duration, you MUST write `_` in Column 3: `1.0 C4 _ 2.0`. NEVER write `1.0 C4 2.0` (which erroneously interprets `2.0` as velocity 2, making the note silent).
- **CRITICAL Negative Constraint — No Spaces in Chords:** In Column 2 chords, NEVER put spaces after commas. Always write `1.0 C4,E4,G4 80 1.0`, NEVER `1.0 C4, E4, G4 80 1.0`. Spaces break column alignment.

## 6. Pitch Column

**Resolution order:** (1) Reserved tokens R, CC, PB, TEMPO, TS — always first. (2) Scientific Pitch Notation (C4, F#3). (3) General MIDI integer (36, 42). (4) @MAP name. Use alphanumeric names for @MAP (e.g. kick, snare). Reserved tokens cannot be @MAP names.

- **Tonal:** SPN. C4 = 60.
- **Percussive:** GM integers (36 = kick, 38 = snare, 42 = closed hi-hat, 46 = open hi-hat).
- **R (Rest):** Silence marker. No velocity or length. Use in Legato tracks for rests.
- **CC:** Column 3 = controller number, Column 4 = value. Both required. Example: `1.0 CC 64 127` (sustain).
- **PB:** Column 3 = bend in semitones. Pitch bends automatically reset to center (0.0) at the end of the note duration, but explicit `PB 0.0` can also be emitted.
- **TEMPO:** `X.X TEMPO 120.0`
- **TS:** `X.X TS 7 8` (time signature change)

**Same-beat ordering:** On the same beat, output CC first, then PB, then notes.

## 7. Headers

Declare before events. Each track needs `@TRACK` and `@CHANNEL`.

- `@LMP 1.0` — Version (include at top)
- `@BPM [float]` — Tempo
- `@TIMESIG [int]/[int]` — e.g. `@TIMESIG 4/4` or `@TIMESIG 7/8`
- `@ORIGIN [0|1]` — Timeline start index (default `1` for 1-based downbeats; `0` for 0-based DAWs)
- `@SEED [int]` — Deterministic PRNG seed for `@RULE VEL` humanization
- `@TRACK [int] [Name]` — Name required (alphanumeric, underscores)
- `@CHANNEL [int]` — 1–16. Channel 10 for drums.
- `@PROGRAM [int]` — MIDI patch (0–127). Optional.
- `@DEFAULT_VEL [int]` — Fallback velocity
- `@DEFAULT_DUR [float]` — Fallback duration
- `@PBRANGE [int]` — Pitch bend range in semitones (default 2)
- `@MAP [Name]=[Integer]` — Custom pitch name. Name: alphanumeric, underscores, no leading digit.
- `@RULE [Pitch] VEL=[min]-[max]` — Randomize velocity within range when omitted
- `@RULE [Pitch] DUR=[float]` — Fixed duration for pitch
- `@RULE LEGATO=TRUE` — Auto-calculate duration to next note (monophonic)

`@CHANNEL` does not persist across tracks. Declare it for each new track.

## 8. Advanced Features

**Chordal polyphony:** Comma-separated pitches with STRICTLY NO SPACES: `1.0 C4,E4,G4 85 1.0`. Negative constraint: NEVER insert spaces after commas in chords (e.g. `C4, E4, G4` is forbidden; always format as `C4,E4,G4`).

**Same-beat continuation (`+`):** Inherit beat from previous line. Use only after a regular note (single beat), not after repeating syntax.
```
1.0 C5 _ 4.0
+ E5,G5 _ 2.0
```

**Repeating notes:** `[StartBeat]-[EndBeat]:[interval]` — interval as fraction (1/2, 1/4) or integer only. DO NOT USE DECIMALS for the interval (e.g., :0.5 is invalid). Generates notes from StartBeat up to (but strictly NOT including) EndBeat. To fill a 4-beat measure, your EndBeat must be 5.0. Use `|` for modifiers; use `|` only after repeating syntax, not after regular notes.
```
1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 3.0] 110
```

**Modifiers:** `| R` (skip beats), `| V` (velocity override), `| D` (duration override). Uppercase R, V, D.

## 9. Fallback Hierarchy

**Velocity:** Explicit row → @RULE for pitch → @DEFAULT_VEL → 100

**Duration:** Explicit row → @RULE DUR for pitch → Legato (if active) → @DEFAULT_DUR → 0.25

For Legato: give the final note of a phrase explicit duration in Column 4.

## 10. Examples

**Melodic (chords + legato phrase):**
```LMP
@LMP 1.0
@BPM 120
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

1.0 C4,E4,G4
2.0 D4,F4,A4 95
3.0 C4,E4,G4 _ 2.0

@TRACK 2 Solo_Flute
@CHANNEL 2
@PROGRAM 73
@DEFAULT_VEL 90
@RULE LEGATO=TRUE

1.0 C5
1.5 D5
2.0 E5
3.0 C5 _ 2.0
```

**Percussive (hi-hat + kick-snare):**
```LMP
@LMP 1.0
@BPM 110
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=70-85

1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 3.0] 110

1.0 36 110
2.0 38
3.0 36 110
4.0 38
```

**Odd-Meter (7/8 Progressive Groove):**
Remember: 1 measure of 7/8 = 7 eighth notes = 3.5 quarter-note beats!
- Bar 1 spans beats 1.0 to 4.5
- Bar 2 begins at beat 4.5 and spans to 8.0
```LMP
@LMP 1.0
@BPM 140
@TIMESIG 7/8
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_DUR 0.25

// Measure 1 (beats 1.0 to 4.5, total 3.5 beats)
1.0 36 120
1.5 36 110
2.0 38 125
2.5 36 110
3.0 36 120
3.25 36 115

// Measure 2 (starts at beat 4.5, spans to 8.0)
4.5 36 120
5.0 36 110
5.5 38 125
6.0 36 110
6.5 36 120
6.75 36 115
```

## 11. Output Checklist

- Wrap code blocks inside \`\`\`lmp ... \`\`\` code fence for instant player detection
- Begin with `@LMP 1.0`
- Declare `@TRACK [id] [Name]` and `@CHANNEL [1-16]` before any events
- Use absolute beat numbers (0.0, 1.0, 2.5). Beat 1.0 = downbeat in default `@ORIGIN 1`
- **Negative constraint:** NEVER put spaces inside chords (write `C4,E4,G4`, NEVER `C4, E4, G4`)
- **Column 3 placeholder:** Always use `_` when omitting velocity but specifying duration (`1.0 C4 _ 2.0`, never `1.0 C4 2.0`)
- **Odd meter math:** In 7/8 time, 1 bar = 3.5 beats (Bar 1: 1.0 to 4.5, Bar 2: 4.5 to 8.0)
- Repeating notes: use fractional intervals (`:1/2`, `:1/4`, `:1/8`), never decimals (`:0.5` is invalid)
- Remember that loop EndBeat is exclusive (`1.0-5.0:1/2` fills a 4-beat bar)
- Use `//` for inline comments when helpful
- Omit velocity and duration when defaults apply; use `_` when omitting velocity but specifying length
- Output only valid LMP; no conversational prose mixed into the code block
