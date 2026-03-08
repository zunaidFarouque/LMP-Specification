// ==UserScript==
// @name         Gemini LMP to MIDI Download
// @namespace    https://github.com/zunaidFarouque/LMP-Specification
// @version      1.0.8
// @description  Detect LMP content on Gemini, compile to MIDI and download
// @match        https://gemini.google.com/*
// @connect      zunaidfarouque.github.io
// @connect      cdn.jsdelivr.net
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  const API_PAGE_URL =
    "https://zunaidfarouque.github.io/LMP-Specification/api/run.html";
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

  function base64Lmp(lmpText) {
    return btoa(unescape(encodeURIComponent(lmpText)));
  }

  function openApiPage(lmpText, filename) {
    const params = new URLSearchParams();
    params.set("dir", "lmp2midi");
    params.set("lmp", base64Lmp(lmpText));
    params.set("filename", filename);
    params.set("loose", "1");
    params.set("close", "1");
    const url = API_PAGE_URL + "#" + params.toString();
    const w = 420,
      h = 180;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const features =
      "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",menubar=no,toolbar=no,location=no,status=no";
    const win = window.open(url, "lmp_compile", features);
    if (!win) {
      GM_openInTab(url, { active: true, insert: true });
    }
  }

  async function handleDownload() {
    const text = lastPastedText;
    if (!text || !isLmpContent(text)) {
      alert("No LMP content in clipboard. Paste LMP text first.");
      return;
    }
    try {
      const filename = getFilename(text);
      openApiPage(text, filename);
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
