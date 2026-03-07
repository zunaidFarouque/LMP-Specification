#!/usr/bin/env node
/**
 * Build script for lmp-core.
 * Output: dist/lmp-core.v1.js (dev), dist/lmp-core.v1.min.js (universal ESM), dist/lmp-core.v1.iife.min.js (IIFE for file-picker)
 */
import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const minify = process.argv.includes('--minify');
const iifeOnly = process.argv.includes('--iife');

const banner = { js: '/* LMP-Core v1 — Lean Musical Protocol compiler */' };

if (iifeOnly) {
  await esbuild.build({
    entryPoints: [join(__dirname, 'src', 'index.js')],
    bundle: true,
    format: 'iife',
    globalName: 'LMP',
    platform: 'browser',
    outfile: join(__dirname, 'dist', 'lmp-core.v1.iife.min.js'),
    minify: true,
    target: ['es2020'],
    banner,
  }).catch(() => process.exit(1));
  console.log('Built dist/lmp-core.v1.iife.min.js');
} else {
  await esbuild.build({
    entryPoints: [join(__dirname, 'src', 'index.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: join(__dirname, 'dist', minify ? 'lmp-core.v1.min.js' : 'lmp-core.v1.js'),
    minify,
    sourcemap: !minify,
    target: ['es2020'],
    banner,
  }).catch(() => process.exit(1));
  console.log(minify ? 'Built dist/lmp-core.v1.min.js' : 'Built dist/lmp-core.v1.js');
}
