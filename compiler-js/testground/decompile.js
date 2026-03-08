#!/usr/bin/env node
/**
 * Testground: Decompile a MIDI file to LMP.
 *
 * Usage:
 *   bun run testground/decompile.js song.mid
 *   bun run testground/decompile.js song.mid -o output.lmp
 *
 * Output: Prints LMP to stdout, or writes to -o path.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { decompile } from '../src/index.js';

const args = process.argv.slice(2);
const oIdx = args.indexOf('-o');
const outPath = oIdx >= 0 ? args[oIdx + 1] : null;

const midArg = args.find((a) => a.endsWith('.mid') || (!a.startsWith('-') && !a.endsWith('.lmp')));
if (!midArg) {
  console.error('Usage: bun run testground/decompile.js <file.mid> [-o output.lmp]');
  process.exit(1);
}

const midPath = resolve(process.cwd(), midArg);
let midiBuffer;
try {
  midiBuffer = readFileSync(midPath);
} catch (e) {
  console.error('Error reading file:', midPath, e.message);
  process.exit(1);
}

const lmp = decompile(new Uint8Array(midiBuffer));

if (outPath) {
  const out = resolve(process.cwd(), outPath);
  writeFileSync(out, lmp, 'utf-8');
  console.log('Decompiled:', midPath, '->', out);
} else {
  console.log(lmp);
}
