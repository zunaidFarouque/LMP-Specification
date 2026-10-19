#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BENCHMARK_CORPUS } from './corpus.js';
import { evaluateCorpus } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(78));
console.log('   LMP-Bench: Scientific Evaluation Harness for Lean Musical Protocol');
console.log('='.repeat(78));
console.log(`Corpus size: ${BENCHMARK_CORPUS.length} musical pieces across genres.`);
console.log('Evaluating Syntax Validity Rate (SVR), Token Compression (TCR), & Fidelity...\n');

const evalReport = evaluateCorpus(BENCHMARK_CORPUS);
const { summary, results } = evalReport;

// Display Results Table
console.log(
  '| ' + 'Piece Title'.padEnd(28) +
  '| ' + 'Genre'.padEnd(14) +
  '| ' + 'LMP Tok'.padEnd(9) +
  '| ' + 'JSON Tok'.padEnd(10) +
  '| ' + 'TCR (JSON)'.padEnd(12) +
  '| ' + 'F1 Fidelity'.padEnd(12) + '|'
);
console.log('|' + '-'.repeat(30) + '|' + '-'.repeat(16) + '|' + '-'.repeat(11) + '|' + '-'.repeat(12) + '|' + '-'.repeat(14) + '|' + '-'.repeat(14) + '|');

for (const r of results) {
  const title = (r.title.length > 26 ? r.title.slice(0, 25) + '…' : r.title).padEnd(28);
  const genre = r.genre.padEnd(14);
  const lmpTok = String(r.stats?.lmp?.tokens ?? '-').padStart(7) + '  ';
  const jsonTok = String(r.stats?.json?.tokens ?? '-').padStart(8) + '  ';
  const tcr = (r.tcr ? `${r.tcr.vsJson.toFixed(2)}x` : 'N/A').padStart(10) + '  ';
  const f1 = (r.fidelity?.f1 != null ? `${(r.fidelity.f1 * 100).toFixed(1)}%` : 'N/A').padStart(10) + '  ';

  console.log(`| ${title}| ${genre}| ${lmpTok}| ${jsonTok}| ${tcr}| ${f1}|`);
}

console.log('\n' + '='.repeat(78));
console.log('   AGGREGATE BENCHMARK SUMMARY');
console.log('='.repeat(78));
console.log(`• Total Evaluated Compositions:           ${summary.totalEvaluated}`);
console.log(`• Syntax Validity Rate (Strict Mode):     ${summary.syntaxValidityRateStrict}%`);
console.log(`• Syntax Validity Rate (Loose Mode):      ${summary.syntaxValidityRateLoose}%`);
console.log(`• Average Token Compression vs MIDI-JSON: ${summary.averageTokenCompressionVsJson}x (saves ~${Math.round((1 - 1 / summary.averageTokenCompressionVsJson) * 100)}% tokens)`);
console.log(`• Average Token Compression vs MIDI-CSV:  ${summary.averageTokenCompressionVsCsv}x (saves ~${Math.round((1 - 1 / summary.averageTokenCompressionVsCsv) * 100)}% tokens)`);
console.log(`• Average Note Reconstruction F1 Score:   ${summary.averageNoteF1Fidelity}%`);
console.log('='.repeat(78) + '\n');

// Write JSON artifact
const reportPath = path.resolve(__dirname, '../lmp-bench-report.json');
fs.writeFileSync(reportPath, JSON.stringify(evalReport, null, 2), 'utf8');
console.log(`Detailed JSON report written to: ${reportPath}\n`);
