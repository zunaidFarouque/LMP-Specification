import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iifePath = path.resolve(__dirname, '../compiler-js/dist/lmp-core.v1.iife.min.js');
const outputPath = path.resolve(__dirname, 'gemini-lmp-download.user.js');

if (!fs.existsSync(iifePath)) {
  console.error('Error: compiler-js/dist/lmp-core.v1.iife.min.js not found. Run npm run build in compiler-js first.');
  process.exit(1);
}

const iifeCode = fs.readFileSync(iifePath, 'utf8');

const userScriptHeader = `// ==UserScript==
// @name         AI to MIDI / LMP Playground & Downloader
// @namespace    https://github.com/zunaidFarouque/LMP-Specification
// @version      2.0.0
// @description  Detects Lean Musical Protocol (LMP) blocks on Gemini, ChatGPT, and Claude. Injects instant Play (WebAudio synth) and MIDI download buttons directly into the chat interface!
// @author       Zunaid Farouque
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @grant        GM_download
// @grant        GM_setClipboard
// ==/UserScript==
`;

const clientLogic = `
(function () {
  'use strict';

  // --- 1. Bundled LMP Compiler Core ---
  ${iifeCode}

  const LMP_CORE = typeof LMP !== 'undefined' ? LMP : (globalThis.LMP || window.LMP);
  if (!LMP_CORE) {
    console.error('[LMP Userscript] Failed to initialize bundled LMP compiler.');
    return;
  }

  // --- 2. Audio Engine (WebAudio Polyphonic Synthesizer + Drum Engine) ---
  let activeAudioCtx = null;
  let activePlayBtn = null;
  let playbackTimer = null;

  function stopPlayback() {
    if (playbackTimer) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch (e) {
        // AudioContext already closed
      }
      activeAudioCtx = null;
    }
    if (activePlayBtn) {
      activePlayBtn.textContent = '▶ Play';
      activePlayBtn.style.background = '#2563eb';
      activePlayBtn = null;
    }
  }

  function playMidi(midiBytes, onFinish, btn) {
    stopPlayback();
    activePlayBtn = btn;
    if (btn) {
      btn.textContent = '⏹ Stop';
      btn.style.background = '#dc2626';
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      alert('WebAudio API is not supported in this browser.');
      stopPlayback();
      return;
    }

    const ctx = new AudioContextClass();
    activeAudioCtx = ctx;

    let parsed;
    try {
      parsed = LMP_CORE.parseMidi(midiBytes);
    } catch (err) {
      alert('MIDI parsing error: ' + (err.message || String(err)));
      stopPlayback();
      return;
    }

    const ppqn = parsed.header.ticksPerBeat || 480;
    let tempoUs = 500000; // default 120 bpm

    // Check for setTempo in meta events
    for (const track of parsed.tracks) {
      for (const evt of track) {
        if (evt.type === 'setTempo' && evt.microsecondsPerBeat) {
          tempoUs = evt.microsecondsPerBeat;
          break;
        }
      }
    }

    const secondsPerTick = (tempoUs / 1000000) / ppqn;
    const now = ctx.currentTime + 0.05;
    let maxEndTime = now;

    // Track active notes per channel+pitch
    for (const track of parsed.tracks) {
      let tick = 0;
      const activeNotes = new Map();

      for (const evt of track) {
        tick += evt.deltaTime || 0;
        const ch = evt.channel ?? 0;
        const pitch = evt.noteNumber;

        if (evt.type === 'noteOn' && evt.velocity > 0) {
          activeNotes.set(ch + ':' + pitch, { tick, velocity: evt.velocity });
        } else if (evt.type === 'noteOff' || (evt.type === 'noteOn' && evt.velocity === 0)) {
          const key = ch + ':' + pitch;
          const noteStart = activeNotes.get(key);
          if (noteStart) {
            activeNotes.delete(key);
            const startTime = now + noteStart.tick * secondsPerTick;
            const duration = Math.max(0.04, (tick - noteStart.tick) * secondsPerTick);
            const velRatio = (noteStart.velocity || 80) / 127;
            const endTime = startTime + duration;
            if (endTime > maxEndTime) maxEndTime = endTime;

            if (ch === 9) {
              playDrumVoice(ctx, pitch, startTime, velRatio);
            } else {
              playMelodicVoice(ctx, pitch, startTime, duration, velRatio);
            }
          }
        }
      }
    }

    const totalDuration = maxEndTime - now;
    if (totalDuration > 0) {
      playbackTimer = setTimeout(() => {
        stopPlayback();
        if (onFinish) onFinish();
      }, (totalDuration + 0.1) * 1000);
    } else {
      stopPlayback();
    }
  }

  function playMelodicVoice(ctx, pitch, startTime, duration, velRatio) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 440 * Math.pow(2, (pitch - 69) / 12);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const peak = 0.22 * velRatio;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
      gain.gain.setValueAtTime(peak * 0.75, startTime + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      // Audio scheduling edge-case guard
    }
  }

  function playDrumVoice(ctx, pitch, startTime, velRatio) {
    try {
      if (pitch === 35 || pitch === 36) {
        // Bass Drum / Kick: Pitch sweep sine oscillator
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(140, startTime);
        osc.frequency.exponentialRampToValueAtTime(36, startTime + 0.12);

        gain.gain.setValueAtTime(0.45 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.16);
      } else if (pitch === 38 || pitch === 40) {
        // Snare: Filtered white noise
        const bufferSize = Math.floor(ctx.sampleRate * 0.14);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + 0.14);
      } else {
        // Hi-Hat / Percussion / Cymbals
        const bufferSize = Math.floor(ctx.sampleRate * 0.05);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(6500, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + 0.05);
      }
    } catch (e) {
      // Ignore drum synthesis scheduling errors
    }
  }

  // --- 3. Utilities & Detection ---
  const LMP_HEADER_REGEX = /@LMP\s+[\d.]+/i;
  const TRACK_HEADER_REGEX = /@TRACK\s+\d+/i;

  function isLmpContent(text) {
    if (!text || typeof text !== 'string') return false;
    const firstLines = text.split('\\n').slice(0, 15).join('\\n');
    return LMP_HEADER_REGEX.test(firstLines) || (TRACK_HEADER_REGEX.test(firstLines) && /@CHANNEL\s+\d+/i.test(firstLines));
  }

  function extractLmpText(el) {
    const clone = el.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('.lmp-action-toolbar, button, [role="button"]');
    elementsToRemove.forEach(e => e.remove());
    const raw = clone.innerText || clone.textContent || '';

    const lines = raw.split(/\\r?\\n/);
    const startIdx = lines.findIndex(l => /^\\s*@(LMP|BPM|TIMESIG|PPQN|ORIGIN|SEED|TRACK|MAP|RULE|DEFAULT_)/i.test(l));
    if (startIdx === -1) return raw.trim();
    return lines.slice(startIdx).join('\\n').trim();
  }

  function getFilename(text) {
    const m = text.match(/@TRACK\\s+\\d+\\s+([^\\r\\n]+)/i);
    let name = m ? m[1].trim().replace(/[/\\\\:*?"<>|]/g, '_') : 'LMP_Composition';
    name = name.replace(/\\s+/g, '_');
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return \`\${name}_\${date}_\${time}.mid\`;
  }

  function triggerDownload(midiBytes, filename) {
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --- 4. DOM Injection & UI ---
  function attachToolbar(block) {
    if (block.dataset.lmpInjected === 'true') return;

    const rawText = block.innerText || block.textContent || '';
    if (!isLmpContent(rawText)) return;

    block.dataset.lmpInjected = 'true';

    // Position container relatively if needed
    const computedPos = window.getComputedStyle(block).position;
    if (computedPos === 'static') {
      block.style.position = 'relative';
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'lmp-action-toolbar';
    toolbar.style.cssText = [
      'position: absolute',
      'top: 8px',
      'right: 56px',
      'z-index: 1000',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'background: rgba(15, 23, 42, 0.92)',
      'border: 1px solid rgba(255, 255, 255, 0.16)',
      'border-radius: 6px',
      'padding: 3px 6px',
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 11px',
      'color: #e2e8f0',
      'backdrop-filter: blur(6px)'
    ].join(';');

    const badge = document.createElement('span');
    badge.textContent = 'LMP';
    badge.style.cssText = 'background:#0f766e;color:#5eead4;padding:2px 5px;border-radius:4px;font-weight:700;font-size:10px;letter-spacing:0.5px;';

    const playBtn = document.createElement('button');
    playBtn.textContent = '▶ Play';
    playBtn.style.cssText = [
      'background: #2563eb',
      'color: #ffffff',
      'border: none',
      'border-radius: 4px',
      'padding: 3px 8px',
      'font-size: 11px',
      'font-weight: 500',
      'cursor: pointer',
      'transition: background 0.15s ease'
    ].join(';');

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (activePlayBtn === playBtn) {
        stopPlayback();
        return;
      }

      const lmpText = extractLmpText(block);
      try {
        const res = LMP_CORE.compile(lmpText, { loose: true });
        const midiBytes = res.midi || res;
        playMidi(midiBytes, () => {
          playBtn.textContent = '▶ Play';
          playBtn.style.background = '#2563eb';
        }, playBtn);
      } catch (err) {
        alert('LMP Compile Error: ' + (err.message || String(err)));
      }
    });

    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇ MIDI';
    dlBtn.style.cssText = [
      'background: #334155',
      'color: #f8fafc',
      'border: none',
      'border-radius: 4px',
      'padding: 3px 8px',
      'font-size: 11px',
      'font-weight: 500',
      'cursor: pointer',
      'transition: background 0.15s ease'
    ].join(';');

    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const lmpText = extractLmpText(block);
      try {
        const res = LMP_CORE.compile(lmpText, { loose: true });
        const midiBytes = res.midi || res;
        const filename = getFilename(lmpText);
        triggerDownload(midiBytes, filename);
      } catch (err) {
        alert('LMP Compile Error: ' + (err.message || String(err)));
      }
    });

    toolbar.appendChild(badge);
    toolbar.appendChild(playBtn);
    toolbar.appendChild(dlBtn);
    block.appendChild(toolbar);
  }

  function scanCodeBlocks() {
    const candidates = document.querySelectorAll('pre, [class*="code-block"], [class*="codeblock"], code-block');
    for (const el of candidates) {
      attachToolbar(el);
    }
  }

  // --- 5. Observer & Initialization ---
  let scanDebounce = null;
  function scheduleScan() {
    if (scanDebounce) return;
    scanDebounce = setTimeout(() => {
      scanDebounce = null;
      scanCodeBlocks();
    }, 250);
  }

  const observer = new MutationObserver((mutations) => {
    scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scan on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanCodeBlocks);
  } else {
    scanCodeBlocks();
  }

  console.log('[LMP Userscript] Initialized with local compiler & WebAudio engine on', window.location.hostname);
})();
`;

const fullScript = userScriptHeader + clientLogic;
fs.writeFileSync(outputPath, fullScript, 'utf8');
console.log('Successfully built', outputPath, 'Size:', fullScript.length, 'bytes');
