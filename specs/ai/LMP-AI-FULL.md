# LMP — Lean Musical Protocol (AI Teaching: Master Specification)

## 1. Adapter Preamble

You retain your full identity, expertise, and creative musical voice. This document teaches you a specialized output format: **LMP (Lean Musical Protocol)**. Use it whenever you compose, sequence, edit, or output MIDI music.

Musical decisions (harmony, melody, counterpoint, rhythm, groove, dynamics, phrasing) stay entirely in your domain. LMP syntax (how to encode musical ideas into deterministic, token-efficient text) is the taught capability.

## 2. Output Context

LMP is a clean, whitespace-delimited text format that compiles directly to binary Standard MIDI.
- **Rule 1:** Wrap all generated LMP code inside a markdown code block: ```lmp ... ```
- **Rule 2:** Output valid LMP syntax only within the code block. Do not mix conversational prose into the code block.

---

## 3. Musical Concept → LMP Quick Reference

| Musical Concept | LMP Syntax | Notes / Example |
|---|---|---|
| **Downbeat / Measure** | `1.0`, `2.0`, `3.0`... | Absolute quarter-note grid. 4/4 bar = 4 beats (`1.0` to `5.0`). |
| **Single Note** | `1.0 C4` | Note at beat 1.0 (defaults apply for velocity/duration). |
| **Single Note (Full)** | `1.0 C4 95 1.0` | `[Beat] [Pitch] [Velocity] [Length]`. |
| **Chord (Polyphony)** | `1.0 C4,E4,G4 80 2.0` | Comma-separated. **STRICTLY NO SPACES** after commas! |
| **Omit Velocity, Set Length** | `1.0 C4 _ 2.0` | **MUST use `_` in Column 3** to avoid reading duration as velocity. |
| **Voice Leading / Same Beat** | `+ E4,G4 _ 2.0` | `+` inherits the beat timestamp from the line immediately above. |
| **Monophonic Legato** | `@RULE LEGATO=TRUE` | Omit duration; automatically calculates duration to next note. |
| **Rest / Silence** | `3.0 R` | Explicit silence marker (useful in legato or solo passages). |
| **Pitch Bend** | `2.5 PB 1.0` | Bend in semitones (`+1.0` up, `-1.0` down, `0.0` center reset). |
| **Sustain Pedal** | `1.0 CC 64 127` | Standard MIDI CC (`64` = sustain, `127` = down, `0` = release). |
| **Expression / Swell** | `1.0 CC 11 90` | CC 11 expression dynamics. |
| **Kick Drum (Ch 10)** | `1.0 36 110` | GM 36 = Bass Drum. |
| **Snare Drum (Ch 10)** | `2.0 38 105` | GM 38 = Acoustic Snare. |
| **Repeating Grid (Hi-Hats)**| `1.0-5.0:1/2 42` | 8th notes from beat 1.0 up to (exclusive) 5.0 (fills 4-beat bar). |
| **Skip Loop Beats** | `\| R 2.0 4.0` | Place on line directly under a repeating loop. |
| **Accent Loop Beats** | `\| V [1.0 3.0] 115` | Accent specific beats in the loop. |
| **Custom Instrument Name** | `@MAP kick=36` | Define alias, then use `1.0 kick 110 0.25`. |
| **Humanize Velocity** | `@RULE 42 VEL=75-90` | Randomizes velocity within range when omitted on that pitch. |

---

## 4. Lexical & Structural Rules

1. **Columns are Space-Delimited:** Use one or more spaces or tabs between columns.
2. **Event Row Format:**
   ```text
   [Beat] [Pitch/Token] [Velocity] [Length]
   ```
   - **Column 1 — Beat:** Absolute position (`1.0`, `2.5`, `3.25`). 1 beat = 1 quarter note. Max 3 decimal places.
   - **Column 2 — Pitch:** Note (Scientific Pitch Notation like `C4`, `F#3`), GM percussion integer (`36`, `38`), custom `@MAP` name (`kick`), or reserved token (`R`, `CC`, `PB`, `TEMPO`, `TS`).
   - **Column 3 — Velocity:** Integer `1–127`. Optional.
   - **Column 4 — Length:** Duration in beats (e.g., `1.0` = quarter note, `0.5` = eighth note). Optional.
3. **CRITICAL Column 3 `_` Placeholder Rule:**
   Column 3 is ALWAYS Velocity; Column 4 is ALWAYS Duration.
   If you omit velocity while specifying duration, you **MUST** put `_` in Column 3:
   - ✅ Correct: `1.0 C4 _ 2.0` (plays C4 at default velocity for 2.0 beats)
   - ❌ FORBIDDEN: `1.0 C4 2.0` (this erroneously interprets `2.0` as velocity 2, producing an inaudible note!)
4. **CRITICAL Negative Constraint — No Spaces in Chords:**
   In Column 2 chords, **NEVER** insert spaces after commas.
   - ✅ Correct: `1.0 C4,E4,G4 80 1.0`
   - ❌ FORBIDDEN: `1.0 C4, E4, G4 80 1.0` (spaces break column parsing!)
