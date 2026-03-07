# **Lean Musical Protocol (LMP) v1 Specification**

## **1. Overview and Design Rationale**

The Lean Musical Protocol (LMP) is an ultra-lean, text-based music sequencing format engineered specifically for Large Language Models (LLMs). Its primary objective is to minimize token consumption and cognitive load while ensuring 100% deterministic compilation into binary MIDI files via a JavaScript parser.

LMP explicitly rejects verbose formats like JSON and XML, which introduce catastrophic token bloat due to structural repetition. It rejects Comma-Separated Values (CSV) as the primary grid format, since commas in the main data columns disrupt BPE tokenization. Commas are permitted only in constrained contexts (chordal polyphony, modifier argument groups). Instead, LMP employs a strict Space-Separated Value (SSV) grid, exploiting the fact that BPE tokenizers highly compress contiguous whitespace. To eliminate redundancy, LMP utilizes the "Don't Repeat Yourself" (DRY) principle via a stateful header hierarchy.

This document serves as the definitive standard for the syntax and parsing rules of LMP v1.

### **Version Declaration**

The `@LMP [version]` header (e.g., `@LMP 1.0`) should appear at the top of an LMP file. It signifies that the file conforms to that version of the specification; the parser applies the rules from that version. This enables version control across LMP tooling. If `@LMP` is not explicitly stated, the parser MUST use the latest specification version it supports to parse the data.

### **Compiler Modes**

Implementations MAY support two parsing modes:

- **Strict Mode (default):** The parser MUST error and halt on any specification violation. This is the normative behavior; all rules in this document apply strictly.
- **Loose Mode (debugging):** When enabled (e.g., via a flag or option), the parser MAY emit warnings instead of errors for recoverable violations and continue generating MIDI. Loose mode is intended for debugging, rapid prototyping, and LLM output inspection. The specification rules remain authoritative; loose mode relaxes enforcement only at runtime.

In loose mode, the compiler SHOULD emit a human-readable warning for each recoverable violation and apply a safe fallback rather than halting. Examples of recoverable violations and their fallbacks: invalid or incomplete CC rows (missing controller number or value) — warn and skip the row; invalid or incomplete PB rows — warn and skip the row; missing `@CHANNEL` for a track — assume channel 1 and warn; invalid repeating range (e.g., start ≥ end) — warn and skip the row. Non-recoverable violations (e.g., invalid file structure, orphaned continuations) MAY still error.

## **2. Lexical Syntax & Formatting Rules**

### **2.1 Space-Separated Columns**

Data for musical events is declared in a strict space-delimited format.

- **Whitespace Agnostic:** The parser splits rows using a regular expression for one or more whitespace characters (`/\s+/`). This means one space, multiple spaces (for visual alignment), or tabs are all treated identically.
- **Blank Line:** A blank line is any line that is empty or contains only whitespace.
- **Trailing Metadata Rule:** Once a blank line is encountered, the parser enters "trailing" mode. All subsequent lines that do not match LMP syntax (a line starting with `@`, a digit, `+`, or `|`) are ignored. When an LMP-matching line is encountered again, parsing resumes normally. This prevents LLM commentary or explanations after the LMP block from being treated as corrupted data.

### **2.2 Inline Intentions (Comments)**

Semantic grounding is critical for LLM reasoning. You can add natural language comments to the end of any line using the double forward slash (`//`).

- **Rule:** The parser splits the string at the first instance of `//`. Everything to the right is completely ignored by the compiler, protecting the mathematical grid from text pollution.

### **2.3 The Columnar Grid (Event Rows)**

Each musical event is defined on a single line. The columns must appear in this exact order:

`[Beat] [Pitch] [Velocity] [Length]`

1. **Column 1: Beat (Mandatory)**

