# **Lean Musical Protocol (LMP) v1 Specification**

## **1. Overview and Design Rationale**

The Lean Musical Protocol (LMP) is an ultra-lean, text-based music sequencing format engineered specifically for Large Language Models (LLMs). Its primary objective is to minimize token consumption and cognitive load while ensuring 100% deterministic compilation into binary MIDI files via a JavaScript parser.

LMP explicitly rejects verbose formats like JSON and XML, which introduce catastrophic token bloat due to structural repetition. It also rejects Comma-Separated Values (CSV), as commas disrupt the continuous integer tokenization flow inherent in modern Byte-Pair Encoding (BPE) tokenizers. Instead, LMP employs a strict Space-Separated Value (SSV) grid, exploiting the fact that BPE tokenizers highly compress contiguous whitespace. To eliminate redundancy, LMP utilizes the "Don't Repeat Yourself" (DRY) principle via a stateful header hierarchy.

This document serves as the definitive standard for the syntax and parsing rules of LMP v1.

## **2. Lexical Syntax & Formatting Rules**

### **2.1 Space-Separated Columns**

Data for musical events is declared in a strict space-delimited format.

- **Whitespace Agnostic:** The parser splits rows using a regular expression for one or more whitespace characters (`/\s+/`). This means one space, multiple spaces (for visual alignment), or tabs are all treated identically.

### **2.2 Inline Intentions (Comments)**

Semantic grounding is critical for LLM reasoning. You can add natural language comments to the end of any line using the double forward slash (`//`).

- **Rule:** The parser splits the string at the first instance of `//`. Everything to the right is completely ignored by the compiler, protecting the mathematical grid from text pollution.

### **2.3 The Columnar Grid (Event Rows)**

Each musical event is defined on a single line. The columns must appear in this exact order:

`[Beat] [Pitch] [Velocity] [Length]`

1. **Column 1: Beat (Mandatory)**

- An absolute floating-point number representing the timeline position (e.g., `1.0`, `2.5`, `3.25`).
- _Crucial Mathematical Rule:_ `1.0` ALWAYS represents exactly one Quarter Note (1 standard beat), regardless of the time signature. For example, in a 7/8 time signature, one full measure spans exactly `3.5` beats. This absolute grid prevents cumulative delta-time arithmetic errors.
- _Floating-Point Precision Rule:_ Beat values should be rounded to a maximum of 3 decimal places (e.g., `1.333` for a triplet). The JavaScript parser must round the final calculated MIDI tick position to the nearest whole integer to completely eliminate floating-point drift over long sequences.

2. **Column 2: Pitch (Mandatory)**

- _Tonal:_ Scientific Pitch Notation (e.g., `C4`, `F#3`). The parser enforces `C4 = 60`
- _Percussive:_ General MIDI integers (e.g., `36`, `42`).
- _Custom Map:_ A string name defined via a drummap header (e.g., `dha`, `kick`).
- _Rest / Silence (R):_ Use the exact reserved string `R`. When Pitch is `R`, the parser advances the timeline but generates no MIDI note. This is used to explicitly declare silence or break a repeating note loop. Columns 3 and 4 are safely ignored for `R` events.
- _Control Change (CC):_ Use the exact reserved string `CC`. When Pitch is `CC`, Column 3 becomes the **CC Number** (0-127), and Column 4 becomes the **CC Value** (0-127).
  - _Zero-Tick Collision Rule:_ If a CC event and a standard note event occur on the exact same beat, the parser must compile the CC event first to ensure state changes (like Sustain) affect simultaneous notes.
  - _Rule Override:_ When Pitch is `CC`, Columns 3 and 4 are mathematically **Mandatory**. You cannot omit them or use fallbacks.
  - _Example:_ `1.0 CC 64 127` (Sustain Pedal Down at Beat 1.0).
- _Pitch Bend (PB):_ Use the exact reserved string `PB`. When Pitch is `PB`, Column 3 becomes the **Bend Value** in continuous semitones (e.g., `1.5` for up a step-and-a-half, `-2.0` for down a whole step, `0.0` for center/reset).
  - _Clamping Rule:_ If the requested semitone bend mathematically exceeds the current track's `@PBRANGE`, the parser must hard-clamp the value to the maximum (or minimum) allowable limit to prevent binary data corruption.
  - _Column 4 Safety Rule:_ Column 4 (Length) is not required for PB events. If data is accidentally provided in Column 4, the parser will safely ignore it.

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

- **Syntax:** `[StartBeat]-[EndBeat]/[Interval]`
- **Mathematical Constraints:** To prevent parser infinite loops, `[EndBeat]` must be strictly greater than `[StartBeat]`, and `[Interval]` must be a positive float. If these conditions are not met, the parser ignores the row.
- **Pitch Events Only:** The repeating syntax is strictly reserved for standard notes (Tonal, Percussive, or Custom Maps). It is invalid and will be safely ignored if used with Control Change (`CC`) or Pitch Bend (`PB`) events to prevent data stream clogging.
- **Logic:** The parser generates notes starting at `[StartBeat]`, adding `[Interval]` repeatedly, stopping strictly _before_ reaching `[EndBeat]` (exclusive).
- **Data Mapping:** Any explicit data provided in Column 3 (Velocity) or Column 4 (Length) will be applied uniformly to every single note generated by that loop.
- _Example:_ `1.0-5.0/0.5 42 110 0.25` (Generates note 42 at beats 1.0, 1.5, 2.0... up to 4.5. Every generated note is forced to velocity 110 and duration 0.25).

