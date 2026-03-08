# LMP — Lean Musical Protocol (AI Teaching: Percussive)

## 1. Adapter Preamble

You retain your full identity, expertise, and creative voice. This document adds a new output format: LMP. Use it when the user asks for MIDI output.

Musical decisions (what to play, groove, style) stay in your domain. LMP syntax (how to encode it) is the taught capability. When outputting MIDI, use LMP syntax as follows.

## 2. Output Context

LMP is a text format that compiles to binary MIDI. The user's environment parses your LMP output and turns it into playable MIDI in the browser. Output only valid LMP; no prose mixed in.

## 3. Musical Concept → LMP Quick Reference

| Musical Idea | LMP Construct |
|--------------|----------------|
| Downbeat, measure | Beat 0.0, 1.0, 2.0... (1 beat = 1 quarter note; 4/4 measure = 4 beats; 7/8 measure = 3.5 beats) |
| Kick on 1 and 3 | `1.0 36`, `3.0 36` |
| Snare on 2 and 4 | `2.0 38`, `4.0 38` |
| Eighth-note hi-hats | `1.0-5.0:1/2 42` |
| Skip beats 2 and 4 | `\| R 2.0 4.0` |
| Accent beats 1 and 3 | `\| V [1.0 3.0] 110` |
| Ghost note | Explicit lower velocity (e.g. 45) |
| Custom drum name | `@MAP kick=36` then `1.0 kick` |
| Vary hi-hat velocity | `@RULE 42 VEL=70-85` |

## 4. Lexical Rules

- **Space-separated columns:** Data is space-delimited. One or more spaces or tabs work the same.
- **Comments:** Use `//` at the end of any line. Everything after `//` is ignored.
- **Blank line:** A blank line enters "trailing" mode. Lines that do not start with `@`, a digit, or `|` are ignored until an LMP-matching line appears again.

## 5. Event Row Format

Each event: `[Beat] [Pitch] [Velocity] [Length]`

- **Beat:** Absolute position (0.0, 1.0, 2.5). 1.0 = one quarter note. Max 3 decimal places.
- **Pitch:** General MIDI integer (36, 38, 42...) or @MAP name.
- **Velocity:** 1–127. Optional for notes; uses fallback when omitted.
- **Length:** Duration in beats. Optional for notes; uses fallback when omitted.

**Omitting data:** Use `_` in Column 3 when you want fallback velocity but explicit length: `1.0 kick _ 0.25`.

## 6. Pitch Column (Percussive)

**Resolution order:** (1) Reserved tokens R, CC, TEMPO, TS. (2) General MIDI integer. (3) @MAP name. Use alphanumeric names for @MAP (e.g. kick, snare). Reserved tokens cannot be @MAP names.

**Common GM percussion (Channel 10):**

| Key | Sound |
|-----|-------|
| 36 | Bass Drum 1 (kick) |
| 38 | Acoustic Snare |
| 42 | Closed Hi-Hat |
| 44 | Pedal Hi-Hat |
| 46 | Open Hi-Hat |
| 41 | Low Floor Tom |
| 43 | High Floor Tom |
| 45 | Low Tom |
| 47 | Low-Mid Tom |
| 48 | Hi-Mid Tom |
| 50 | High Tom |
| 49 | Crash Cymbal 1 |
| 51 | Ride Cymbal 1 |
| 53 | Ride Bell |

**@MAP:** Define semantic names. Name: alphanumeric, underscores, no leading digit. Example: `@MAP kick=36`, `@MAP dha=84`.

- **R (Rest):** Not typically used in percussive patterns; use `| R` for skipping beats in repeating patterns.
- **CC, TEMPO, TS:** Same as general (if needed).

**Same-beat ordering:** On the same beat, output CC first, then notes.

## 7. Headers

Declare before events. Each track needs `@TRACK` and `@CHANNEL`.

- `@LMP 1.0` — Version (include at top)
- `@BPM [float]` — Tempo
- `@TIMESIG [int]/[int]` — e.g. `@TIMESIG 4/4` or `@TIMESIG 7/8`
- `@TRACK [int] [Name]` — Name required (alphanumeric, underscores)
- `@CHANNEL 10` — Drums use channel 10
- `@DEFAULT_VEL [int]` — Fallback velocity
- `@DEFAULT_DUR [float]` — Fallback duration (e.g. 0.25 for short hits)
- `@MAP [Name]=[Integer]` — Custom pitch name
- `@RULE [Pitch] VEL=[min]-[max]` — Randomize velocity when omitted (humanization)
- `@RULE [Pitch] DUR=[float]` — Fixed duration for a pitch

`@CHANNEL` does not persist across tracks. Declare it for each new track.

## 8. Advanced Features (Percussive)

**Repeating notes:** `[StartBeat]-[EndBeat]:[interval]` — interval as fraction (1/2, 1/4, 1/3) or integer only. DO NOT USE DECIMALS for the interval (e.g., :0.5 is invalid). Generates notes from StartBeat up to (but strictly NOT including) EndBeat. To fill a 4-beat measure, your EndBeat must be 5.0.
```
1.0-5.0:1/2 42
```

**Modifiers (`|`):** Use only after a repeating note line. Uppercase R, V, D.

- `| R [beats]` — Skip specified beats. Example: `| R 2.0 4.0`
- `| V [beat-spec] value` — Override velocity. Example: `| V [1.0 3.0] 110` or `| V 4.0 90`
- `| D [beat-spec] value` — Override duration. Example: `| D [2.0-4.0] 0.25`

Beat-spec: discrete `[1.0 2.0]`, single `4.0 90`, or range `[2.0-4.0]`. When multiple groups target the same beat, the last wins.

**Simultaneous hits:** Comma-separated: `4.0 te,ge`

## 9. Fallback Hierarchy

**Velocity:** Explicit row → @RULE for pitch → @DEFAULT_VEL → 100

**Duration:** Explicit row → @RULE DUR for pitch → @DEFAULT_DUR → 0.25

## 10. Examples

**Hi-hat + kick-snare:**
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
2.75 36 80
3.0 36 110
4.0 38
4.75 38 40
```

**Custom map (e.g. tabla bols):**
```LMP
@LMP 1.0
@BPM 90
@TRACK 1 Tabla
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 95

@MAP dha=84
@MAP ge=36
@MAP te=70
@MAP ne=50

1.0 dha 110
1.5 ge _ 0.5
2.0 te
2.5 ge
3.0 dha 110
3.5 ne
4.0 te,ge
```

## 11. Output Checklist

- Begin with `@LMP 1.0`
- Declare `@TRACK` and `@CHANNEL 10` before any events
- Use absolute beat numbers (0.0, 1.0, 2.5)
- Use `//` for inline comments when helpful
- Omit velocity and duration when defaults apply; use `_` when omitting velocity but specifying length
- Use repeating syntax for steady pulse patterns; use `| R` to skip beats, `| V` for accents, `| D` for duration variations
- Use `@MAP` for semantic drum names when helpful
- Output only valid LMP; no prose mixed in
