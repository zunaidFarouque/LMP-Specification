# Userscript: AI to MIDI / LMP Playground & Downloader

A lightweight, zero-dependency browser extension script that turns **Google Gemini**, **ChatGPT**, and **Claude** into an interactive MIDI production workstation.

When an AI model generates LMP (Lean Musical Protocol) notation inside a code block, this userscript detects it and injects an inline toolbar directly into the chat interface.

## Key Features

- **Multi-Platform Support:** Works automatically across:
  - Google Gemini (`https://gemini.google.com/*`)
  - OpenAI ChatGPT (`https://chatgpt.com/*` & `https://chat.openai.com/*`)
  - Anthropic Claude (`https://claude.ai/*`)
- **Offline / Local Compiler:** Bundles `lmp-core.v1.iife.min.js` directly within the script. No external API runner or popups required; compilation is instantaneous, private, and works offline.
- **In-Browser WebAudio Synth (`▶ Play`):** Audition melodies and drum patterns instantly directly from the chat window with zero latency.
- **One-Click Download (`⬇ MIDI`):** Generates standard Type-1 `.mid` files directly in memory and saves them straight to your Downloads folder.
- **Reactive Streaming Detection:** Uses a debounced `MutationObserver` to attach controls as soon as code blocks stream into the conversation.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for Chrome, Firefox, Safari, or Edge.
2. Click the install link below:
   **[Install Script (Raw)](https://github.com/zunaidFarouque/LMP-Specification/raw/main/tampermonkey/gemini-lmp-download.user.js)**
3. Tampermonkey will detect the userscript and prompt for confirmation. Click **Install**.
4. Open Gemini, ChatGPT, or Claude and ask the model to generate LMP music!

### Manual Installation
If you prefer manual setup:
1. Open the Tampermonkey dashboard → **Utilities** or **+ (Add Script)**.
2. Copy and paste the full contents of [`gemini-lmp-download.user.js`](file:///d:/_installed/VScode%20repos/AI/Cursor/LMP-Specification/tampermonkey/gemini-lmp-download.user.js).
3. Save (`Ctrl+S` / `Cmd+S`).

## Rebuilding the Script
To re-bundle the latest compiler release into the userscript:
```bash
# In compiler-js:
npm run build:iife

# In tampermonkey:
node build.js
```
