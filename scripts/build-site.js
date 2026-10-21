#!/usr/bin/env node
/**
 * Build the full LMP site: studio + static pages (landing, specification, LLM, release notes).
 * Output: studio-web/dist/
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteDir = join(root, 'site');
const distDir = join(root, 'studio-web', 'dist');
const specsDir = join(root, 'specs');
const specsAiDir = join(root, 'specs', 'ai');

const BASE = '/LMP-Specification';

function nav() {
  return `
<nav style="margin-bottom:2rem;display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center">
  <a href="${BASE}/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">Home</a>
  <a href="${BASE}/specification/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">Specification</a>
  <a href="${BASE}/llm/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">LLM Guides</a>
  <a href="${BASE}/release-notes/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">Release Notes (v2)</a>
  <a href="${BASE}/studio/" style="padding:0.5rem 1rem;background:#f59e0b;color:#1e293b;text-decoration:none;border-radius:8px;font-weight:600">Studio</a>
</nav>`;
}

function pageTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — LMP</title>
  <link rel="icon" type="image/svg+xml" href="${BASE}/studio/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0f1419;--fg:#e2e8f0;--muted:#94a3b8;--accent:#f59e0b;--card:#1e293b;--border:#334155}
    *{box-sizing:border-box}
    body{margin:0;font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;min-height:100vh;padding:2rem 1.5rem}
    .container{max-width:820px;margin:0 auto}
    h1{font-size:1.85rem;margin:0 0 1rem;color:#f8fafc}
    h2{font-size:1.35rem;margin:2rem 0 0.75rem;color:var(--accent)}
    h3{font-size:1.15rem;margin:1.5rem 0 0.5rem;color:#f1f5f9}
    p{margin:0 0 1rem}
    ul,ol{margin:0 0 1rem;padding-left:1.5rem}
    li{margin-bottom:0.35rem}
    pre,code{font-family:'JetBrains Mono',monospace;font-size:0.9em;background:var(--card);padding:0.2em 0.4em;border-radius:4px}
    pre{margin:1rem 0;padding:1rem;overflow-x:auto;border:1px solid var(--border)}
    pre code{padding:0;background:transparent}
    table{border-collapse:collapse;width:100%;margin:1.5rem 0;font-size:0.95rem}
    th,td{border:1px solid var(--border);padding:0.6rem 0.85rem;text-align:left}
    th{background:var(--card);color:var(--accent);font-weight:600}
    tr:nth-child(even){background:rgba(30,41,59,0.35)}
    a{color:var(--accent);text-decoration:none}
    a:hover{text-decoration:underline}
    blockquote{margin:1rem 0;padding:0.75rem 1rem;border-left:4px solid var(--accent);background:rgba(245,158,11,0.08);border-radius:0 6px 6px 0}
  </style>
</head>
<body>
  <div class="container">
    ${nav()}
    <div class="content">${content}</div>
  </div>
</body>
</html>`;
}

async function main() {
  const { marked } = await import('marked');

  console.log('Building studio...');
  execSync('bun run build:web', {
    cwd: root,
    env: { ...process.env, VITE_BASE_PATH: BASE + '/studio/' },
    stdio: 'inherit',
  });

  console.log('Generating specification page...');
  const specMd = readFileSync(join(specsDir, 'LMP v1 - Spec.md'), 'utf-8');
  const v2Notice = `
<div style="background:#1e293b;border-left:4px solid #f59e0b;padding:1rem 1.25rem;border-radius:0 8px 8px 0;margin-bottom:2rem">
  <strong style="color:#f59e0b;font-size:1.05em">LMP v2.0 Architecture Note:</strong>
  <p style="margin:0.5rem 0 0">This document specifies the core formal EBNF grammar, AST JSON schema, and MIDI encoding rules. In LMP v2.0, the compiler introduces tokenizer-native Postel's Law parsing (spaces in chords), deterministic <code>@SEED</code> humanization, timeline origin directives (<code>@ORIGIN</code>), and standard Model Context Protocol (MCP) server tooling. Read the <a href="${BASE}/release-notes/">v2.0 Release Notes</a> for complete details.</p>
</div>
`;
  const specHtml = v2Notice + marked.parse(specMd);
  const specOutDir = join(distDir, 'specification');
  mkdirSync(specOutDir, { recursive: true });
  writeFileSync(
    join(specOutDir, 'index.html'),
    pageTemplate('LMP Technical Specification', specHtml)
  );

  console.log('Generating release notes page...');
  const releasePath = join(root, 'RELEASE-NOTES-v2.md');
  if (existsSync(releasePath)) {
    const releaseMd = readFileSync(releasePath, 'utf-8');
    const releaseHtml = marked.parse(releaseMd);
    const releaseOutDir = join(distDir, 'release-notes');
    mkdirSync(releaseOutDir, { recursive: true });
    writeFileSync(
      join(releaseOutDir, 'index.html'),
      pageTemplate('LMP v2.0 Release Notes', releaseHtml)
    );
  }

  console.log('Generating LLM guides...');
  const GITHUB_RAW =
    'https://github.com/zunaidFarouque/LMP-Specification/raw/main/specs/ai/Custom%20Drummap%20Examples/Indian%20Tablas';
  const indianTablasDir = join(specsAiDir, 'Custom Drummap Examples', 'Indian Tablas');

  const coreGuides = [
    {
      file: 'LMP-AI-FULL.md',
      title: 'Master All-in-One Spec',
      badge: '⭐ Recommended for LLMs',
      slug: 'full',
      description:
        'The primary recommended specification for LLMs (ChatGPT, Claude, Gemini, Cursor). Full multitrack composition rules with chords, basslines, melodies, drums, and syntax rules in a single comprehensive context file.',
    },
    {
      file: 'LMP-AI-General.md',
      title: 'General Guide',
      badge: 'Modular',
      slug: 'general',
      description:
        'Lightweight context footprint (~2,200 tokens) covering core LMP headers, tracks, events, syntax rules, and protocol basics for single instruments.',
    },
    {
      file: 'LMP-AI-Melodic.md',
      title: 'Melodic & Chords Guide',
      badge: 'Modular',
      slug: 'melodic',
      description:
        'Optimized for pitched, melodic instruments. Covers GM melodic patches, SPN note names, velocity, duration, polyphonic voice leading (+), and legato.',
    },
    {
      file: 'LMP-AI-Percussive.md',
      title: 'Percussive & Drums Guide',
      badge: 'Modular',
      slug: 'percussive',
      description:
        'Optimized for drums. Covers standard GM percussion, repeating drum loops (1.0-5.0:1/2), modifiers (| R, | V), and dynamic accents.',
    },
  ];

  const llmOutDir = join(distDir, 'llm');
  mkdirSync(llmOutDir, { recursive: true });

  const coreLinks = [];
  for (const { file, title, badge, slug, description } of coreGuides) {
    const path = join(specsAiDir, file);
    if (!existsSync(path)) continue;
    const md = readFileSync(path, 'utf-8');
    const html = marked.parse(md);
    writeFileSync(
      join(llmOutDir, `${slug}.html`),
      pageTemplate(`LMP AI: ${title}`, html)
    );
    const badgeHtml = badge ? ` <span style="font-size:0.8em;padding:0.15rem 0.5rem;background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40;border-radius:4px;vertical-align:middle">${badge}</span>` : '';
    coreLinks.push(
      `<li style="margin-bottom:0.75rem"><a href="${BASE}/llm/${slug}.html" style="font-weight:600">${title}</a>${badgeHtml} — <span style="color:#94a3b8">${description}</span></li>`
    );
  }

  const tablaMdPath = join(indianTablasDir, 'LMP-AI-Tabla.md');
  let tablaSection = '';
  if (existsSync(tablaMdPath)) {
    const tablaMd = readFileSync(tablaMdPath, 'utf-8');
    const tablaHtml = marked.parse(tablaMd);
    writeFileSync(
      join(llmOutDir, 'tabla.html'),
      pageTemplate('LMP AI: Tabla (Indian Tabla)', tablaHtml)
    );
    const tablaGuideUrl = `${BASE}/llm/tabla.html`;
    const tsvName = 'Tablas 2.0 - Drummap Summary.tsv';
    const drmName = 'Tablas 2.0 - FINAL.drm';
    const tsvUrl = `${GITHUB_RAW}/${encodeURIComponent(tsvName)}`;
    const drmUrl = `${GITHUB_RAW}/${encodeURIComponent(drmName)}`;
    tablaSection = `
    <h2>Custom Drummap Examples</h2>
    <h3>Indian Classical Tabla</h3>
    <p>An adaptation of LMP optimized for Indian Tabla (Soundiron Tablas 2.0). The guide uses custom drummaps; the drummap files used to create and interpret Tabla LMP are available in the repository and linked below.</p>
    <ul>
      <li><a href="${tablaGuideUrl}">LMP-AI-Tabla guide</a> — Read the Tabla-specific LMP guide.</li>
      <li><a href="${tsvUrl}">${tsvName}</a> — Drummap summary (TSV).</li>
      <li><a href="${drmUrl}">${drmName}</a> — Drummap definition (DRM).</li>
    </ul>`;
  }

  const llmIndexHtml = `
    <h1>LLM Guides (LMP v2.0)</h1>
    <p>These guides are written specifically for AI assistants and Large Language Models. They explain how to read, write, and reason about LMP (Lean Musical Protocol) in plain language, with token-efficient examples and constraints tailored for model consumption.</p>
    
    <div style="background:#1e293b;border-left:4px solid #f59e0b;padding:1rem 1.25rem;border-radius:0 8px 8px 0;margin:1.5rem 0">
      <strong style="color:#f59e0b">Direct AI Context Injection:</strong>
      <p style="margin:0.5rem 0 0;font-size:0.95rem">You can feed the Master AI Spec directly to ChatGPT, Claude, Gemini, or Cursor without uploading files by prefixing with Jina Reader:<br>
      <code style="display:inline-block;margin-top:0.4rem;padding:0.3rem 0.6rem">https://r.jina.ai/https://raw.githubusercontent.com/zunaidFarouque/LMP-Specification/main/specs/ai/LMP-AI-FULL.md</code>
      </p>
    </div>

    <h2>Specification Guides</h2>
    <ul style="list-style-type:none;padding-left:0">${coreLinks.join('')}</ul>
    ${tablaSection}

    <h2>Standard llms.txt</h2>
    <p>For automated web scrapers and agents supporting the standard index, see <a href="${BASE}/llms.txt"><code>llms.txt</code></a>.</p>

    <p style="margin-top:2rem">For the low-level EBNF grammar and binary MIDI encoding, see the <a href="${BASE}/specification/">LMP Technical Specification</a>.</p>
  `;
  writeFileSync(
    join(llmOutDir, 'index.html'),
    pageTemplate('LLM Guides', llmIndexHtml)
  );

  console.log('Copying site root files...');
  cpSync(join(siteDir, 'index.html'), join(distDir, 'index.html'));
  cpSync(join(siteDir, 'api.html'), join(distDir, 'api.html'));
  mkdirSync(join(distDir, 'api'), { recursive: true });
  cpSync(join(siteDir, 'api', 'run.html'), join(distDir, 'api', 'run.html'));
  
  const compilerIife = join(root, 'compiler-js', 'dist', 'lmp-core.v1.iife.min.js');
  if (existsSync(compilerIife)) {
    cpSync(compilerIife, join(distDir, 'api', 'lmp-core.v1.iife.min.js'));
  }

  console.log('Copying llms.txt...');
  const llmsTxtPath = join(root, 'llms.txt');
  if (existsSync(llmsTxtPath)) {
    cpSync(llmsTxtPath, join(distDir, 'llms.txt'));
  }

  // Clean up any copied .git folder in public assets
  const distSoundfontsGit = join(distDir, 'soundfonts', '.git');
  if (existsSync(distSoundfontsGit)) {
    rmSync(distSoundfontsGit, { recursive: true, force: true });
  }

  console.log('Done. Output:', distDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
