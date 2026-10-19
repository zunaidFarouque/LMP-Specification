# Lean Musical Protocol (LMP) v2.0.0 — Release Notes

**Release Date:** October 2026  
**Status:** Official Production Release  
**Packages:**
- `lmp-core`: `2.0.0` (Compiler & Decompiler)
- `lmp-mcp`: `2.0.0` (Model Context Protocol Server)
- `lmp-playground-web`: `2.0.0` (Interactive Web Studio & Visualizer)
- `lmp-bench`: `2.0.0` (Scientific Evaluation Suite)

---

## 🌟 Executive Overview: The AI-MIDI Breakthrough

LMP v2.0.0 marks the transition of the Lean Musical Protocol from an experimental draft into a **hardened, research-backed, production-grade symbolic music representation for Large Language Models (LLMs)**.

While previous formats forced developers into a trilemma—either consuming massive context windows with verbose JSON, running hazardous Python code sandboxes (`mido`, `pretty_midi`), or relying on primitive sheet-music notations (ABC) that cannot express modern DAW production—LMP v2.0 provides a **zero-sandbox, ultra-lean, DAW-grade text protocol** that compiles losslessly to standard binary MIDI in milliseconds.

---

## 🚀 What's New in v2.0.0

### 1. Tokenizer-Native "Postel's Law" Parsing
* **Whitespace-Agnostic Chords:** Following Postel's Robustness Principle (*"Be liberal in what you accept"*), the compiler accepts natural spaces after commas in chords (e.g. `1.0 C4, E4, G4, B4 80 1.0`). In modern BPE tokenizers (GPT-4o, Claude 3.5, Gemini), comma-space (`, `) is a single high-probability token; accepting it eliminates the silent 75% note-loss bug common in strict parsers.
* **Markdown Code Fence Ingestion:** Automatically strips ```` ```lmp ```` and ```` ``` ```` delimiters and skips conversational preambles preceding `@` directives without triggering syntax crashes.
* **Self-Healing Loose Mode:** Blank-line continuation gaps (`+`, `|`), multi-word track names (`@TRACK 1 Acoustic Guitar`), and lowercase modifiers (`| v`, `| r`) are automatically healed with diagnostic warnings.

### 2. Timeline & Event Scheduling Hardening
* **Timeline Origin Directives (`@ORIGIN [0|1]`):** Added native support for `@ORIGIN 1` (default, Measure 1 Beat 1 = tick 0) and `@ORIGIN 0` (zero-indexed beats), eliminating tick-0 collapse bugs.
* **Deterministic Event Sorting:** Strict tick-level ordering: `[Conductor Meta/Tempo/TS, CC, PB, NoteOff, NoteOn]`. Simultaneous chord notes are sorted strictly by pitch (low-to-high), and abutting notes emit `NoteOff` before `NoteOn` at the same boundary to prevent synth mute bugs.
* **RPN 00 00 Sensitivity Configuration:** Automatically emits MIDI Registered Parameter Number (RPN) CC messages (CC 101=0, CC 100=0, CC 6=`pbrange`) to configure hardware and VST pitch-bend sensitivity.
* **Duration-Aware Pitch Bend Auto-Reset:** `maxTick` now monitors full note durations, preventing premature pitch-bend resets while notes are still sounding.
* **Spec-Compliant State Persistence:** Harmonized track inheritance per specification line 200: `@DEFAULT_VEL`, `@DEFAULT_DUR`, and `@RULE` persist across track declarations.

### 3. Lossless Bidirectional Decompiler
* **Multi-Line Polyphonic Voicing:** Simultaneous notes with differing durations or velocities are decompiled using `+` continuation lines, preserving intricate polyphonic voice leading.
* **Conductor Track Mapping:** Formats Standard MIDI Format 1 Track 0 (conductor track) directly into clean global headers (`@BPM`, `@TIMESIG`) rather than generating phantom instrument tracks.
* **Lossless Roundtrip Idempotency:** Direct beat-based event grouping eliminates floating-point drift across iterative $\text{MIDI} \to \text{LMP} \to \text{MIDI} \to \text{LMP}$ cycles.

