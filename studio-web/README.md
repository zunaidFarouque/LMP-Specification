# LMP Web Studio (Next-Gen)

A DAW-grade web studio for the Lean Musical Protocol (LMP) featuring bidirectional visual-to-code synchronization, an interactive multi-tool piano roll, multi-track mixer, live syntax linter, and an AI Musical Friend copilot.

## Features

- **Bidirectional Synchronization:** Move, resize, or draw notes visually in the Piano Roll and watch the LMP code update chronologically in real time; edit the code and watch the piano roll reflect changes instantly.
- **Interactive Multi-Tool Piano Roll:** Pointer, Pencil (click-and-drag duration), Eraser, sound auditioning on drag/draw, and velocity lane editing with stabilized handles.
- **Multi-Track Mixer & Arranger:** Real-time volume (CC 7) and pan (CC 10) controls, mute/solo, channel assignment, instrument selection, track addition, and custom Drum Map (`@MAP`) manager supporting Cubase `.drm`, CSV, and key=value formats.
- **Smart Focus & Line Hovering:** Bidirectional hover highlighting between code lines and piano roll notes, token-level pitch badges (`E3`), and selection-only focus lock.
- **Common Chord Collapsing:** Automatic merging of simultaneous notes sharing identical beat, velocity, and duration into compact chords (`5.0 G3,B3,E4 88 2.0`), with an instant UI toggle.
- **Live Syntax Linter:** Real-time CodeMirror diagnostic underlines and tooltip explanations for protocol syntax errors.
- **AI Musical Friend Copilot:** Multi-variation generation with ghost-note piano roll overlays and solo/context auditioning.

## Development

```bash
# Run local dev server
npm run dev

# Run unit tests (67 TDD tests)
bun test

# Type check
bunx tsc -b

# Production build
npm run build
```
