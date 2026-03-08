#!/usr/bin/env node
/**
 * Testground: Compile an LMP file to MIDI.
 *
 * Usage:
 *   bun run testground/compile.js song.lmp
 *   bun run testground/compile.js song.lmp -o output.mid
 *   bun run testground/compile.js song.lmp --loose
 *
 * Output: Writes .mid file next to the .lmp file (or to -o path).
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { compile } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const loose = args.includes('--loose');
const oIdx = args.indexOf('-o');
const outPath = oIdx >= 0 ? args[oIdx + 1] : null;

const lmpArg = args.find((a) => a.endsWith('.lmp') || !a.startsWith('-'));
if (!lmpArg) {
  console.error('Usage: bun run testground/compile.js <file.lmp> [-o output.mid] [--loose]');
  process.exit(1);
}

const lmpPath = resolve(process.cwd(), lmpArg);
let lmpText;
try {
  lmpText = readFileSync(lmpPath, 'utf-8');
} catch (e) {
  console.error('Error reading file:', lmpPath, e.message);
  process.exit(1);
}

const result = compile(lmpText, { loose });

const midi = result.midi ?? result;
if (loose && result.warnings?.length) {
  result.warnings.forEach((w) => console.warn(w));
}

const out = outPath
  ? resolve(process.cwd(), outPath)
  : join(dirname(lmpPath), lmpPath.replace(/\.lmp$/i, '.mid').split(/[/\\]/).pop());

writeFileSync(out, Buffer.from(midi));
console.log('Compiled:', lmpPath, '->', out);
