/**
 * Multi-track piano roll visualization.
 * Uses LMP.parseMidi for parsing; supports drum map for channel-10 tracks.
 */
(function () {
  const NOTE_HEIGHT = 14;
  const NOTE_SPACING = 1;
  const PIXELS_PER_BEAT = 40;
  const TRACK_HEADER_HEIGHT = 28;
  const SEPARATOR_HEIGHT = 2;
  const ROW_LABEL_WIDTH = 100;
  const PITCH_MIN = 21;
  const PITCH_MAX = 108;

  function ticksToBeat(tick, ppqn) {
    return tick / ppqn;
  }

  /**
   * Parse MIDI buffer into per-track data.
   * @param {Uint8Array|ArrayLike<number>} midiBuffer
   * @returns {{ tracks: Array<{ name: string, channel: number, notes: Array<{ tick: number, noteNumber: number, velocity: number, durationTicks: number }> }>, ppqn: number, bpm: number }}
   */
  function parseMidiToTracks(midiBuffer) {
    const parseMidi = window.LMP?.parseMidi;
    if (!parseMidi) throw new Error('LMP.parseMidi not available');

    const buffer = midiBuffer instanceof Uint8Array ? midiBuffer : new Uint8Array(Array.from(midiBuffer));
    const parsed = parseMidi(buffer);
    const ppqn = parsed.header?.ticksPerBeat ?? 480;
    let bpm = 120;

    const pendingNoteOns = new Map();
    const trackNames = new Map();
    const trackChannels = new Map();
    const trackNotes = new Map();

    for (let ti = 0; ti < parsed.tracks.length; ti++) {
      const track = parsed.tracks[ti];
      let tick = 0;

      for (const ev of track) {
        tick += ev.deltaTime ?? 0;

        if (ev.type === 'trackName' && ev.text && !trackNames.has(ti)) {
          trackNames.set(ti, String(ev.text).trim());
        }
        if (ev.type === 'setTempo') {
          if (ev.microsecondsPerBeat && ev.microsecondsPerBeat > 0) {
            bpm = Math.round(60000000 / ev.microsecondsPerBeat);
          }
        }
        if (ev.type === 'noteOn') {
          const ch = ev.channel ?? 0;
          if (!pendingNoteOns.has(ti)) pendingNoteOns.set(ti, new Map());
          const byCh = pendingNoteOns.get(ti);
          if (!byCh.has(ch)) byCh.set(ch, new Map());
          byCh.get(ch).set(ev.noteNumber, { tick, velocity: ev.velocity ?? 64 });
          if (!trackChannels.has(ti)) trackChannels.set(ti, ch);
        }
        if (ev.type === 'noteOff') {
          const ch = ev.channel ?? 0;
          const byCh = pendingNoteOns.get(ti)?.get(ch);
          const on = byCh?.get(ev.noteNumber);
          if (on) {
            if (!trackNotes.has(ti)) trackNotes.set(ti, []);
            trackNotes.get(ti).push({
              tick: on.tick,
              noteNumber: ev.noteNumber,
              velocity: on.velocity,
              durationTicks: tick - on.tick,
            });
            byCh.delete(ev.noteNumber);
          }
        }
      }
    }

    const tracks = [];
    for (let ti = 0; ti < parsed.tracks.length; ti++) {
      const notes = trackNotes.get(ti) ?? [];
      if (notes.length === 0) continue;

      const name = trackNames.get(ti) ?? `Track ${ti + 1}`;
      const channel = trackChannels.get(ti) ?? 0;
      tracks.push({
        name,
        channel: channel + 1,
        notes: notes.sort((a, b) => a.tick - b.tick),
      });
    }

    return { tracks, ppqn, bpm };
  }

  /**
   * Render a melodic (piano) track section.
   */
  function renderPianoTrack(svg, track, ppqn, bpm, x0, y0, width) {
    const pitches = [...new Set(track.notes.map((n) => n.noteNumber))].sort((a, b) => b - a);
    const pitchMin = Math.min(PITCH_MIN, ...pitches);
    const pitchMax = Math.max(PITCH_MAX, ...pitches);
    const pitchCount = pitchMax - pitchMin + 1;
    const gridHeight = pitchCount * (NOTE_HEIGHT + NOTE_SPACING);
    const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
    const gridWidth = Math.max(maxBeat * PIXELS_PER_BEAT, width - ROW_LABEL_WIDTH);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x0}, ${y0})`);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', 4);
    label.setAttribute('y', 18);
    label.setAttribute('fill', '#94a3b8');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-family', 'DM Sans, system-ui, sans-serif');
    label.textContent = track.name;
    g.appendChild(label);

    const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridG.setAttribute('transform', `translate(${ROW_LABEL_WIDTH}, ${TRACK_HEADER_HEIGHT})`);

    for (let p = pitchMin; p <= pitchMax; p++) {
      const row = pitchMax - p;
      const y = row * (NOTE_HEIGHT + NOTE_SPACING);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', y);
      rect.setAttribute('width', gridWidth);
      rect.setAttribute('height', NOTE_HEIGHT + NOTE_SPACING);
      rect.setAttribute('fill', row % 2 === 0 ? '#1e293b' : '#0f172a');
      gridG.appendChild(rect);
    }

    for (const n of track.notes) {
      const beat = ticksToBeat(n.tick, ppqn);
      const durBeat = n.durationTicks / ppqn;
      const x = beat * PIXELS_PER_BEAT;
      const w = Math.max(durBeat * PIXELS_PER_BEAT, 4);
      const row = pitchMax - n.noteNumber;
      const y = row * (NOTE_HEIGHT + NOTE_SPACING) + NOTE_SPACING / 2;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', w);
      rect.setAttribute('height', NOTE_HEIGHT);
      rect.setAttribute('fill', '#f59e0b');
      rect.setAttribute('rx', 2);
      rect.setAttribute('opacity', 0.5 + (n.velocity / 255) * 0.5);
      gridG.appendChild(rect);
    }

    g.appendChild(gridG);
    svg.appendChild(g);
    return TRACK_HEADER_HEIGHT + gridHeight;
  }

  /**
   * Render a drum track section with drum map.
   */
  function renderDrumTrack(svg, track, ppqn, drumMap, x0, y0, width) {
    const { noteToName, displayOrder } = drumMap;
    const usedNotes = new Set(track.notes.map((n) => n.noteNumber));
    let orderedNotes = displayOrder.filter((n) => usedNotes.has(n));
    for (const n of usedNotes) {
      if (!orderedNotes.includes(n)) orderedNotes.push(n);
    }
    const rowCount = Math.max(orderedNotes.length, 1);
    const rowHeight = NOTE_HEIGHT + NOTE_SPACING;
    const gridHeight = rowCount * rowHeight;
    const maxBeat = Math.max(...track.notes.map((n) => ticksToBeat(n.tick + n.durationTicks, ppqn)), 1);
    const gridWidth = Math.max(maxBeat * PIXELS_PER_BEAT, width - ROW_LABEL_WIDTH);

    const noteToRow = new Map();
    orderedNotes.forEach((note, i) => noteToRow.set(note, i));

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x0}, ${y0})`);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', 4);
    label.setAttribute('y', 18);
    label.setAttribute('fill', '#94a3b8');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-family', 'DM Sans, system-ui, sans-serif');
    label.textContent = track.name;
    g.appendChild(label);

    const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridG.setAttribute('transform', `translate(${ROW_LABEL_WIDTH}, ${TRACK_HEADER_HEIGHT})`);

    for (let i = 0; i < rowCount; i++) {
      const y = i * rowHeight;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', y);
      rect.setAttribute('width', gridWidth);
      rect.setAttribute('height', rowHeight);
      rect.setAttribute('fill', i % 2 === 0 ? '#1e293b' : '#0f172a');
      gridG.appendChild(rect);

      const noteNum = orderedNotes[i];
      const name = noteToName.get(noteNum) ?? `Note ${noteNum}`;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', -ROW_LABEL_WIDTH + 4);
      text.setAttribute('y', y + rowHeight / 2 + 4);
      text.setAttribute('fill', '#94a3b8');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-family', 'DM Sans, system-ui, sans-serif');
      text.textContent = name;
      gridG.appendChild(text);
    }

    for (const n of track.notes) {
      const row = noteToRow.get(n.noteNumber);
      if (row === undefined) continue;
      const beat = ticksToBeat(n.tick, ppqn);
      const durBeat = n.durationTicks / ppqn;
      const x = beat * PIXELS_PER_BEAT;
      const w = Math.max(durBeat * PIXELS_PER_BEAT, 6);
      const y = row * rowHeight + NOTE_SPACING / 2;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', w);
      rect.setAttribute('height', NOTE_HEIGHT);
      rect.setAttribute('fill', '#f59e0b');
      rect.setAttribute('rx', 2);
      rect.setAttribute('opacity', 0.5 + (n.velocity / 255) * 0.5);
      gridG.appendChild(rect);
    }

    g.appendChild(gridG);
    svg.appendChild(g);
    return TRACK_HEADER_HEIGHT + gridHeight;
  }

  /**
   * Render drum track without drum map (pitch-based like piano).
   */
  function renderDrumTrackFallback(svg, track, ppqn, x0, y0, width) {
    return renderPianoTrack(svg, track, ppqn, 120, x0, y0, width);
  }

  function render(midiBuffer, containerId, drumMap) {
    const container = document.getElementById(containerId || 'pianoRollContainer');
    const placeholder = document.getElementById('pianoRollPlaceholder');
    const svgEl = document.getElementById('pianoRollSvg');

    if (!container || !midiBuffer || midiBuffer.length === 0) {
      if (placeholder) placeholder.classList.remove('hidden');
      if (svgEl) svgEl.classList.add('hidden');
      return;
    }

    try {
      const { tracks, ppqn, bpm } = parseMidiToTracks(midiBuffer);
      if (tracks.length === 0) {
        if (placeholder) placeholder.textContent = 'No notes in sequence';
        if (placeholder) placeholder.classList.remove('hidden');
        if (svgEl) svgEl.classList.add('hidden');
        return;
      }

      const effectiveDrumMap = drumMap ?? (window.DrumMap ? window.DrumMap.getDefaultDrumMap({ short: true }) : null);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'pianoRollSvg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.style.maxWidth = '100%';

      let y = 0;
      const width = container.clientWidth || 600;

      for (let i = 0; i < tracks.length; i++) {
        if (i > 0) {
          const sep = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          sep.setAttribute('x', 0);
          sep.setAttribute('y', y);
          sep.setAttribute('width', '100%');
          sep.setAttribute('height', SEPARATOR_HEIGHT);
          sep.setAttribute('fill', '#475569');
          svg.appendChild(sep);
          y += SEPARATOR_HEIGHT;
        }

        const track = tracks[i];
        const isDrum = track.channel === 10;
        const hasDrumMap = effectiveDrumMap && isDrum;

        const h = hasDrumMap
          ? renderDrumTrack(svg, track, ppqn, effectiveDrumMap, 0, y, width)
          : renderPianoTrack(svg, track, ppqn, bpm, 0, y, width);

        y += h;
      }

      svg.setAttribute('height', y);
      svg.setAttribute('width', '100%');
      svg.setAttribute('viewBox', `0 0 ${width} ${y}`);

      const oldSvg = container?.querySelector('#pianoRollSvg');
      if (oldSvg) oldSvg.replaceWith(svg);
      else if (container) container.appendChild(svg);

      if (placeholder) placeholder.classList.add('hidden');
    } catch (err) {
      if (placeholder) {
        placeholder.textContent = 'Visualization error: ' + (err.message || String(err));
        placeholder.classList.remove('hidden');
      }
      if (svgEl) svgEl.classList.add('hidden');
    }
  }

  function clear(containerId) {
    const container = document.getElementById(containerId || 'pianoRollContainer');
    const placeholder = document.getElementById('pianoRollPlaceholder');
    const svgEl = document.getElementById('pianoRollSvg');

    if (placeholder) {
      placeholder.textContent = 'Compile LMP to see piano roll';
      placeholder.classList.remove('hidden');
    }
    if (svgEl) {
      svgEl.classList.add('hidden');
      svgEl.innerHTML = '';
    }
  }

  window.PianoRoll = { render, clear };
})();