- An absolute floating-point number representing the timeline position (e.g., `0.0`, `1.0`, `2.5`, `3.25`). Beat `0.0` is valid (start of timeline). Negative beat values are invalid.
- _Crucial Mathematical Rule:_ `1.0` ALWAYS represents exactly one Quarter Note (1 standard beat), regardless of the time signature. For example, in a 7/8 time signature, one full measure spans exactly `3.5` beats. This absolute grid prevents cumulative delta-time arithmetic errors.
- _Floating-Point Precision Rule:_ Beat values should be rounded to a maximum of 3 decimal places (e.g., `1.333` for a triplet). The JavaScript parser must round the final calculated MIDI tick position to the nearest whole integer using standard rounding (round half away from zero, e.g., `Math.round`) to completely eliminate floating-point drift over long sequences.

2. **Column 2: Pitch (Mandatory)**

- _Case-Insensitivity:_ All reserved pitch strings (R, CC, PB, TEMPO, TS) are case-insensitive. The parser must normalize Column 2 to uppercase before evaluation (e.g., `tempo`, `cc`, `pb` are valid).
- _Pitch Resolution Order:_ The parser resolves Column 2 in this order: (1) reserved tokens (R, CC, PB, TEMPO, TS) — always take precedence; (2) Scientific Pitch Notation if the string matches the SPN pattern; (3) General MIDI integer if the string is numeric; (4) `@MAP` name. SPN and GM integers take precedence over map names — e.g., `@MAP C4=36` has no effect because `C4` is parsed as SPN first.
- _Tonal:_ Scientific Pitch Notation (e.g., `C4`, `F#3`). The parser enforces `C4 = 60`
- _Percussive:_ General MIDI integers (e.g., `36`, `42`).
- _Custom Map:_ A string name defined via a drummap header (e.g., `dha`, `kick`).
- _Rest / Silence (R):_ Use the exact reserved string `R`. An `R` event is a **Non-Event Timestamp** — a marker that defines the end of a previous Legato note and the start of a silence period. It generates no MIDI note and requires no velocity or duration. Columns 3 and 4 are safely ignored. The parser advances the timeline; the silence from `R` to the next event is implicit. Used to explicitly declare silence. (To skip specific beats within a repeating pattern, use the modifier `| R` — see Section 3.6.)
- _Control Change (CC):_ Use the exact reserved string `CC`. When Pitch is `CC`, Column 3 becomes the **CC Number** (0-127), and Column 4 becomes the **CC Value** (0-127).
  - _Same-Beat Ordering Rule:_ When multiple event types occur on the exact same beat _within a track_, the parser MUST emit them in this order: (1) all CC events first (in line order), (2) all PB events (in line order), (3) all note events. This ensures state changes (e.g., Sustain CC) affect simultaneous notes. If multiple CC or PB events share a beat, they are processed in the order they appear in the file.
  - _Rule Override:_ When Pitch is `CC`, Columns 3 and 4 are mathematically **Mandatory**. You cannot omit them or use fallbacks.
  - _Discrete Events:_ LMP v1 does not support CC/PB curves or interpolation. Each CC row is a discrete, single-point event. To create a fade or ramp, program multiple discrete rows (e.g., every 1/8 beat).
  - _Example:_ `1.0 CC 64 127` (Sustain Pedal Down at Beat 1.0).