### **3.3 Chordal Polyphony**

Multiple pitches played at the exact same onset time must be written on a single line, separated by commas (without spaces).

- _Example:_ `1.0 C4,E4,G4 85 1.0` (A C-Major triad overriding velocity and length).
- **Velocity Calculation for Polyphony:** If velocity is omitted (using `_` or leaving the column blank), the parser calculates the velocity for _each note_ independently based on its specific `@RULE` in the header. If an explicit velocity is provided in the row, that single value overrides all header rules and applies to _every_ note in that specific chord group.

### **3.4 Multi-Line Polyphony (Voice Leading)**

While Section 3.3 handles block chords with identical durations, complex voice leading often requires simultaneous notes to hold for different lengths (e.g., a cello holding a pedal note while violins play staccato).

To achieve this, declare the events on the exact same beat across multiple sequential lines. The parser will process them as occurring simultaneously.

- _Example:_
  `1.0 C2 _ 4.0 // Bass holds for 4 beats`
  `1.0 C4 _ 1.0 // Melody strikes at the same time, holds for 1 beat`

## **4. Stateful Headers (Metadata)**

Headers define the environment and default rules. They are prefixed with @ and must be declared before the events they affect.

- **Global Headers:**
  - `@LMP 1.0` - Lean Musical Protocol v1.0.
  - `@BPM [float]` - Sets global tempo.
  - `@TIMESIG [int]/[int]` - Sets the time signature (e.g., `@TIMESIG 7/8`). Defaults to 4/4 if omitted.
- **Track Initialization:**
  - `@TRACK [integer] [Name]` - Initializes a new track and sets it as active. The `[Name]` must consist entirely of alphanumeric characters and underscores (no spaces).
  - `@CHANNEL [integer]` - Sets the MIDI channel (Channel 10 is reserved for drums).
  - `@PROGRAM [integer]` - Sets the MIDI patch (0-127).
  - `@PBRANGE [integer]` - Sets the maximum Pitch Bend range in semitones for the current track's parser math (e.g., `@PBRANGE 12`). Defaults to `2` if omitted.
  - _State Reset Rule:_ Declaring a new `@TRACK` immediately flushes all track-level state data. All `@DEFAULT_VEL`, `@DEFAULT_DUR`, and specific `@RULE` definitions from the previous track are erased. The new track begins with only the hardcoded Global Safety Defaults until new headers are declared.
- **Track Defaults & Humanization:**
  - `@DEFAULT_VEL [integer]` - The fallback velocity if Column 3 is omitted.
  - `@DEFAULT_DUR [float]` - The fallback length if Column 4 is omitted.
  - `@RULE [Pitch] VEL=[min]-[max]` - Instructs the parser to randomize velocity within a range if omitted (e.g., `@RULE 42 VEL=75-90`).
  - `@RULE [Pitch] DUR=[float]` - Sets a hardcoded default duration for a specific pitch, overriding `@DEFAULT_DUR` (e.g., `@RULE 36 DUR=1.0`).
  - `@RULE LEGATO=TRUE` - Activates algorithmic legato for _monophonic_ sequences. The parser calculates duration to the exact onset of the next chronological event in the track.
    - _Strict Constraint:_ Do not use chordal polyphony (commas or same-beat multi-lines) within a Legato-enabled track. If polyphony is required (e.g., Piano Left Hand vs. Right Hand), initialize separate `@TRACK` blocks routed to the same `@CHANNEL`.
    - _Programming Rests:_ To program a Rest in a Legato track, you must explicitly define the duration in Column 4 to break the Legato chain (e.g., `1.0 C5 _ 1.0` will play for 1 beat and rest until the next note).
- **Custom Drum Mapping:**
  - `@MAP [Name]=[Integer]` - Allows the LLM to use semantic names instead of arbitrary integers in the Pitch column (e.g., `@MAP kick=36`).
  - _Strict Lexical Rule:_ The `[Name]` string must consist entirely of alphanumeric characters and underscores (`A-Z`, `a-z`, `0-9`, `_`). Hyphens, spaces, and special characters are strictly prohibited and will cause a parsing failure.
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
3. **Legato Auto-Calculation:** If `@RULE LEGATO=TRUE` is active, the duration is dynamically calculated to exactly reach the next chronological row's onset. (Note: Must be used strictly on monophonic tracks).
   - _Final Note Constraint:_ If there is no subsequent event in the track, Legato calculation aborts and defers to Step 4. Therefore, **the final note of any Legato sequence MUST have an explicitly declared duration in Column 4** to prevent it from defaulting to a short, clipped note.
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
// Generates note 42 every 0.5 beats from beat 1.0 up to (but not including) 5.0
1.0-5.0/0.5 42

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