5. **Comments:** Use `//` anywhere. Everything after `//` on the line is ignored.
6. **Trailing Prose / Blank Lines:** Empty lines or non-LMP lines enter trailing mode until valid `@` headers or event rows resume.

---

## 5. Headers Reference

Declare track headers before event rows. Each track **must** declare `@TRACK` and `@CHANNEL`.

```lmp
@LMP 2.0                      // Protocol version
@BPM 120                      // Tempo in beats per minute
@TIMESIG 4/4                  // Time signature (4/4, 3/4, 7/8, etc.)
@ORIGIN 1                     // 1 = downbeat at 1.0 (default), 0 = 0-based DAWs
@SEED 42                      // Deterministic seed for @RULE VEL humanization

@TRACK 1 Piano_Lead           // Track ID and Name (alphanumeric & underscores)
@CHANNEL 1                    // MIDI channel (1-16; use 10 for drums). Note: Does not persist across tracks!
@PROGRAM 0                    // General MIDI patch number (0 = Acoustic Grand Piano)
@DEFAULT_VEL 85               // Fallback velocity when omitted in rows
@DEFAULT_DUR 1.0              // Fallback duration when omitted in rows
@PBRANGE 2                    // Pitch bend sensitivity range in semitones (default 2)
```

---

## 6. Melodic & Harmonic Sequencing

### 6.1 Scientific Pitch Notation (SPN)
- `C4` = MIDI note 60 (Middle C).
- Sharps (`F#3`, `G#4`) or flats (`Bb3`, `Eb4`) are fully supported.

### 6.2 Voice Leading with `+` (Same Beat Continuation)
To layer independent voices on the exact same beat without repeating the timestamp:
```lmp
1.0 C3 _ 4.0                  // Bass note held for full 4-beat bar
+ E4,G4,B4 75 2.0             // Pad chord at beat 1.0 held for 2 beats
3.0 D4,F#4,A4 80 2.0          // Second pad chord at beat 3.0
```

### 6.3 Monophonic Legato Phrases
Add `@RULE LEGATO=TRUE` on solo tracks. Duration automatically connects to the next note.
```lmp
@TRACK 2 Flute_Solo
@CHANNEL 2
@PROGRAM 73
@RULE LEGATO=TRUE
@DEFAULT_VEL 88

1.0 E4                        // Connected to 1.5
1.5 G4                        // Connected to 2.0
2.0 A4                        // Connected to 3.0
3.0 B4 _ 1.5                  // Final note of phrase: provide explicit length in Col 4!
4.5 R                         // Rest
```

### 6.4 Pitch Bend & CC Automation
- **Pitch Bend (`PB`):** `[Beat] PB [semitones]`. e.g., `2.5 PB 1.0` bends up 1 semitone; `3.0 PB 0.0` centers.
- **Continuous Controllers (`CC`):** `[Beat] CC [controller#] [value]`.
  - Sustain pedal: `1.0 CC 64 127` (down), `4.5 CC 64 0` (release).
  - Expression dynamics: `1.0 CC 11 60`, `2.0 CC 11 90`, `3.0 CC 11 115`.
- **Order on same beat:** Output `CC` first, then `PB`, then notes.

---

## 7. Percussion & Drum Sequencing (Channel 10)

Always set `@CHANNEL 10` for standard General MIDI percussion.

### 7.1 Standard General MIDI Percussion Map
| Note # | Instrument Name | Common @MAP Alias |
|---|---|---|
| **36** | Bass Drum 1 (Kick) | `@MAP kick=36` |
| **38** | Acoustic Snare | `@MAP snare=38` |
| **40** | Electric Snare | `@MAP esnare=40` |
| **42** | Closed Hi-Hat | `@MAP hat=42` |
| **44** | Pedal Hi-Hat | `@MAP pedalhat=44` |
| **46** | Open Hi-Hat | `@MAP openhat=46` |
| **49** | Crash Cymbal 1 | `@MAP crash=49` |
| **51** | Ride Cymbal 1 | `@MAP ride=51` |
| **53** | Ride Bell | `@MAP ridebell=53` |
| **41 / 45 / 48**| Low / Mid / High Toms | `@MAP lowtom=41` |

### 7.2 Repeating Loops & Modifiers
Generate fast patterns (hi-hats, shakers) using range syntax:
`[StartBeat]-[EndBeat]:[interval] [Pitch]`

- **Interval format:** MUST be a fraction (`1/2`, `1/4`, `1/8`, `1/16`, `1/3`) or integer. **NEVER use decimals like `:0.5`**.
- **Loop EndBeat is EXCLUSIVE:** To fill a 4-beat bar (beats 1.0 through 4.0), use `1.0-5.0:1/2`.
- **Modifiers (`|`):** Place modifier lines immediately below the loop line:
  - `| R [beats...]` — Skip/rest on specific beats.
  - `| V [beats...] [velocity]` — Accent specific beats.
  - `| D [beats...] [duration]` — Override duration on specific beats.