- _Pitch Bend (PB):_ Use the exact reserved string `PB`. When Pitch is `PB`, Column 3 becomes the **Bend Value** in continuous semitones (e.g., `1.5` for up a step-and-a-half, `-2.0` for down a whole step, `0.0` for center/reset).
  - _VST Match Warning:_ The parser assumes the target MIDI instrument's internal pitch-bend sensitivity matches the `@PBRANGE` value. If the VST/synth uses a different range, the user must either change the instrument setting or adjust `@PBRANGE` accordingly. Mismatch will produce incorrect pitch bend.
  - _Clamping Rule:_ If the requested semitone bend mathematically exceeds the current track's `@PBRANGE`, the parser must hard-clamp the value to the maximum (or minimum) allowable limit to prevent binary data corruption.
  - _Column 4 Safety Rule:_ Column 4 (Length) is not required for PB events. If data is accidentally provided in Column 4, the parser will safely ignore it.
  - _Discrete Events:_ LMP v1 does not support CC/PB curves or interpolation. Each PB row is a discrete, single-point event. To create a slide or gradual bend, program multiple discrete rows (e.g., every 1/8 beat).
  - _Hanging State Warning:_ Pitch Bend is a channel-wide state change. It does NOT automatically reset to zero after a note ends. The LLM MUST explicitly program a return to center (e.g., `X.X PB 0.0`) or all subsequent notes on that track will remain transposed/detuned.
  - _Auto-Reset Rule:_ The parser MUST automatically inject a `PB 0.0` message at the very end of any track that contains at least one PB event, unless the last event in that track is already a `PB 0.0`. This ensures the instrument returns to center tuning when playback stops or the track ends.
  - _Track Isolation:_ Pitch Bend state and `@PBRANGE` do NOT persist across tracks. When a new `@TRACK` is declared, the parser MUST emit `PB 0.0` at the start of that track and reset `@PBRANGE` to `2` unless explicitly set. This prevents accidental detuning when switching between instruments.
- _Tempo Change (TEMPO):_ Use the reserved string `TEMPO`.
  - Column 3: The new BPM (float).
  - Column 4: Safely ignored.
  - _Example:_ `16.0 TEMPO 145.0` (Accelerates to 145 BPM at beat 16.0).
  - _Track Placement:_ TEMPO and TS are global timeline meta-events. The parser MUST emit them to the first track. At least one `@TRACK` must exist before any TEMPO or TS events; if TEMPO/TS appear before the first track, the parser MUST error.
- _Time Signature Change (TS):_ Use the reserved string `TS`.
  - Column 3: The Numerator (integer).
  - Column 4: The Denominator (integer).
  - _Example:_ `32.0 TS 7 8` (Shifts to 7/8 time at beat 32.0).
  - _Track Placement:_ Same as TEMPO.

3. **Column 3: Velocity (Optional for Notes)**

- An integer between `1` and `127`. If omitted for a standard note, the parser calculates it from the cascading fallback hierarchy.

4. **Column 4: Length / Duration (Optional for Notes)**

- A floating-point duration (e.g., `1.0` for a quarter note, `0.5` for an eighth note). If omitted for a standard note, falls back to the track default.

## **3. Advanced Syntactic Features**

### **3.1 Omitting Explicit Data (`_`)**

If you wish to provide data for Column 4 (Length) but want to leave Column 3 (Velocity) empty to trigger the fallback logic, you **must** use an underscore (`_`) as a placeholder in Column 3.

- _Logic Rule:_ The `_` character instructs the parser to treat Column 3 exactly as if it were left blank, immediately triggering the Cascading Fallback Hierarchy (Section 4.1). In the case of polyphony, `_` triggers independent rule evaluation for each note in the chord.
- _Strict Constraint:_ The `_` placeholder is strictly for Note events. It is invalid and will cause a compilation error if used in place of mandatory data in a `CC` row.
- _Example:_ `1.0 C4 _ 2.0` (Plays C4 at Beat 1.0, calculates velocity from fallbacks, overrides length to 2.0).

### **3.2 Repeating Note Syntax**

To rapidly generate repetitive elements without consuming tokens, use the Repeating Note syntax in the **Beat** column:

