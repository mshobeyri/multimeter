#!/usr/bin/env node
/**
 * Sitemap + raw markdown mirrors for AI crawlers.
 * Run from repo root or website/: node scripts/generate-ai-discovery.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const websitePublic = path.join(repoRoot, 'website/public');
const origin = 'https://mmt.dev';

function pathToHref(contentPath) {
  const withoutExt = contentPath.replace(/\.md$/, '');
  if (withoutExt === 'tasks/index') {
    return '/docs/tasks';
  }
  if (withoutExt.endsWith('/index')) {
    return `/docs/${withoutExt.slice(0, -'/index'.length)}`;
  }
  return `/docs/${withoutExt}`;
}

function collectNavHrefs(items, out) {
  for (const item of items) {
    if (item.path) {
      out.add(pathToHref(item.path));
    }
    if (item.href && String(item.href).startsWith('/')) {
      out.add(item.href.replace(/\/$/, '') || item.href);
    }
    if (item.children) {
      collectNavHrefs(item.children, out);
    }
  }
}

function exampleUrls() {
  const urls = ['/docs/examples'];
  const examplesRoot = path.join(repoRoot, 'examples');
  for (const tier of ['basic', 'intermediate', 'professional']) {
    const tierDir = path.join(examplesRoot, tier);
    if (!fs.existsSync(tierDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(tierDir, {withFileTypes: true})) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        urls.push(`/docs/examples/${tier}/${entry.name}`);
      }
    }
  }
  return urls;
}

const marketing = [
  '/',
  '/downloads',
  '/demos',
  '/tutorials',
  '/roadmap',
  '/compare',
  '/compare/postman',
  '/compare/bruno',
  '/compare/promptfoo',
  '/compare/thunder-client',
  '/compare/rest-client',
  '/test-server',
  '/for-agents.html',
  '/llms.txt',
  '/llms-full.txt',
];

const nav = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/nav.json'), 'utf8'));
const hrefs = new Set(marketing);
for (const section of nav) {
  collectNavHrefs(section.items || [], hrefs);
}
for (const url of exampleUrls()) {
  hrefs.add(url);
}

const ordered = [...hrefs].sort((a, b) => {
  if (a === '/') {
    return -1;
  }
  if (b === '/') {
    return 1;
  }
  return a.localeCompare(b);
});

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...ordered.map((loc) => `  <url><loc>${origin}${loc === '/' ? '/' : loc}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

fs.mkdirSync(websitePublic, {recursive: true});
fs.writeFileSync(path.join(websitePublic, 'sitemap.xml'), sitemap);

for (const name of ['llms.txt', 'llms-full.txt']) {
  const src = path.join(repoRoot, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(websitePublic, name));
  }
}

console.log(`sitemap: ${ordered.length} URLs → website/public/sitemap.xml`);
