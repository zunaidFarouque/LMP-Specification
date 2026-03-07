/**
 * LMP Testground — Main application logic
 */
(function () {
  const CACHE_KEY = 'lmp-core-cache';
  const DEBOUNCE_MS = 200;

  const EXAMPLES = {
    minimal: `@LMP 1.0
@BPM 120
@TRACK 1 Test
@CHANNEL 1

1.0 C4
`,
    chords: `@LMP 1.0
@BPM 120
@TRACK 1 Piano_Chords
@CHANNEL 1
@PROGRAM 0
@DEFAULT_VEL 80
@DEFAULT_DUR 1.0

// Block Chords
1.0 C4,E4,G4
2.0 D4,F4,A4 95
3.0 C4,E4,G4 _ 2.0

@TRACK 2 Solo_Flute
@CHANNEL 2
@PROGRAM 73
@DEFAULT_VEL 90
@RULE LEGATO=TRUE

1.0 C5
1.5 D5
2.0 E5
3.0 C5 _ 2.0
`,
    drums: `@LMP 1.0
@BPM 120
@TRACK 1 Drums
@CHANNEL 10
@DEFAULT_VEL 90
@DEFAULT_DUR 0.25

1.0 36,42
1.25 42
1.5 36,42
1.75 42
2.0 36,38,42
2.25 42
2.5 36,42
2.75 42
`,
  };

  let debounceTimer = null;
  let lastMidi = null;
  let currentDrumMap = null; // null = use default GM; set by Load drum map

  function setStatus(text, isError) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'px-4 py-2 text-sm min-h-[2.5rem] border-t border-slate-800 bg-slate-900/30' + (isError ? ' error' : text ? ' success' : '');
  }

  function compileAndPreview() {
    const lmpEl = document.getElementById('lmp');
    const text = lmpEl?.value?.trim() || '';

    if (!text) {
      window.PianoRoll?.clear?.();
      setStatus('');
      document.getElementById('downloadBtn')?.setAttribute('disabled', '');
      return;
    }

    if (!window.LMP?.compile) {
      setStatus('LMP library not loaded', true);
      return;
    }

    try {
      const result = window.LMP.compile(text);
      const midi = result?.midi ?? result;
      lastMidi = midi;

      setStatus('Compiled: ' + midi.length + ' bytes');
      document.getElementById('downloadBtn')?.removeAttribute('disabled');

      if (window.PianoRoll?.render) {
        const drumMap = currentDrumMap ?? (window.DrumMap ? window.DrumMap.getDefaultDrumMap({ short: true }) : null);
        window.PianoRoll.render(midi, 'pianoRollContainer', drumMap);
      }
    } catch (err) {
      setStatus(err.message || String(err), true);
      lastMidi = null;
      document.getElementById('downloadBtn')?.setAttribute('disabled', '');
      window.PianoRoll?.clear?.();
    }
  }

  function initLibrary() {
    const loader = document.getElementById('loader');
    const cached = localStorage.getItem(CACHE_KEY);

    if (window.LMP?.compile && window.LMP?.decompile) {
      if (loader) loader.classList.add('hidden');
      initPlayground();
      return;
    }

    if (cached) {
      try {
        const script = document.createElement('script');
        script.textContent = cached;
        document.body.appendChild(script);
        if (window.LMP?.compile && window.LMP?.decompile) {
          if (loader) loader.classList.add('hidden');
          initPlayground();
          return;
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    if (loader) loader.classList.remove('hidden');
    document.getElementById('loadBtn')?.addEventListener('click', () => document.getElementById('libInput')?.click());
    document.getElementById('libInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const content = await file.text();
        localStorage.setItem(CACHE_KEY, content);
        const script = document.createElement('script');
        script.textContent = content;
        document.body.appendChild(script);
        if (window.LMP?.compile && window.LMP?.decompile) {
          loader?.classList.add('hidden');
          initPlayground();
        } else {
          alert('Invalid library file.');
        }
      } catch (err) {
        alert('Failed to load: ' + (err.message || String(err)));
      }
      e.target.value = '';
    });
    document.getElementById('clearCache')?.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem(CACHE_KEY);
      location.reload();
    });
  }

  function initPlayground() {
    const lmpEl = document.getElementById('lmp');
    const examplesEl = document.getElementById('examples');
    const downloadBtn = document.getElementById('downloadBtn');
    const previewContainer = document.getElementById('previewContainer');
    const dropzone = document.getElementById('dropzone');

    if (!lmpEl.value.trim()) lmpEl.value = EXAMPLES.chords;

    lmpEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(compileAndPreview, DEBOUNCE_MS);
    });

    examplesEl?.addEventListener('change', (e) => {
      const val = e.target?.value;
      if (val && EXAMPLES[val]) lmpEl.value = EXAMPLES[val];
      compileAndPreview();
      e.target.value = '';
    });

    const drumMapInput = document.getElementById('drumMapInput');
    const loadDrumMapBtn = document.getElementById('loadDrumMapBtn');
    const drumMapLabel = document.getElementById('drumMapLabel');

    loadDrumMapBtn?.addEventListener('click', () => drumMapInput?.click());
    drumMapInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const xml = await file.text();
        currentDrumMap = window.DrumMap?.parseDrumMap(xml) ?? null;
        if (drumMapLabel) {
          drumMapLabel.textContent = file.name;
          drumMapLabel.classList.remove('hidden');
        }
        compileAndPreview();
      } catch (err) {
        setStatus('Drum map error: ' + (err.message || String(err)), true);
      }
      e.target.value = '';
    });

    downloadBtn?.addEventListener('click', () => {
      if (!lastMidi) return;
      const blob = new Blob([lastMidi], { type: 'audio/midi' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'output.mid';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) => {
      previewContainer?.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach((ev) => {
      previewContainer?.addEventListener(ev, () => previewContainer?.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach((ev) => {
      previewContainer?.addEventListener(ev, () => previewContainer?.classList.remove('drag-over'));
    });

    previewContainer?.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith('.mid')) return;
      try {
        const buf = await file.arrayBuffer();
        const lmpText = window.LMP.decompile(new Uint8Array(buf));
        lmpEl.value = lmpText;
        compileAndPreview();
      } catch (err) {
        setStatus('Decompile error: ' + (err.message || String(err)), true);
      }
    });

    compileAndPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLibrary);
  } else {
    initLibrary();
  }
})();