- **Syntax:** `[StartBeat]-[EndBeat]:[numerator/denominator]` or `[StartBeat]-[EndBeat]:[integer]`
- **Interval (Fraction Only):** The interval must be expressed as a rational fraction `numerator/denominator` in beats, or as an integer for whole beats. The colon (`:`) separates the range from the interval. Examples: `:1/2` (eighth note), `:1/3` (triplet), `:1/4` (sixteenth), `:3/8`, `:1` (whole beat). Fractions only — no floats. The parser generates beats using exact rational arithmetic; no epsilon or floating-point comparison is required.
- **Mathematical Constraints:** To prevent parser infinite loops, `[EndBeat]` must be strictly greater than `[StartBeat]`, and the interval fraction must be positive. If these conditions are not met, the parser ignores the row.
- **Pitch Events Only:** The repeating syntax is strictly reserved for standard notes (Tonal, Percussive, or Custom Maps). It is invalid and will be safely ignored if used with Rest (`R`), Control Change (`CC`), or Pitch Bend (`PB`) events to prevent data stream clogging.
- **Logic:** The parser generates notes starting at `[StartBeat]`, adding the interval repeatedly, stopping strictly _before_ reaching `[EndBeat]` (exclusive).
- **Data Mapping:** Any explicit data provided in Column 3 (Velocity) or Column 4 (Length) will be applied uniformly to every single note generated by that loop.
- **Modifiers:** Repeating notes support modifier continuations (`|`) for per-beat overrides (e.g., skip beats, velocity or duration overrides). See Section 3.6.
- _Example:_ `1.0-5.0:1/2 42 110 0.25` (Generates note 42 at beats 1.0, 1.5, 2.0... up to 4.5. Every generated note is forced to velocity 110 and duration 0.25).

### **3.3 Chordal Polyphony**

Multiple pitches played at the exact same onset time must be written on a single line, separated by commas (without spaces).

- _Example:_ `1.0 C4,E4,G4 85 1.0` (A C-Major triad overriding velocity and length).
- **Velocity Calculation for Polyphony:** If velocity is omitted (using `_` or leaving the column blank), the parser calculates the velocity for _each note_ independently based on its specific `@RULE` in the header. Each pitch in a chord is evaluated against its own `@RULE` (e.g., `@RULE C4 VEL=70-80` and `@RULE E4 VEL=60-70` apply independently in `C4,E4,G4`). If an explicit velocity is provided in the row, that single value overrides all header rules and applies to _every_ note in that specific chord group.
- **MIDI Output Note:** For chordal polyphony (single-line chords) and multi-line same-beat polyphony, the parser should sort simultaneous notes by pitch (low to high) before writing MIDI. This improves compatibility with older hardware that can choke on out-of-order simultaneous notes.

### **3.4 Multi-Line Polyphony (Voice Leading)**

While Section 3.3 handles block chords with identical durations, complex voice leading often requires simultaneous notes to hold for different lengths. To achieve this, declare the events on the exact same beat across multiple sequential lines. The parser adds notes exactly as stated; this is not a Legato block, so durations are literal.

Example:

```LMP
1.0 C2 _ 4.0 // Bass holds for 4 beats
1.0 C4 _ 1.0 // Melody strikes at same time, holds for 1 beat
```

- **Alternative Syntax:** Use same-beat continuation (`+`) to inherit the beat and avoid repetition. See Section 3.5.
- **Line Breaks Optional:** A blank line between chord blocks is not required. Sequential blocks may run back-to-back.

```LMP
1.0 C5 _ 4.0
+ E5,G5 _ 2.0
```

### **3.5 Same-Beat Continuation (`+`)**

A line that starts with optional whitespace followed by `+` continues the previous event line and inherits its beat. This provides a compact alternative to repeating the beat on every line for multi-line polyphony.

