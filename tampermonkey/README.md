# Tampermonkey script: Gemini LMP to MIDI Download

When you use **Google Gemini** to generate LMP (Lean Musical Protocol) text, this script lets you compile it to a MIDI file and download it in one click.

## What it does

- **Runs on:** [Gemini](https://gemini.google.com/)
- **Adds:** A small floating panel (bottom-right) with **Check clipboard** and **Download MIDI**.
- **Flow:** Paste LMP text into Gemini (or copy from a response). Click **Check clipboard** to detect LMP; then **Download MIDI** opens the [LMP API runner](https://zunaidfarouque.github.io/LMP-Specification/api/run.html), compiles your LMP to MIDI, and downloads the file. The runner window closes automatically.

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension in your browser (Chrome, Firefox, Edge, etc.).
2. Click the install link below. Tampermonkey will open and ask you to confirm.
3. Confirm **Install**. The script will run on `gemini.google.com`.

**Install link (raw script):**  
[https://github.com/zunaidFarouque/LMP-Specification/raw/main/tampermonkey/gemini-lmp-download.user.js](https://github.com/zunaidFarouque/LMP-Specification/raw/main/tampermonkey/gemini-lmp-download.user.js)

## Manual install

If you prefer to install manually: open Tampermonkey → **Create new script** → paste the contents of `gemini-lmp-download.user.js` → save.

## Requirements

- Browser with Tampermonkey (or compatible userscript manager).
- The script opens the LMP API runner on the project’s GitHub Pages site; that site must be reachable (no firewall blocking).
