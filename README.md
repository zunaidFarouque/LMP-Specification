# Lean Musical Protocol (LMP) v2.0

An ultra-lean, token-efficient text-to-MIDI music sequencing protocol engineered specifically for Large Language Models (LLMs) and autonomous agent workflows.

**🌐 [Website](https://zunaidfarouque.github.io/LMP-Specification/)** — Specification, LLM guides, next-gen Web Studio, and LMP ↔ MIDI API.

## 🎵 What is LMP v2.0?

The **Lean Musical Protocol (LMP)** is a stateful, Space-Separated Value (SSV) grid format designed to act as the perfect intermediary language between AI models and binary MIDI data. 

Unlike traditional music notation or standard MIDI files—which are illegible or mathematically confusing to modern Byte-Pair Encoding (BPE) tokenizers—LMP is built from the ground up for **bidirectional LLM interaction**. It allows AI models to "read" existing MIDI files, understand their musical context, and "write" new, mathematically precise compositions without context window bloat.

### The Bidirectional Pipeline

LMP operates as a seamless, two-way translation layer:

1. **MIDI ➔ LMP ➔ AI (Contextual Analysis):** An LMP parser converts standard binary `.mid` files into the highly compressed LMP text format. This allows an LLM to read, analyze, and understand existing melodies, rhythms, or entire multitrack arrangements using minimal tokens.
2. **AI ➔ LMP ➔ MIDI (Generative Output):** The LLM generates or modifies music by writing LMP syntax. The parser then strictly compiles this deterministic text back into a standard, playable `.mid` file.

## ❓ Why LMP? (The Problem & The Solution)

When tasking LLMs with music generation or analysis, standard data formats fail catastrophically:
* **JSON/XML:** Introduce massive token bloat due to structural repetition (brackets, quotes, and repeated keys).
* **CSV:** Commas frequently disrupt the continuous integer tokenization flow inherent in LLMs, degrading mathematical reasoning.
* **Standard MIDI (Delta-Time):** MIDI relies on relative "delta-time" between events. LLMs struggle with cumulative arithmetic, often losing the "downbeat" and causing rhythmic drift over long sequences.

**The LMP Solution:**
* **BPE-Optimized Whitespace:** LMP utilizes a strict Space-Separated Value (SSV) grid. Modern tokenizers highly compress contiguous whitespace, saving massive amounts of context.
* **Absolute Floating-Point Grid:** Beat placements are absolute (e.g., `1.0`, `2.5`), completely eliminating cumulative delta-time arithmetic errors for the LLM. 
* **Stateful DRY Architecture:** Cascading fallbacks, global headers, and track defaults ensure the LLM never repeats itself, omitting redundant velocity and duration data.
* **AI-Ergonomic Self-Healing:** The v2 compiler tolerates natural spaces in chords (`1.0 C4, E4, G4`), markdown code fences, and multi-word track names without silent data loss.
* **Deterministic Humanization:** `@SEED <int>` enables reproducible, hash-based velocity and timing variation.

## 📊 LMP-Bench Benchmark Results

Evaluated across 7 musical genres against standard representations:
* **Token Compression Ratio:** **4.04x vs. MIDI-JSON** (~75%–95% token savings).
* **Note Reconstruction Fidelity:** **100.0% F1 score** on bidirectional roundtrips (`MIDI ↔ LMP`).
* **Syntax Validity Rate (SVR):** **98.0%** first-pass validity on lightweight models (Flash-Lite) across 50 empirical stress test runs.

## 🚀 Use Cases

* **Autonomous Agent Workflows & MCP:** Direct integration with AI agent loops via the official `@lmp-midi/mcp` Model Context Protocol server.
* **Algorithmic Composition & "Vibe-Coding":** Rapidly prototype complex, multi-track sequences, algorithmic legato, or custom drum maps (e.g., Tabla bols) using simple text generation.
* **In-Browser Audio Generation:** Zero-dependency procedural WebAudio synthesis directly from text in the next-gen web studio.

## 🤖 Give LMP to an AI (Direct Links & Jina Reader)

You can give an AI assistant (ChatGPT, Claude, Gemini, Cursor, Copilot, Perplexity) the LMP specification **instantly without downloading or uploading files**. Simply copy a link below and append it to your prompt.

> **💡 Jina Reader Links (`https://r.jina.ai/...`)** automatically bypass web rate-limits, auth walls, and HTML formatting, serving clean, high-speed markdown directly into the AI's context window.

### 📋 Direct Specification Links

| Specification Target | When to Use | Jina Reader Link (Recommended for LLMs) | Raw GitHub Link |
| :--- | :--- | :--- | :--- |
| **⭐ Master AI Spec (All-in-One)** | **Default Choice.** Full multitrack composition with chords, basslines, melodies, drums, and syntax rules in one file. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-FULL.md` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-FULL.md) |
| **General AI Guide** | Lightweight context footprint (~2,200 tokens) for quick, simple single-instrument phrases or basic syntax. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-General.md` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-General.md) |
| **Melodic & Chords Guide** | Focused harmonic work: voice leading (`+`), polyphony, pitch bends (`PB`), dynamics (`CC`), and legato phrasing. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-Melodic.md` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-Melodic.md) |
| **Drums & Percussion Guide** | Dedicated rhythm sequencing: GM drum map, repeating loops (`1.0-5.0:1/2`), modifiers (`\| R`, `\| V`), and accents. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-Percussive.md` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-Percussive.md) |
| **Soundiron Tablas 2.0 Drummap** | Indian classical rhythms (Keherwa, Teental, Roopak) using acoustic Dayan/Bayan sample mappings. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/Custom%20Drummap%20Examples/Indian%20Tablas/LMP-AI-Tabla.md` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/Custom%20Drummap%20Examples/Indian%20Tablas/LMP-AI-Tabla.md) |
| **Standard `llms.txt`** | Index file for automated AI tooling, web scrapers, and agents supporting the `llms.txt` standard. | `https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/llms.txt` | [Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/llms.txt) |

> 🛠️ **Building a compiler, parser, validator, or DAW plugin?**  
> If you are an engineer building tooling rather than generating music, refer to the **[Full Technical Specification](specs/LMP%20v1%20-%20Spec.md)** ([Raw Link](https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/LMP%20v1%20-%20Spec.md) | [Jina Link](https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/LMP%20v1%20-%20Spec.md)), which contains the formal EBNF grammar, AST JSON schema, diagnostic specs, and binary MIDI encoding rules.


### 💬 Copy-Paste Prompt Example

Copy and paste this directly into ChatGPT, Claude, or Gemini:

```text
Please read the LMP specification at https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-FULL.md and compose a syncopated 4-bar Neo-Soul chord progression and bassline in LMP syntax.
```

### ⚡ Using in Cursor or Windsurf (`@Docs`)

1. Open **Cursor Settings** (`Ctrl+,`) → **Features** → **Docs** → **Add new doc**.
2. Paste: `https://github.com/zunaidFarouque/LMP-Specification/tree/main/specs` (or the `llms.txt` raw link).
3. Set the prefix to `@LMP`.
4. Now in any prompt, simply type: `@LMP write an 8-bar synthwave arpeggio and drum groove`.

