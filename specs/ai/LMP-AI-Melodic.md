# LMP — Lean Musical Protocol (AI Teaching: Melodic)

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
| Rest | `R` at beat |
| Pitch bend up 1 semitone | `X.X PB 1.0` |
| Return to center | `X.X PB 0.0` |
| Sustain pedal down | `X.X CC 64 127` |
| Expression (dynamics) | `X.X CC 11 [value]` |

## 4. Lexical Rules

- **Space-separated columns:** Data is space-delimited. One or more spaces or tabs work the same.
- **Comments:** Use `//` at the end of any line. Everything after `//` is ignored.
- **Blank line:** A blank line enters "trailing" mode. Lines that do not start with `@`, a digit, or `+` are ignored until an LMP-matching line appears again.

## 5. Event Row Format

Each event: `[Beat] [Pitch] [Velocity] [Length]`

- **Beat:** Absolute position (0.0, 1.0, 2.5). 1.0 = one quarter note. Max 3 decimal places.
- **Pitch:** Scientific Pitch Notation (C4, F#3) or reserved token (R, CC, PB, TEMPO, TS).
- **Velocity:** 1–127. Optional for notes; uses fallback when omitted.
- **Length:** Duration in beats. Optional for notes; uses fallback when omitted.

**Omitting data:** Use `_` in Column 3 when you want fallback velocity but explicit length: `1.0 C4 _ 2.0`.

## 6. Pitch Column (Melodic)

**Resolution order:** (1) Reserved tokens R, CC, PB, TEMPO, TS. (2) Scientific Pitch Notation (SPN).

- **SPN:** C4 = 60. Use sharps (F#) or flats (Gb). Case-insensitive for reserved tokens.
- **R (Rest):** Silence marker. No velocity or length. Use in Legato tracks for rests.
- **CC:** Column 3 = controller number, Column 4 = value. Both required. Common: 64 (sustain), 11 (expression). Example: `1.0 CC 64 127`.
- **PB:** Column 3 = bend in semitones (e.g. 1.0 up, -1.0 down, 0.0 center). Use `PB 0.0` to return to center before subsequent notes; pitch bend does not reset automatically.
- **TEMPO:** `X.X TEMPO 120.0`
- **TS:** `X.X TS 7 8` (time signature change)

**Same-beat ordering:** On the same beat, output CC first, then PB, then notes.

## 7. Headers

Declare before events. Each track needs `@TRACK` and `@CHANNEL`.

- `@LMP 1.0` — Version (include at top)
- `@BPM [float]` — Tempo
- `@TIMESIG [int]/[int]` — e.g. `@TIMESIG 4/4` or `@TIMESIG 7/8`
- `@TRACK [int] [Name]` — Name required (alphanumeric, underscores)
- `@CHANNEL [int]` — 1–16 (avoid 10 for melodic; it is reserved for drums)
- `@PROGRAM [int]` — MIDI patch (0–127). Optional.
- `@DEFAULT_VEL [int]` — Fallback velocity
- `@DEFAULT_DUR [float]` — Fallback duration
- `@PBRANGE [int]` — Pitch bend range in semitones (default 2)
- `@RULE LEGATO=TRUE` — Auto-calculate duration to next note (monophonic)

`@CHANNEL` does not persist across tracks. Declare it for each new track.

## 8. Advanced Features (Melodic)

**Chordal polyphony:** Comma-separated pitches, no spaces: `1.0 C4,E4,G4 85 1.0`

**Same-beat continuation (`+`):** Inherit beat from previous line for voice leading.
```
1.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
+ G4 _ 2.0
```

**Legato:** Use `@RULE LEGATO=TRUE` for monophonic phrases. Omit duration for notes before the next; the parser calculates it. Give the final note of a phrase explicit duration in Column 4. Use `R` for rests within the phrase.

## 9. Fallback Hierarchy

**Velocity:** Explicit row → @RULE for pitch → @DEFAULT_VEL → 100

**Duration:** Explicit row → @RULE DUR for pitch → Legato (if active) → @DEFAULT_DUR → 0.25

For Legato: give the final note of a phrase explicit duration in Column 4.

## 10. Examples

**Chords + legato phrase:**
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

**Voice leading with `+`:**
```LMP
@LMP 1.0
@BPM 100
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 1.0

1.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
2.0 D2 _ 4.0
+ D4,F4,A4 _ 2.0
4.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
```

## 11. Output Checklist

- Begin with `@LMP 1.0`
- Declare `@TRACK` and `@CHANNEL` before any events
- Use absolute beat numbers (0.0, 1.0, 2.5)
- Use `//` for inline comments when helpful
- Omit velocity and duration when defaults apply; use `_` when omitting velocity but specifying length
- Use `R` for rests in Legato tracks; give final Legato note explicit duration
- Use `PB 0.0` before returning to normal pitch after a bend
- Output only valid LMP; no prose mixed in
