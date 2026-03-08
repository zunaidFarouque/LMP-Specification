// ==UserScript==
// @name         Gemini LMP to MIDI Download
// @namespace    https://github.com/zunaidFarouque/LMP-Specification
// @version      1.0.6
// @description  Detect LMP content on Gemini, compile to MIDI and download
// @match        https://gemini.google.com/*
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  "use strict";

  const LMP_CDN =
    "https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/refs/heads/main/compiler-js/dist/lmp-core.v1.iife.min.js";
  const LMP_HEADER_REGEX = /@LMP\s+[\d.]+/i;
  const TRACK1_REGEX = /@TRACK\s+1\s+(\S+)/;
  const LINES_TO_CHECK = 10;

  const BUTTON_STYLE =
    "padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:opacity 0.2s;";
  const PRIMARY_STYLE =
    BUTTON_STYLE +
    "background:#8ab4f8;color:#1e3a5f;";
  const SECONDARY_STYLE =
    BUTTON_STYLE +
    "background:#3c4043;color:#e8eaed;";

  let lastPastedText = "";
  let downloadBtn = null;
  let checkBtn = null;

  function getFirstLines(text, n) {
    return (text || "").split("\n").slice(0, n).join("\n");
  }

  function isLmpContent(text) {
    return LMP_HEADER_REGEX.test(getFirstLines(text || "", LINES_TO_CHECK));
  }

  function getTrackName(text) {
    const m = (text || "").match(TRACK1_REGEX);
    return m ? m[1].replace(/[/\\:*?"<>|]/g, "_") : "LMP";
  }

  function getFilename(text) {
    const name = getTrackName(text);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    return `${name}_${date}_${time}.mid`;
  }

  let compilerScript = null;

  function fetchCompiler() {
    return new Promise((resolve, reject) => {
      if (compilerScript) return resolve(compilerScript);
      GM_xmlhttpRequest({
        method: "GET",
        url: LMP_CDN,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) {
            compilerScript = r.responseText;
            resolve(compilerScript);
          } else {
            reject(new Error("Failed to load LMP compiler"));
          }
        },
        onerror: () => reject(new Error("Failed to load LMP compiler")),
      });
    });
  }

  function b64EncodeUnicode(str) {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, c) =>
        String.fromCharCode(parseInt(c, 16))
      )
    );
  }

  function openCompileTab(scriptContent, lmpText, filename) {
    const compilerEscaped = scriptContent.replace(/<\/script>/gi, "<\\/script>");
    const lmpB64 = b64EncodeUnicode(lmpText);
    const fnEscaped = filename.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const html =
      "<!DOCTYPE html><html><head><meta charset=utf-8><script>" +
      compilerEscaped +
      "</script></head><body><script>" +
      'var lmpB64="' +
      lmpB64.replace(/"/g, '\\"') +
      '";var fn="' +
      fnEscaped +
      '";' +
      "try{var t=decodeURIComponent(atob(lmpB64).split('').map(function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)}).join(''));" +
      "var r=LMP.compile(t,{loose:!0});var m=r.midi||r;" +
      "var b=new Blob([m],{type:'audio/midi'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();URL.revokeObjectURL(a.href);" +
      "if(window.opener){window.opener.focus()}setTimeout(window.close,500)}catch(e){document.body.textContent='Error: '+e.message}</script></body></html>";
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    window.open(dataUrl, "_blank", "noopener=0");
  }

  async function handleDownload() {
    const text = lastPastedText;
    if (!text || !isLmpContent(text)) {
      alert("No LMP content in clipboard. Paste LMP text first.");
      return;
    }
    try {
      const scriptContent = await fetchCompiler();
      const filename = getFilename(text);
      openCompileTab(scriptContent, text, filename);
    } catch (err) {
      alert("Compile error: " + (err.message || String(err)));
    }
  }

  function createUI() {
    const container = document.createElement("div");
    container.id = "lmp-download-container";
    container.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;";

    checkBtn = document.createElement("button");
    checkBtn.textContent = "Check clipboard";
    checkBtn.style.cssText = SECONDARY_STYLE;
    checkBtn.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        lastPastedText = text;
        if (isLmpContent(text)) {
          downloadBtn.style.display = "block";
        } else if (downloadBtn) {
          downloadBtn.style.display = "none";
        }
      } catch (e) {
        /* clipboard permission denied */
      }
    };

    downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download MIDI";
    downloadBtn.style.cssText = PRIMARY_STYLE;
    downloadBtn.onclick = handleDownload;
    downloadBtn.style.display = "none";

    container.append(checkBtn, downloadBtn);
    document.body.appendChild(container);
  }

  function onPaste(e) {
    const text = e.clipboardData?.getData("text/plain") || "";
    lastPastedText = text;
    if (downloadBtn && isLmpContent(text)) {
      downloadBtn.style.display = "block";
    } else if (downloadBtn) {
      downloadBtn.style.display = "none";
    }
  }

  document.addEventListener("paste", onPaste);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }
})();