---

## 📂 Repository Structure

* [`llms.txt`](./llms.txt) — Modern LLM context index following the `llms.txt` standard.
* [`specs/`](./specs/) — Complete formal specifications and modular AI system prompt guides:
  * [`specs/ai/LMP-AI-FULL.md`](./specs/ai/LMP-AI-FULL.md) — **Master All-in-One AI Specification** (General, Melodic, Percussive).
  * [`specs/ai/LMP-AI-General.md`](./specs/ai/LMP-AI-General.md) — The primary ~2,200-token prompt guide for general LLMs.
  * [`specs/ai/LMP-AI-Melodic.md`](./specs/ai/LMP-AI-Melodic.md) & [`specs/ai/LMP-AI-Percussive.md`](./specs/ai/LMP-AI-Percussive.md) — Targeted domain guides.
* [`compiler-js/`](./compiler-js/) — Core JavaScript compiler & decompiler (`lmp-core` v2.0.0). Run `bun test` to execute the 136 core unit tests.
* [`lmp-mcp/`](./lmp-mcp/) — Official Model Context Protocol server exposing `compile_lmp`, `decompile_midi`, and `validate_lmp`.
* [`bench/`](./bench/) — `LMP-Bench` evaluation harness and 50-run statistical stress testing suite. Run `npm run bench`.
* [`studio-web/`](./studio-web/) — Next-gen interactive web studio with bidirectional visual-to-code synchronization, multi-track mixer, live syntax linter, and AI Musical Friend copilot.
* [`tampermonkey/`](./tampermonkey/) — Browser userscript for inline MIDI playback and export on Gemini, ChatGPT, and Claude.
* [`RELEASE-NOTES-v2.md`](./RELEASE-NOTES-v2.md) — Complete release notes for LMP v2.0.0.

---
*Built for the future of AI-driven music production.*
