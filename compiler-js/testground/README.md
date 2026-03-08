# LMP Testground

Create `.lmp` files and compile them to MIDI.

## Quick start

```bash
# Compile the sample song
bun run testground

# Or explicitly:
bun run testground/compile.js testground/song.lmp
```

Output: `testground/song.mid`

## Usage

```bash
# Compile any .lmp file (output: same name, .mid extension)
bun run lmp path/to/your.lmp

# Custom output path
bun run lmp song.lmp -o output/my-song.mid

# Loose mode (warnings instead of errors for recoverable violations)
bun run lmp song.lmp --loose
```

## Browser Playground

**testground-web** — Full website with piano roll visualization, examples, and download. Located at repo root `testground-web/`. From `compiler-js/`:

```bash
bun run build:web
```

Then open `testground-web/index.html` or serve the folder. GitHub Pages compatible.

**testground.html** — Lightweight single-file playground. Open in browser (double-click or `file://`). On first load, click **Load LMP library** and select `dist/lmp-core.v1.iife.min.js` (cached in localStorage). Features: live LMP → MIDI preview, drag-and-drop `.mid` to decompile.

## Decompile MIDI to LMP

```bash
# Convert .mid to LMP (prints to stdout)
bun run decompile testground/song.mid

# Save to file
bun run decompile song.mid -o output.lmp
```

## Creating an LMP file

1. Create a `.lmp` file (e.g. `testground/my-song.lmp`)
2. Write LMP syntax per the spec (see `specs/LMP v1 - Spec.md` or `../../specs/LMP v1 - Spec.md`)
3. Run: `bun run lmp testground/my-song.lmp`
4. Open the generated `.mid` file in a DAW or MIDI player

## Sample structure

See `song.lmp` for a minimal example with piano chords and flute legato.