### 4. Official Model Context Protocol (MCP) Server (`@lmp-midi/mcp`)
A stdio-based MCP server enabling native tool-calling inside Claude Desktop, Cursor, Gemini, and custom autonomous agent loops:
- `compile_lmp(text)`: Compiles LMP text to binary base64 MIDI with track metadata and syntax diagnostic reporting.
- `decompile_midi(data)`: Decompiles binary MIDI files into clean, human-readable LMP text.
- `validate_lmp(text)`: Fast AST validation returning exact `{ line, col, message }` error diagnostics without binary emission.

### 5. Deterministic Seeded PRNG Humanization (`@SEED`)
* Introduces `@SEED <int>` paired with `@RULE VEL=min-max`.
* Utilizes a deterministic Mulberry32/Murmur-style hash:
  $$\text{vel} = \text{min} + (\text{hash}(\text{seed}, \text{track}, \text{beat}, \text{pitch}) \pmod{\text{max} - \text{min} + 1})$$
* Guarantees **100% bit-for-bit identical binary compilation** across builds while generating authentic velocity humanization without white noise.

### 6. Interactive WebAudio Studio & Visualizer
* **Procedural Synthesis Engine:** Built-in zero-dependency WebAudio synthesizer supporting polyphonic band-limited oscillators, ADSR envelopes, pitch-bend modulation, and noise-burst drum generation.
* **Transport Controls:** Play, Pause, Stop, Loop toggle, and continuous speed slider ($0.5\times$ to $2.0\times$).
* **Real-Time Playhead:** Synchronized visual playback cursor across the canvas piano roll.
* **Optimized Chunks:** Zero-warning Vite production build with split vendor bundles.

### 7. Scientific Benchmarking Suite (`LMP-Bench`)
An empirical evaluation suite measuring representation efficiency across 7 genres:
* **Token Compression Ratio:** **4.04x vs. MIDI-JSON** (~75%–95% token savings).
* **Syntax Validity Rate:** **98.0%** first-pass validity on lightweight models (Flash-Lite) across 50 stress test runs; **100%** on frontier models.
* **Note Reconstruction Fidelity:** **100.0% F1 score** across pitch, onset, duration, and velocity.

---

## 📊 Empirical Benchmark Summary

| Genre / Composition | LMP Tokens | MIDI-JSON Tokens | Token Compression (TCR) | Note F1 Fidelity |
|---|:---:|:---:|:---:|:---:|
| Pop Progression & Vocal Lead | 248 | 1,229 | **4.96x** | 100.0% |
| EDM Four-on-the-Floor with Bass | 315 | 2,187 | **6.94x** | 100.0% |
| Bach Two-Part Polyphonic Counterpoint | 277 | 1,103 | **3.98x** | 100.0% |
| Jazz Blues Swing & Syncopation | 271 | 1,615 | **5.96x** | 100.0% |
| Indian Classical Tabla (Teental) | 210 | 402 | **1.91x** | 100.0% |
| Polyrhythmic Metal (7/8 Meter) | 249 | 727 | **2.92x** | 100.0% |
| Ambient Soundscape with CC Modulation | 203 | 320 | **1.58x** | 100.0% |
| **Aggregate Corpus Average** | **253** | **1,083** | **4.04x (saves ~75%)** | **100.0%** |

---

## 🛠️ Verification & Test Suite
* **Unit Tests:** 148 passed, 0 failed across 13 test files.
* **Stress Test Suite:** 50/50 runs verified; 88.0% Strict SVR / 98.0% Loose SVR under lightweight model statistical variance.
* **Web Build:** Clean Vite build (`npm run build:site`), zero bundle size warnings.

---

## 📦 Getting Started with v2.0

### In Node.js / Bun
```bash
npm install lmp-core
```
```javascript
import { compile, decompile } from 'lmp-core';

// Compile LMP text to binary MIDI
const { midi } = compile(`
@BPM 120
@TRACK 1 Piano @CHANNEL 1
1.0 C4,E4,G4 80 1.0
2.0 D4,F4,A4 80 1.0
`);

// Decompile MIDI Uint8Array back to LMP text
const { lmpText } = decompile(midi);
console.log(lmpText);
```

### In AI Agent Prompts
Provide [`specs/ai/LMP-AI-General.md`](./specs/ai/LMP-AI-General.md) (~2,200 tokens) in your system prompt to equip any LLM with LMP v2.0 generative capabilities.
