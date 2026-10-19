# LMP-Bench: Scientific Evaluation Harness for Lean Musical Protocol

`LMP-Bench` is an automated benchmark suite measuring the generation reliability, token efficiency, and musical fidelity of the **Lean Musical Protocol (LMP)** against industry-standard representations (MIDI-JSON, MIDI-CSV).

## Key Metrics

1. **Syntax Validity Rate (SVR):**
   Percentage of syntactically valid compositions that compile cleanly into binary Standard MIDI format (measured under both Strict and Loose parsing modes).
2. **Token Compression Ratio (TCR):**
   Evaluation of LLM context window efficiency:
   $$\text{TCR} = \frac{\text{Tokens}_{\text{Baseline (JSON / CSV)}}}{\text{Tokens}_{\text{LMP}}}$$
   Measures token savings using standard Unicode-aware Byte-Pair Encoding (BPE) tokenization.
3. **Reconstruction Fidelity ($F_1$ Score):**
   Evaluates harmonic and temporal preservation through the full round-trip lifecycle:
   $$\text{LMP} \xrightarrow{\text{compile}} \text{MIDI} \xrightarrow{\text{decompile}} \text{LMP} \xrightarrow{\text{recompile}} \text{MIDI}$$
   Calculates note-level Precision, Recall, and $F_1$ score across exact pitch, onset beat ($\pm 0.02$), and duration ($\pm 0.05$).

## Benchmark Corpus

The corpus spans 7 standard musical genres and production idioms:
- **Pop:** Diatonic chord progression + syncopated vocal melody.
- **Electronic (EDM):** Four-on-the-floor kick, backbeat snare, 16th-note rolling hi-hats with accent modifiers, and acid bass.
- **Classical:** Polyphonic two-part counterpoint (J.S. Bach invention style) with voice leading and rests.
- **Jazz:** Swing rhythm, 7th chords, and walking bass.
- **World / Indian Classical:** Keherwa taal tabla groove with Bayan slides, Dayan strokes, and seeded velocity humanization.
- **Metal / Progressive:** 7/8 odd-meter polyrhythm with double-kick and down-tuned riffs.
- **Ambient:** Dynamic soundscape with continuous CC11 expression swells, sustain pedal (CC64), and pitch bends.

## Running the Benchmark

```bash
# In the bench/ directory:
bun run bench

# Run unit tests:
bun test
```
Outputs a formatted comparison table in the console and saves the full report to `lmp-bench-report.json`.
