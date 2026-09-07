#!/usr/bin/env node
/**
 * Sitemap, llms.txt, well-known copy, and static agent HTML for AI crawlers.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  allSitemapHrefs,
  lastmodForHref,
  origin,
  repoRoot,
  websitePublic,
  writeForAgentsHtml,
  writeLlmsTxt,
} from './geo.mjs';

const ordered = allSitemapHrefs();
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...ordered.map((loc) => {
    const href = loc === '/' ? '/' : loc;
    const lastmod = lastmodForHref(href);
    return `  <url><loc>${origin}${href}</loc><lastmod>${lastmod}</lastmod></url>`;
  }),
  '</urlset>',
  '',
].join('\n');

fs.mkdirSync(websitePublic, {recursive: true});
fs.writeFileSync(path.join(websitePublic, 'sitemap.xml'), sitemap);

const llmsTxt = writeLlmsTxt();
fs.writeFileSync(path.join(repoRoot, 'llms.txt'), llmsTxt);
fs.writeFileSync(path.join(websitePublic, 'llms.txt'), llmsTxt);
const wellKnown = path.join(websitePublic, '.well-known');
fs.mkdirSync(wellKnown, {recursive: true});
fs.writeFileSync(path.join(wellKnown, 'llms.txt'), llmsTxt);

const forAgents = writeForAgentsHtml();
fs.writeFileSync(path.join(websitePublic, 'for-agents.html'), forAgents);

const fullSrc = path.join(repoRoot, 'llms-full.txt');
if (fs.existsSync(fullSrc)) {
  fs.copyFileSync(fullSrc, path.join(websitePublic, 'llms-full.txt'));
}

console.log(`sitemap: ${ordered.length} URLs → website/public/sitemap.xml`);
console.log('wrote llms.txt, .well-known/llms.txt, for-agents.html');
