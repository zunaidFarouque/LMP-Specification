#!/usr/bin/env bun
/**
 * Verify all TEMPLATES and EXAMPLES compile successfully.
 */
import { compile } from 'lmp-core';
import { TEMPLATES, EXAMPLES } from '../src/constants/examples.ts';

const all = [
  ...Object.entries(TEMPLATES).map(([k, v]) => [`template:${k}`, v]),
  ...Object.entries(EXAMPLES).map(([k, v]) => [`example:${k}`, v]),
];

let failed = 0;
for (const [name, lmp] of all) {
  try {
    const result = compile(lmp.trim(), { loose: false });
    const midi = result?.midi ?? result;
    if (!midi || midi.length === 0) {
      console.error(`FAIL ${name}: no MIDI output`);
      failed++;
    } else {
      console.log(`OK ${name} (${midi.length} bytes)`);
    }
  } catch (err) {
    console.error(`FAIL ${name}:`, err.message);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);
