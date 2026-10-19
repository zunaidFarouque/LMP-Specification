import { compile, decompile, parseMidi } from '../../compiler-js/src/index.js';
import { countTokens, measureTextStats } from './token-counter.js';
import { midiToJson, midiToCsv } from './formats.js';

/**
 * Extracts note events from binary MIDI for fidelity comparison
 */
function extractNoteEvents(midiBytes) {
  const parsed = parseMidi(midiBytes);
  const ppqn = parsed.header.ticksPerBeat || 480;
  const noteList = [];

  for (let t = 0; t < parsed.tracks.length; t++) {
    const track = parsed.tracks[t];
    let tick = 0;
    const active = new Map();

    for (const evt of track) {
      tick += evt.deltaTime || 0;
      const ch = evt.channel ?? 0;
      const pitch = evt.noteNumber;

      if (evt.type === 'noteOn' && evt.velocity > 0) {
        active.set(`${ch}:${pitch}`, { tick, velocity: evt.velocity });
      } else if (evt.type === 'noteOff' || (evt.type === 'noteOn' && evt.velocity === 0)) {
        const start = active.get(`${ch}:${pitch}`);
        if (start) {
          active.delete(`${ch}:${pitch}`);
          noteList.push({
            channel: ch,
            pitch,
            startTick: start.tick,
            startBeat: Math.round((start.tick / ppqn) * 1000) / 1000,
            durationTicks: tick - start.tick,
            durationBeats: Math.round(((tick - start.tick) / ppqn) * 1000) / 1000,
            velocity: start.velocity
          });
        }
      }
    }
  }

  // Sort notes deterministically by startBeat, channel, pitch
  return noteList.sort((a, b) => a.startBeat - b.startBeat || a.channel - b.channel || a.pitch - b.pitch);
}

/**
 * Computes note precision, recall, and F1 score between two sets of note events
 */
export function computeNoteFidelity(originalNotes, roundtripNotes) {
  if (originalNotes.length === 0 && roundtripNotes.length === 0) {
    return { precision: 1.0, recall: 1.0, f1: 1.0, matched: 0, total: 0 };
  }
  if (originalNotes.length === 0 || roundtripNotes.length === 0) {
    return { precision: 0.0, recall: 0.0, f1: 0.0, matched: 0, total: originalNotes.length };
  }

  const matched = new Set();
  let matches = 0;

  for (const orig of originalNotes) {
    let foundIdx = -1;
    for (let j = 0; j < roundtripNotes.length; j++) {
      if (matched.has(j)) continue;
      const cand = roundtripNotes[j];
      const pitchMatches = cand.pitch === orig.pitch;
      const beatMatches = Math.abs(cand.startBeat - orig.startBeat) <= 0.02;
      const durMatches = Math.abs(cand.durationBeats - orig.durationBeats) <= 0.05;

      if (pitchMatches && beatMatches && durMatches) {
        foundIdx = j;
        break;
      }
    }

    if (foundIdx !== -1) {
      matched.add(foundIdx);
      matches++;
    }
  }

  const precision = roundtripNotes.length > 0 ? matches / roundtripNotes.length : 0;
  const recall = originalNotes.length > 0 ? matches / originalNotes.length : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    matched: matches,
    totalOriginal: originalNotes.length,
    totalRoundtrip: roundtripNotes.length
  };
}

/**
 * Evaluates the full benchmark corpus across all dimensions
 */
export function evaluateCorpus(corpus) {
  const results = [];
  let validStrictCount = 0;
  let validLooseCount = 0;

  for (const item of corpus) {
    let strictValid = false;
    let looseValid = false;
    let midiBytes = null;
    let compileError = null;

    // 1. Strict SVR Check
    try {
      midiBytes = compile(item.lmp);
      strictValid = true;
      looseValid = true;
    } catch (err) {
      compileError = err.message || String(err);
      // Fallback test in loose mode
      try {
        const looseRes = compile(item.lmp, { loose: true });
        midiBytes = looseRes.midi || looseRes;
        looseValid = true;
      } catch (e) {
        looseValid = false;
      }
    }

    if (strictValid) validStrictCount++;
    if (looseValid) validLooseCount++;

    if (!midiBytes) {
      results.push({
        id: item.id,
        title: item.title,
        genre: item.genre,
        strictValid: false,
        looseValid: false,
        error: compileError
      });
      continue;
    }

    // 2. Token Compression Ratio (TCR)
    const jsonStr = midiToJson(midiBytes);
    const csvStr = midiToCsv(midiBytes);

    const lmpStats = measureTextStats(item.lmp);
    const jsonStats = measureTextStats(jsonStr);
    const csvStats = measureTextStats(csvStr);

    const tcrVsJson = Math.round((jsonStats.tokens / lmpStats.tokens) * 100) / 100;
    const tcrVsCsv = Math.round((csvStats.tokens / lmpStats.tokens) * 100) / 100;
    const charRatioJson = Math.round((jsonStats.chars / lmpStats.chars) * 100) / 100;

    // 3. Reconstruction Fidelity
    let fidelity = { f1: 0, precision: 0, recall: 0 };
    let roundtripLmp = '';
    try {
      roundtripLmp = decompile(midiBytes, { maxDecimals: 3 });
      const roundtripMidi = compile(roundtripLmp);
      const origNotes = extractNoteEvents(midiBytes);
      const rtNotes = extractNoteEvents(roundtripMidi);
      fidelity = computeNoteFidelity(origNotes, rtNotes);
    } catch (err) {
      fidelity = { error: err.message || String(err), f1: 0 };
    }

    results.push({
      id: item.id,
      title: item.title,
      genre: item.genre,
      strictValid,
      looseValid,
      stats: {
        lmp: lmpStats,
        json: jsonStats,
        csv: csvStats
      },
      tcr: {
        vsJson: tcrVsJson,
        vsCsv: tcrVsCsv,
        charRatioJson
      },
      fidelity
    });
  }

  // Summary Metrics
  const total = corpus.length;
  const avgTcrJson = results
    .filter(r => r.tcr)
    .reduce((sum, r) => sum + r.tcr.vsJson, 0) / (results.filter(r => r.tcr).length || 1);

  const avgTcrCsv = results
    .filter(r => r.tcr)
    .reduce((sum, r) => sum + r.tcr.vsCsv, 0) / (results.filter(r => r.tcr).length || 1);

  const avgF1 = results
    .filter(r => r.fidelity?.f1 != null)
    .reduce((sum, r) => sum + r.fidelity.f1, 0) / (results.filter(r => r.fidelity?.f1 != null).length || 1);

  return {
    summary: {
      totalEvaluated: total,
      syntaxValidityRateStrict: Math.round((validStrictCount / total) * 1000) / 10,
      syntaxValidityRateLoose: Math.round((validLooseCount / total) * 1000) / 10,
      averageTokenCompressionVsJson: Math.round(avgTcrJson * 100) / 100,
      averageTokenCompressionVsCsv: Math.round(avgTcrCsv * 100) / 100,
      averageNoteF1Fidelity: Math.round(avgF1 * 1000) / 10
    },
    results
  };
}
