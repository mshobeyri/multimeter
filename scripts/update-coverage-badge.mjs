#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
const readmePath = path.join(root, 'README.md');
const badgeRe =
    /src="https:\/\/img\.shields\.io\/badge\/coverage-[^"]+"/;

function colorFor(pct) {
  if (pct >= 90) {
    return 'brightgreen';
  }
  if (pct >= 80) {
    return 'green';
  }
  if (pct >= 70) {
    return 'yellowgreen';
  }
  if (pct >= 60) {
    return 'yellow';
  }
  if (pct >= 50) {
    return 'orange';
  }
  return 'red';
}

if (!fs.existsSync(summaryPath)) {
  throw new Error(
      'Missing coverage/coverage-summary.json. Run npm run test:coverage first.');
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const pct = Number(summary?.total?.lines?.pct);
if (!Number.isFinite(pct)) {
  throw new Error('coverage-summary.json has no total.lines.pct');
}

const label = pct.toFixed(1);
const src =
    `src="https://img.shields.io/badge/coverage-${encodeURIComponent(label + '%')}-${colorFor(pct)}.svg"`;
const readme = fs.readFileSync(readmePath, 'utf8');
if (!badgeRe.test(readme)) {
  throw new Error('README.md has no coverage shields.io badge to update');
}

const next = readme.replace(badgeRe, src);
if (next !== readme) {
  fs.writeFileSync(readmePath, next);
}
console.log(`Coverage badge: ${label}% (${colorFor(pct)})`);
