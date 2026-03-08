# LMP Playground Web

Browser-based playground for the Lean Musical Protocol (LMP). Edit LMP, preview MIDI as a piano roll, decompile `.mid` files, and download compiled MIDI.

**Stack:** Vite, React 18, Tailwind CSS, CodeMirror 6, Lucide React.

## Local Development

```bash
# From project root
bun run build:web   # Builds compiler, copies IIFE, builds playground

# From playground-web/
bun run dev         # Start dev server (http://localhost:5173)
bun run build       # Production build → dist/
bun run preview     # Preview production build
```

## File:// Fallback

When opening via `file://` (or when ESM import fails due to CORS), the LMP library may not load. Click **Load LMP library** and select `playground-web/public/lmp-core.v1.iife.min.js` (or the copy in `dist/` after build). It will be cached in localStorage.

## GitHub Pages Deployment

For a project site at `https://username.github.io/LMP-Specification/`:

```bash
VITE_BASE_PATH=/LMP-Specification/ bun run build
```

Then deploy the `dist/` folder. Add an empty `.nojekyll` file in the served root if using Jekyll.

## Features

- LMP editor with live compile (debounced)
- Multi-track piano roll with track names and separators
- Drum map: load Cubase `.drm` files or use default GM map for channel 10
- Decompile: drag-and-drop `.mid` to convert to LMP
- Download MIDI button
- Examples dropdown (minimal, chords, drums)