- **Format:** `+ [Pitch] [Velocity] [Length]` — equivalent to columns 2, 3, and 4 of a standard event row. The beat is inherited from the base line.
- **Scope:** All `+` lines inherit the beat from the first non-continuation line in the block. Multiple continuations may follow; each inherits from the original base line.
- **Continuation Ends:** When a valid new LMP header (`@`), a valid new event line (starting with a number), or a **blank line** is encountered. Blank lines reset the active base line; use comment lines (`//`) for visual spacing within a continuation block.
- **Strict Constraint:** Same-beat continuation applies only when the base line is a **regular note** (single beat). It is invalid after a repeating note; use modifier continuation (`|`) for repeating notes instead.
- **Orphaned Continuation:** A `+` line with no preceding base line (e.g., at file start or immediately after a blank line, or after a header) is invalid — the parser MUST error.
- _Example:_
  ```LMP
  1.0 C5 _ 4.0
  + E5,G5 _ 2.0
  + G4 _ 2.0
  ```

### **3.6 Repeating Note Modifiers (`|`)**

A line that starts with optional whitespace followed by `|` continues a repeating note and applies modifiers that override or filter the generated notes on a per-beat basis.

- **Format:** `| [R|V|D] [arguments]`
- **Case-Sensitivity:** Modifier types R, V, and D are **case-sensitive** — only uppercase `R`, `V`, `D` are valid.
- **Scope:** Modifiers apply only to the immediately preceding repeating note. Continuation ends when a valid new header (`@`), event line (starting with a number), or **blank line** is encountered. Use comment lines (`//`) for visual spacing within a modifier block.
- **Orphaned Modifier:** A `|` line with no preceding repeating note (e.g., at file start, after a blank line, or after a regular note) is invalid — the parser MUST error.
- **Modifier R (Rest):** Skips the specified beats. Arguments: space-separated beat positions. The parser omits any generated note whose onset matches an excluded beat within a tolerance of **0.01** beats (e.g., `| R 1.333` matches a triplet-generated beat at 1.333...). Beats that do not exist in the generated note set (e.g., `| R 7.0` when the loop only generates 1.0–5.0) are ignored with a warning — this helps detect AI hallucination; the user may need to improve prompting.
  - _Example:_ `| R 2.0 4.0`
- **Modifier V (Velocity):** Overrides velocity at specific beats. Arguments: comma-separated groups of `[beat-spec] value`. Beat-spec syntax:
  - **Discrete list:** `[beat1 beat2 ...]` — space-separated inside brackets (commas optional). Applies only to the exact beats listed.
  - **Single beat:** `beat value` — unbracketed, applies to that one beat.
  - **Range:** `[start-end]` — hyphenated inside brackets. Applies to every generated note from `start` up to (but not including) `end`, at the loop's interval.
  - _Overlap Resolution:_ If multiple groups target the same beat (e.g., `| V [1.0 2.0] 80, [2.0 3.0] 90`), the **last** group wins. Beat 2.0 would use velocity 90.
  - _Example:_ `| V [3.0 3.5] 80, 4.0 90` (beats 3.0 and 3.5 use velocity 80; beat 4.0 uses 90)
- **Modifier D (Duration):** Overrides duration at specific beats. Same argument structure as V. Overlap resolution: last group wins.
  - _Example:_ `| D [2.0-4.0] 0.25` (all notes from 2.0 up to but not including 4.0 use duration 0.25 — range)
- **Evaluation Order:** The parser generates the full array of notes first, applies V and D overrides per beat, then purges notes marked by R. Applying R last prevents null-reference errors when both R and V (or D) target the same beat.
- **Strict Constraint:** Modifier continuation applies only when the base line is a **repeating note**. It is invalid after a regular note.
- _Example:_
  ```LMP
  1.0-5.0:1/2 42
  | R 2.0 4.0
  | V [3.0 3.5] 80, 4.0 90
  | D [2.0-4.0] 0.25
  ```

## **4. Stateful Headers (Metadata)**

Headers define the environment and default rules. They are prefixed with @ and must be declared before the events they affect. Note events require at least one `@TRACK` and `@CHANNEL` to be declared before any event rows; events appearing before the first track declaration are invalid.

