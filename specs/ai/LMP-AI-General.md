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

## 6. Pitch Column

**Resolution order:** (1) Reserved tokens R, CC, PB, TEMPO, TS — always first. (2) Scientific Pitch Notation (C4, F#3). (3) General MIDI integer (36, 42). (4) @MAP name. Use alphanumeric names for @MAP (e.g. kick, snare). Reserved tokens cannot be @MAP names.

- **Tonal:** SPN. C4 = 60.
- **Percussive:** GM integers (36 = kick, 38 = snare, 42 = closed hi-hat, 46 = open hi-hat).
- **R (Rest):** Silence marker. No velocity or length. Use in Legato tracks for rests.
- **CC:** Column 3 = controller number, Column 4 = value. Both required. Example: `1.0 CC 64 127` (sustain).
- **PB:** Column 3 = bend in semitones. Use `PB 0.0` to return to center before subsequent notes.
- **TEMPO:** `X.X TEMPO 120.0`
- **TS:** `X.X TS 7 8` (time signature change)

**Same-beat ordering:** On the same beat, output CC first, then PB, then notes.

## 7. Headers

Declare before events. Each track needs `@TRACK` and `@CHANNEL`.

- `@LMP 1.0` — Version (include at top)
- `@BPM [float]` — Tempo
- `@TIMESIG [int]/[int]` — e.g. `@TIMESIG 4/4` or `@TIMESIG 7/8`
- `@TRACK [int] [Name]` — Name required (alphanumeric, underscores)
- `@CHANNEL [int]` — 1–16. Channel 10 for drums.
- `@PROGRAM [int]` — MIDI patch (0–127). Optional.
- `@DEFAULT_VEL [int]` — Fallback velocity
- `@DEFAULT_DUR [float]` — Fallback duration
- `@PBRANGE [int]` — Pitch bend range in semitones (default 2)
- `@MAP [Name]=[Integer]` — Custom pitch name. Name: alphanumeric, underscores, no leading digit.
- `@RULE [Pitch] VEL=[min]-[max]` — Randomize velocity when omitted
- `@RULE [Pitch] DUR=[float]` — Fixed duration for pitch
- `@RULE LEGATO=TRUE` — Auto-calculate duration to next note (monophonic)

`@CHANNEL` does not persist across tracks. Declare it for each new track.

## 8. Advanced Features

**Chordal polyphony:** Comma-separated pitches, no spaces: `1.0 C4,E4,G4 85 1.0`

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

## 11. Output Checklist

- Begin with `@LMP 1.0`
- Declare `@TRACK` and `@CHANNEL` before any events
- Use absolute beat numbers (0.0, 1.0, 2.5)
- Use `//` for inline comments when helpful
- Omit velocity and duration when defaults apply; use `_` when omitting velocity but specifying length
- Use `PB 0.0` before returning to normal pitch after a bend
- Output only valid LMP; no prose mixed in