```lmp
// 16th-note hi-hat roll across 1 bar with accents and open hats
1.0-5.0:1/4 42
| R 2.5 4.5                   // Skip closed hat where open hat plays
| V [1.0 2.0 3.0 4.0] 110     // Accent on quarter-note downbeats

2.5 46 95 0.5                 // Open hat hit on the "and" of 2
4.5 46 95 0.5                 // Open hat hit on the "and" of 4
```

---

## 8. Odd Meters & Mathematical Alignment

In LMP, **1 beat ALWAYS equals 1 quarter note**.
- In **4/4**: 1 measure = 4.0 beats. (Bar 1: `1.0–5.0`, Bar 2: `5.0–9.0`).
- In **3/4**: 1 measure = 3.0 beats. (Bar 1: `1.0–4.0`, Bar 2: `4.0–7.0`).
- In **6/8**: 1 measure = 6 eighth notes = 3.0 quarter-note beats.
- In **7/8**: 1 measure = 7 eighth notes = 3.5 quarter-note beats.
  - Bar 1: `1.0` to `4.5`
  - Bar 2: `4.5` to `8.0`

---

## 9. Comprehensive Multi-Track Example

Here is a complete, production-ready 2-bar Funk arrangement demonstrating melodic chords, bassline, and drum groove:

```lmp
@LMP 2.0
@BPM 116
@TIMESIG 4/4
@ORIGIN 1
@SEED 101

// -------------------------------------------------------------
// TRACK 1: Electric Piano (Chords & Groove)
// -------------------------------------------------------------
@TRACK 1 Rhodes_Piano
@CHANNEL 1
@PROGRAM 4
@DEFAULT_VEL 80
@DEFAULT_DUR 0.75

// Measure 1: Dm9 to G13 syncopated hits
1.0 D4,F4,A4,C5 90 1.0
2.5 D4,F4,A4,C5 75 0.5
3.0 G3,F4,B4,E5 85 1.0
4.5 G3,F4,B4,E5 70 0.5

// Measure 2: Em7 to A7alt
5.0 E4,G4,B4,D5 90 1.0
6.5 E4,G4,B4,D5 75 0.5
7.0 A3,G4,C#5,F5 85 1.0
8.5 A3,G4,C#5,F5 70 0.5

// -------------------------------------------------------------
// TRACK 2: Electric Slap Bass (Monophonic Legato)
// -------------------------------------------------------------
@TRACK 2 Slap_Bass
@CHANNEL 2
@PROGRAM 36
@DEFAULT_VEL 95
@RULE LEGATO=TRUE

// Measure 1
1.0 D2
1.75 D2 70
2.0 D3 110
2.5 F2 85
3.0 G2 105
3.75 G#2 80
4.0 A2 110
4.5 C3 _ 0.5

// Measure 2
5.0 E2 100
5.75 E2 70
6.0 E3 110
6.5 G2 85
7.0 A2 105
7.75 Bb2 80
8.0 B2 110
8.5 D3 _ 0.5

// -------------------------------------------------------------
// TRACK 3: Tight Funk Drums
// -------------------------------------------------------------
@TRACK 3 Funk_Kit
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=70-85            // Humanize hi-hat velocity

// Hi-Hat 8th-note groove across 2 bars (beats 1.0 to 9.0)
1.0-9.0:1/2 42
| V [1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0] 105

// Measure 1: Kick & Snare
1.0 36 115                    // Kick on 1
1.75 36 90                    // Ghost kick
2.0 38 115                    // Snare on 2
2.75 38 45                    // Ghost snare
3.0 36 110                    // Kick on 3
3.5 36 95                     // Syncopated kick on 3-and
4.0 38 115                    // Snare on 4

// Measure 2: Kick & Snare variation
5.0 36 120                    // Sam downbeat kick
5.5 36 90
6.0 38 115                    // Snare on 2
6.75 38 45                    // Ghost snare
7.0 36 110                    // Kick on 3
7.75 36 100
8.0 38 120                    // Snare on 4
8.75 38 60                    // Ghost snare pickup
```

---

## 10. AI Generation Checklist

Before emitting LMP output, run through this mental checklist:
- [ ] Wrapped inside a single ```` ```lmp ```` code fence.
- [ ] Header includes `@LMP 2.0`, `@BPM`, and `@TIMESIG`.
- [ ] Every track defines both `@TRACK [id] [Name]` and `@CHANNEL [1-16]` (Channel 10 for drums).
- [ ] Beats are absolute numbers (`1.0` is downbeat in 4/4; measure 2 starts at `5.0`).
- [ ] **NO SPACES inside chords:** Written as `C4,E4,G4`, never `C4, E4, G4`.
- [ ] **Column 3 placeholder:** If omitting velocity while specifying duration, wrote `1.0 C4 _ 2.0` (never `1.0 C4 2.0`).
- [ ] Repeating loop interval is a fraction (`:1/2`, `:1/4`, `:1/8`), never a decimal (`:0.5` is invalid).
- [ ] Repeating loop EndBeat is exclusive (`1.0-5.0:1/2` fills a 4-beat bar).
- [ ] Final note of a `@RULE LEGATO=TRUE` track has an explicit duration in Column 4.
- [ ] Output clean, executable LMP syntax with no extraneous conversational text inside the code block.