- **Global Headers:**
  - `@LMP 1.0` - Lean Musical Protocol v1.0.
  - `@BPM [float]` - Sets global tempo.
  - `@TIMESIG [int]/[int]` - Sets the time signature (e.g., `@TIMESIG 7/8`). Defaults to 4/4 if omitted.
  - `@PPQN [integer]` - Sets the MIDI resolution (pulses per quarter note). Defaults to `480` if omitted. Used for Legato Gap and tick calculations.
- **Track Initialization:**
  - `@TRACK [integer] [Name]` - Initializes a new track and sets it as active. The `[Name]` is **mandatory** (for human readability) and must consist entirely of alphanumeric characters and underscores (no spaces). `@TRACK 1` without a name is invalid.
  - `@CHANNEL [integer]` - Sets the MIDI channel (1–16, display convention; channel 10 is reserved for drums). Required for note-playing messages; each new track must declare it. The parser converts to 0–15 for binary MIDI output.
  - `@PROGRAM [integer]` - Sets the MIDI patch (0-127). Optional (as in MIDI); add at track declaration if desired.
  - `@PBRANGE [integer]` - Sets the maximum Pitch Bend range in semitones for the current track's parser math (e.g., `@PBRANGE 12`). Defaults to `2` if omitted.
  - _State Persistence Rule:_ Only `@DEFAULT_VEL`, `@DEFAULT_DUR`, and `@RULE` persist when a new `@TRACK` is declared. `@CHANNEL` does NOT persist — each new track must declare `@CHANNEL` right after the track declaration. `@PROGRAM` does NOT persist and is optional; if used, add it at track declaration time. `@PBRANGE` and Pitch Bend state do NOT persist; they reset on each new track (see Section 2.3). The first track has no inherited state; it must declare `@CHANNEL`; velocity and duration fallbacks use hardcoded Global Safety Defaults until overridden.
  - _Mid-Sequence Override:_ `@CHANNEL` and `@PROGRAM` may be repeated anywhere in the sequence. The parser applies headers top-to-bottom; a later `@CHANNEL` or `@PROGRAM` overrides the previous value for all subsequent events on that track.
  - _Explicit Inherit:_ Use `@INHERIT [track]` to inherit from the specified track, or `@INHERIT [track] [header1,header2,...]` to inherit only the listed headers. Valid header names: `VEL`, `DUR`, `CHANNEL`, `PROGRAM`, `PBRANGE`, `RULE`. `@INHERIT` is evaluated first; subsequent headers on the same track override inherited values. Self-inheritance (`@INHERIT` from the same track) is invalid. Inheriting from a track declared later in the file is invalid. Inheriting from a non-existent track (e.g., `@INHERIT 1` when no Track 1 exists) is invalid — the parser MUST error in all these cases.
  - _Example:_ `@TRACK 2 Piano_RH @INHERIT 1` (inherits all from Track 1 including CHANNEL and PROGRAM — Piano LH and RH share channel). `@TRACK 3 Strings @INHERIT 1 VEL,DUR @CHANNEL 2 @PROGRAM 48` (inherits only DEFAULT_VEL and DEFAULT_DUR from Track 1, then sets channel and program).
  - _Reset Track:_ Use `@RESET_TRACK` to purge all inherited `@DEFAULT_VEL`, `@DEFAULT_DUR`, and `@RULE` for the current track, returning it to Global Safety Defaults. Global `@MAP` definitions remain unless overwritten. The track must still declare `@CHANNEL` right after the track declaration; `@PROGRAM` remains optional. If the track has no inherited values (no `@INHERIT`), `@RESET_TRACK` is a no-op.
