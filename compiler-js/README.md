# LMP-Core

JavaScript compiler for the **Lean Musical Protocol (LMP)**. Converts LMP text to binary MIDI.

## Structure

| Path | Purpose |
|------|--------|
| `/src` | ES module source (parser + four-pass pipeline) |
| `/dist` | Built `lmp-core.v1.min.js` (esbuild) |
| `/specs` | LMP specification documents |
| `/tests` | `.lmp` fixtures and expected `.mid` outputs |

## Build

```bash
bun install
bun run build
```

- `bun run build:dev` → `dist/lmp-core.v1.js` (with sourcemap)
- `bun run build:min` → `dist/lmp-core.v1.min.js`

## Usage (when implemented)

```js
import { compile } from 'lmp-core';

const midiBuffer = compile(lmpText);
```

## Roadmap

1. **Sprint 1:** Parser for `@TRACK`, `@CHANNEL`, `@BPM`; standard event rows; SPN → MIDI.
2. **Sprint 2:** Fallback hierarchy, `@RULE` randomization, `@INHERIT` / `@RESET_TRACK`.
3. **Sprint 3:** Repeating note syntax, `| R` / `| V` / `| D`, same-beat `+`.
4. **Sprint 4:** Legato gap, CC/PB, rest (`R`) logic.
