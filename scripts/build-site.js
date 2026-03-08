#!/usr/bin/env node
/**
 * Build the full LMP site: playground + static pages (landing, specification, LLM).
 * Output: playground-web/dist/
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteDir = join(root, 'site');
const distDir = join(root, 'playground-web', 'dist');
const specsDir = join(root, 'specs');
const specsAiDir = join(root, 'specs', 'ai');

const BASE = '/LMP-Specification';

function nav() {
  return `
<nav style="margin-bottom:2rem;display:flex;gap:0.75rem;flex-wrap:wrap">
  <a href="${BASE}/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">Home</a>
  <a href="${BASE}/specification/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">Specification</a>
  <a href="${BASE}/llm/" style="padding:0.5rem 1rem;background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:8px">LLM Guides</a>
  <a href="${BASE}/playground/" style="padding:0.5rem 1rem;background:#f59e0b;color:#1e293b;text-decoration:none;border-radius:8px">Playground</a>
</nav>`;
}

function pageTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — LMP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0f1419;--fg:#e2e8f0;--muted:#94a3b8;--accent:#f59e0b;--card:#1e293b}
    *{box-sizing:border-box}
    body{margin:0;font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;min-height:100vh;padding:2rem 1.5rem}
    .container{max-width:800px;margin:0 auto}
    h1{font-size:1.75rem;margin:0 0 1rem}
    h2{font-size:1.25rem;margin:2rem 0 0.75rem;color:var(--accent)}
    h3{font-size:1.1rem;margin:1.5rem 0 0.5rem}
    p{margin:0 0 1rem}
    ul,ol{margin:0 0 1rem;padding-left:1.5rem}
    li{margin-bottom:0.25rem}
    pre,code{font-family:'JetBrains Mono',monospace;font-size:0.9em;background:var(--card);padding:0.2em 0.4em;border-radius:4px}
    pre{margin:1rem 0;padding:1rem;overflow-x:auto}
    table{border-collapse:collapse;width:100%;margin:1rem 0}
    th,td{border:1px solid var(--card);padding:0.5rem 0.75rem;text-align:left}
    th{background:var(--card);color:var(--accent)}
    a{color:var(--accent)}
    a:hover{text-decoration:underline}
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

  console.log('Building playground...');
  execSync('bun run build:web', {
    cwd: root,
    env: { ...process.env, VITE_BASE_PATH: BASE + '/playground/' },
    stdio: 'inherit',
  });

  console.log('Generating specification page...');
  const specMd = readFileSync(join(specsDir, 'LMP v1 - Spec.md'), 'utf-8');
  const specHtml = marked.parse(specMd);
  const specOutDir = join(distDir, 'specification');
  mkdirSync(specOutDir, { recursive: true });
  writeFileSync(
    join(specOutDir, 'index.html'),
    pageTemplate('LMP v1 Specification', specHtml)
  );

  console.log('Generating LLM guides...');
  const llmFiles = [
    { file: 'LMP-AI-General.md', title: 'General' },
    { file: 'LMP-AI-Melodic.md', title: 'Melodic' },
    { file: 'LMP-AI-Percussive.md', title: 'Percussive' },
    { file: 'LMP-AI-Tabla.md', title: 'Tabla' },
  ];
  const llmOutDir = join(distDir, 'llm');
  mkdirSync(llmOutDir, { recursive: true });

  const llmLinks = [];
  for (const { file, title } of llmFiles) {
    const path = join(specsAiDir, file);
    if (!existsSync(path)) continue;
    const md = readFileSync(path, 'utf-8');
    const html = marked.parse(md);
    const slug = file.replace('LMP-AI-', '').replace('.md', '').toLowerCase();
    writeFileSync(
      join(llmOutDir, `${slug}.html`),
      pageTemplate(`LMP AI: ${title}`, html)
    );
    llmLinks.push(`<a href="${BASE}/llm/${slug}.html">${title}</a>`);
  }

  const llmIndexHtml = `
    <h1>LLM Guides</h1>
    <p>AI-optimized teaching files for different musical contexts:</p>
    <ul>${llmLinks.map((l) => `<li>${l}</li>`).join('')}</ul>
  `;
  writeFileSync(
    join(llmOutDir, 'index.html'),
    pageTemplate('LLM Guides', llmIndexHtml)
  );

  console.log('Copying site root files...');
  cpSync(join(siteDir, 'index.html'), join(distDir, 'index.html'));
  cpSync(join(siteDir, 'compile.html'), join(distDir, 'compile.html'));

  console.log('Done. Output:', distDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
