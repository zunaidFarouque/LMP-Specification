# LMP Testground Web

Browser-based playground for the Lean Musical Protocol (LMP). Edit LMP, preview MIDI as a piano roll, decompile `.mid` files, and download compiled MIDI.

## Local Development

1. From `compiler-js/`, run:
   ```bash
   bun run build:web
   ```
2. Open `testground-web/index.html` in a browser, or serve the folder:
   ```bash
   npx serve testground-web
   ```

**Note:** When opening via `file://`, the LMP library may not load due to CORS. Click "Load LMP library" and select `compiler-js/dist/lmp-core.v1.iife.min.js` (or the copy in `lib/`). It will be cached in localStorage.

## GitHub Pages Deployment

### Option A: Deploy from this folder

1. Set GitHub Pages source to branch `main`, folder `testground-web` (if your host supports subfolders).
2. Or copy the contents of `testground-web` to your repo root `docs/` folder and set Pages to serve from `docs/`.

### Option B: Use as project site subpath

If your repo is `username/LMP-Specification`, the site will be at:
`https://username.github.io/LMP-Specification/`

To serve the Testground from a subpath, configure your Pages to publish from a branch where `testground-web` is the root, or use a custom 404 redirect (see GitHub Pages docs).

### Before deploying

Run `bun run build:web` from `compiler-js/` to ensure `lib/lmp-core.v1.iife.min.js` is up to date.

### Jekyll

If using Jekyll, add an empty `.nojekyll` file in the served root to prevent underscore-prefixed folders (e.g. `_next`) from being ignored.
