#!/usr/bin/env node
/**
 * Copy the Vite SPA shell to each public route and inject crawler-readable
 * title, description, canonical, and noscript body (no headless browser).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_BLURB,
  MARKETING,
  collectNavLeaves,
  docFileForHref,
  escapeHtml,
  exampleUrls,
  extractMarkdownDescription,
  repoRoot,
} from './geo.mjs';

const dist = path.join(repoRoot, 'website/dist');
const shellPath = path.join(dist, 'index.html');
if (!fs.existsSync(shellPath)) {
  console.error('prerender: website/dist/index.html missing — run vite build first');
  process.exit(1);
}

const shell = fs.readFileSync(shellPath, 'utf8');
const nav = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/nav.json'), 'utf8'));
const docLeaves = [];
for (const section of nav) {
  collectNavLeaves(section.items || [], docLeaves);
}

const pages = new Map();
for (const page of MARKETING) {
  pages.set(page.path, page);
}
for (const leaf of docLeaves) {
  if (!pages.has(leaf.href)) {
    const mdPath = path.join(repoRoot, 'docs', leaf.contentPath);
    const fallback = `${leaf.title} in Multimeter, the AI-powered REST Client for VS Code.`;
    const description =
      fs.existsSync(mdPath)
        ? extractMarkdownDescription(fs.readFileSync(mdPath, 'utf8'), fallback)
        : fallback;
    pages.set(leaf.href, {
      path: leaf.href,
      title: `${leaf.title} — Multimeter docs`,
      description,
      contentPath: leaf.contentPath,
    });
  }
}

for (const url of exampleUrls()) {
  if (pages.has(url)) {
    continue;
  }
  if (url === '/docs/examples') {
    pages.set(url, {
      path: url,
      title: 'Examples — Multimeter docs',
      description: 'Sample YAML .mmt API and test files from the Multimeter repo.',
    });
    continue;
  }
  const parts = url.split('/').filter(Boolean);
  const tier = parts[2];
  const slug = parts[3];
  const readme = path.join(repoRoot, 'examples', tier, slug, 'README.md');
  let title = slug;
  let description = `Multimeter example ${slug}: YAML .mmt API testing.`;
  if (fs.existsSync(readme)) {
    const markdown = fs.readFileSync(readme, 'utf8');
    const heading = markdown.match(/^#\s+(.+)$/m);
    if (heading) {
      title = heading[1].trim();
    }
    description = extractMarkdownDescription(markdown, description);
  }
  pages.set(url, {
    path: url,
    title: `${title} — Multimeter examples`,
    description,
  });
}

function replaceAttrBlock(html, attrName, value) {
  const pattern = new RegExp(
    `<meta\\s+${attrName}[\\s\\S]*?content="[^"]*"[\\s\\S]*?/>`,
    'i',
  );
  if (!pattern.test(html)) {
    return html;
  }
  return html.replace(pattern, `<meta ${attrName} content="${value}" />`);
}

function noscriptFor(page) {
  const parts = [`<p>${escapeHtml(page.body || page.description || CANONICAL_BLURB)}</p>`];
  const docFile = page.contentPath
    ? path.join(repoRoot, 'docs', page.contentPath)
    : docFileForHref(page.path);
  if (docFile && fs.existsSync(docFile)) {
    const rel = path.relative(path.join(repoRoot, 'docs'), docFile).split(path.sep).join('/');
    let markdown = fs.readFileSync(docFile, 'utf8');
    if (markdown.length > 40000) {
      markdown = `${markdown.slice(0, 40000)}\n\n…`;
    }
    parts.push(
      `<p><a href="https://mmt.dev/raw/docs/${rel}">Markdown (no JavaScript)</a></p>`,
      `<pre>${escapeHtml(markdown)}</pre>`,
    );
  }
  parts.push(
    `<p><a href="https://mmt.dev/for-agents.html">For AI agents</a> · <a href="https://mmt.dev/llms.txt">llms.txt</a> · <a href="https://mmt.dev">Home</a></p>`,
  );
  return parts.join('\n      ');
}

function renderPage(page) {
  const url = `https://mmt.dev${page.path === '/' ? '/' : page.path}`;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description || CANONICAL_BLURB);
  let html = shell;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = replaceAttrBlock(html, 'name="description"', description);
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${url}" />`,
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`,
  );
  html = replaceAttrBlock(html, 'property="og:description"', description);
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${title}" />`,
  );
  html = replaceAttrBlock(html, 'name="twitter:description"', description);
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, `    <noscript>\n      ${noscriptFor(page)}\n    </noscript>`);
  return html;
}

function outFileFor(routePath) {
  if (routePath === '/') {
    return path.join(dist, 'index.html');
  }
  return path.join(dist, routePath.replace(/^\//, ''), 'index.html');
}

let count = 0;
for (const page of pages.values()) {
  if (page.path.endsWith('.html') || page.path.endsWith('.txt') || page.path.endsWith('.xml')) {
    continue;
  }
  const html = renderPage(page);
  const outFile = outFileFor(page.path);
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, html);
  count += 1;
}

const wellKnownDir = path.join(dist, '.well-known');
fs.mkdirSync(wellKnownDir, {recursive: true});
fs.copyFileSync(path.join(repoRoot, 'llms.txt'), path.join(wellKnownDir, 'llms.txt'));

console.log(`prerender: ${count} HTML shells with crawler noscript`);
console.log('prerender: dist/.well-known/llms.txt');
