#!/usr/bin/env node
/**
 * Copy lmp-core IIFE bundle to testground-web/lib for self-contained deployment.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'dist', 'lmp-core.v1.iife.min.js');
const destDir = join(root, '..', 'testground-web', 'lib');
const dest = join(destDir, 'lmp-core.v1.iife.min.js');

if (!existsSync(src)) {
  console.error('Run "bun run build" first to create dist/lmp-core.v1.iife.min.js');
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('Copied to testground-web/lib/lmp-core.v1.iife.min.js');