- **Track Defaults & Humanization:**
  - `@DEFAULT_VEL [integer]` - The fallback velocity if Column 3 is omitted.
  - `@DEFAULT_DUR [float]` - The fallback length if Column 4 is omitted.
  - `@RULE [Pitch] VEL=[min]-[max]` - Instructs the parser to randomize velocity within a range if omitted (e.g., `@RULE 42 VEL=75-90`).
  - `@RULE [Pitch] DUR=[float]` - Sets a hardcoded default duration for a specific pitch, overriding `@DEFAULT_DUR` (e.g., `@RULE 36 DUR=1.0`).
  - `@RULE LEGATO=TRUE` - Activates algorithmic legato for _monophonic_ sequences. The parser calculates duration to reach the next chronological event, minus a Legato Gap (see Section 4.1).
    - _Polyphony Handling:_ If chordal polyphony (commas or same-beat multi-lines) occurs within a Legato-enabled track, Legato is disabled for that beat and the parser defers to the track default for duration (see Overlap Safety in Section 4.1). For clean legato behavior, prefer separate `@TRACK` blocks routed to the same `@CHANNEL` (e.g., Piano Left Hand vs. Right Hand).
    - _Programming Rests:_ To program a rest (silence) in a Legato track, either (a) use an `R` event at the desired beat, or (b) give a note an explicit duration in Column 4 that does not reach the next event — e.g., `1.0 C5 _ 1.0` with the next note at 2.0 creates a 1-beat note followed by 1 beat of silence.
- **Custom Drum Mapping:**
  - `@MAP [Name]=[Integer]` - Allows the LLM to use semantic names instead of arbitrary integers in the Pitch column (e.g., `@MAP kick=36`).
  - _Strict Lexical Rule:_ The `[Name]` string must consist entirely of alphanumeric characters and underscores (`A-Z`, `a-z`, `0-9`, `_`). Hyphens, spaces, and special characters are strictly prohibited and will cause a parsing failure. **Map names cannot begin with a digit** — this ensures the parser can instantly distinguish a Beat/Range from a Pitch (e.g., `@MAP 1=36` is invalid).
  - _Global Persistence Rule:_ `@MAP` definitions persist globally across all tracks once declared. If a new `@MAP` uses an existing name, it overwrites the previous integer mapping. You do not need to redeclare maps when initializing a new `@TRACK`.

### **4.1 Cascading Fallback Hierarchy**

When an event row is evaluated, the parser determines Velocity and Length using this strict priority list:

**For Velocity:**

1. **Explicit Row Data:** Data found directly in Column 3 (e.g., `100`).
2. **Note-Specific Rule:** Ranges defined by `@RULE` for that exact pitch.
3. **Track Default:** Value defined by `@DEFAULT_VEL`.
4. **Global Safety Default:** Hardcoded parser fallback (`100`) to prevent null crashes.

**For Length (Duration):**

