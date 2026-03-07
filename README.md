# Lean Musical Protocol (LMP)

An ultra-lean, token-efficient text-to-MIDI music sequencing protocol engineered specifically for Large Language Models (LLMs) and autonomous agent workflows.

## 🎵 What is LMP?

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

## 🚀 Use Cases

* **Autonomous Agent Workflows:** Build LLM tool-calling architectures that analyze incoming audio/MIDI, rewrite arrangements, and output new files. If you are automating this via local containerized environments like n8n, you can easily mount your working directories (e.g., `-v D:\Temp\DockerThings\mine\my-n8n-setup:/data`) to handle the bidirectional text-to-binary file handoffs seamlessly.
* **Algorithmic Composition & "Vibe-Coding":** Rapidly prototype complex, multi-track sequences, algorithmic legato, or custom drum maps (e.g., Tabla bols) using simple text generation, allowing you to "prompt" entire orchestral arrangements.
* **Dataset Generation:** Compress large libraries of MIDI files into highly efficient LMP text datasets for fine-tuning open-source LLMs on specific musical genres or compositional styles.

## 📂 Repository Structure

* [`specification.md`](./specification.md) - The definitive standard for the syntax, lexical formatting, and parsing rules of LMP v1.
* `/parsers` *(Coming Soon)* - Official open-source parser implementations (JavaScript/C++) for bidirectional MIDI ⟷ LMP compilation.

---
*Built for the future of AI-driven music production.*