1. **Explicit Row Data:** Data found directly in Column 4 (e.g., `0.5`). This acts as an absolute override.
2. **Note-Specific Rule:** Duration defined by `@RULE [Pitch] DUR=[float]`.
3. **Legato Auto-Calculation:** If `@RULE LEGATO=TRUE` is active, the duration is dynamically calculated to reach the next chronological row's onset, minus a **Legato Gap** to prevent note-off/note-on collisions. (Note: Must be used strictly on monophonic tracks).
   - _Legato Gap:_ The parser MUST subtract exactly **2 MIDI ticks** (at the file's PPQN, default 480) from the calculated duration so the Note Off is sent just before the Note On. Defining the gap in ticks (not beats) ensures a consistent physical separation regardless of tempo and avoids rounding to zero at low PPQN. This prevents VST glitches (silent or popped notes) when notes abut exactly.
   - _Rest Integration:_ A Rest event (`R`) acts as a **Non-Event Timestamp** — its Beat is the Hard Stop for the previous Legato note. Legato notes calculate their duration to end exactly where the Rest begins. The `R` row itself requires no velocity or duration; the silence from `R` to the next event is implicit.
   - _Overlap Safety:_ If two notes are scheduled at the same beat (e.g., due to continuation or accidental polyphony), Legato is disabled for that beat and the parser defers to Step 4 for duration.
   - _Final Note Constraint:_ If there is no subsequent event (Note or Rest) in the track, Legato calculation aborts and defers to Step 4. Therefore, **the final note of any Legato sequence MUST have an explicitly declared duration in Column 4** to prevent it from defaulting to a short, clipped note.
4. **Track Default:** Value defined by `@DEFAULT_DUR`.
5. **Global Safety Default:** Hardcoded parser fallback (`0.25`).

## **5. Comprehensive Use-Case Examples**

### **Example 1: Melodic Orchestration (Chords, Omitting Data, and Legato)**

```LMP
@LMP 1.0
@BPM 120
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

// Block Chords
1.0 C4,E4,G4 // Uses default velocity (80) and duration (1.0)
2.0 D4,F4,A4 95 // Overrides velocity to 95, uses default duration (1.0)
3.0 C4,E4,G4 _ 2.0 // Omits velocity (uses 80 default), overrides duration to 2.0

@TRACK 2 Solo_Flute
@CHANNEL 2
@PROGRAM 73
@DEFAULT_VEL 90
@RULE LEGATO=TRUE // Parser auto-calculates lengths to overlap notes

1.0 C5 // Phrase start
1.5 D5 // Rising
2.0 E5 // Phrase peak
3.0 C5 _ 2.0 // Resolution (explicit duration required at the end of a phrase)
```

### **Example 2: Basic Drum Kit (Repeating Notes and Randomized Velocity)**

```LMP
@LMP 1.0
@BPM 110
@TRACK 3 Drum_Kit
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 100
@RULE 42 VEL=70-85 // Hi-hat humanization
@RULE 38 VEL=105-115 // Snare humanization

// Continuous Hi-Hats using Repeating Syntax
// Generates note 42 every 1/2 beat from beat 1.0 up to (but not including) 5.0
1.0-5.0:1/2 42

// Kick and Snare Pattern
1.0 36 110 // Strong downbeat kick (Explicit velocity override)
2.0 38     // Backbeat snare (Uses randomized rule)
2.75 36 80 // Syncopated quiet kick
3.0 36 110
4.0 38     // Backbeat snare
4.75 38 40 // Ghost note snare (Explicit override bypasses randomization rule)
```

### **Example 3: Custom Instrument Mapping (Tabla Bols)**

```LMP
@LMP 1.0
@BPM 90
@TRACK 4 Indian_Tabla
@CHANNEL 10
@DEFAULT_DUR 0.25
@DEFAULT_VEL 95

// Custom Map Definitions
@MAP dha=84
@MAP ge=36
@MAP te=70
@MAP ne=50

// Linear 4-beat Groove
1.0 dha 110 // Accent
1.5 ge _ 0.5 // Omit velocity, override length
2.0 te
2.5 ge
3.0 dha 110 // Accent
3.5 ne
4.0 te,ge // Simultaneous hits
```

### **Example 4: Same-Beat Continuation (Voice Leading with `+`)**

```LMP
@LMP 1.0
@BPM 100
@TRACK 1 Piano
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 85
@DEFAULT_DUR 1.0

// Bass holds 4 beats; chord voices hold 2 beats — using + to inherit beat
// Line breaks between blocks are optional; notes are added exactly as stated
1.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
2.0 D2 _ 4.0
+ D4,F4,A4 _ 2.0
4.0 C2 _ 4.0
+ C4,E4,G4 _ 2.0
```

### **Example 5: Repeating Note Modifiers (Hi-Hat with Skips and Accents)**

```LMP
@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@PROGRAM 0
@DEFAULT_DUR 0.25
@DEFAULT_VEL 90

// Hi-hats every 1/2 beat, skip 2.0 and 4.0 (backbeat space), accent 1.0 and 3.0
1.0-5.0:1/2 42
| R 2.0 4.0
| V [1.0 3.0] 110

// Kick pattern
1.0 36 110
3.0 36 110
```
