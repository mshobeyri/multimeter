#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  extension: 'package.json',
  cli: 'mmtcli/package.json',
  mcp: 'mmtmcp/package.json',
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function setVersion(rel, version) {
  const text = read(rel);
  const next = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (next === text && !text.includes(`"${version}"`)) {
    throw new Error(`No version field in ${rel}`);
  }
  if (next !== text) {
    fs.writeFileSync(path.join(root, rel), next);
  }
}

function marketplaceVersion(version) {
  const match = String(version || '').match(/^(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }
  return match[1];
}

function applyVersion(version) {
  if (!/^\d+\.\d+\.\d+(-pre)?$/.test(version)) {
    throw new Error(`Use X.Y.Z or X.Y.Z-pre, got: ${version}`);
  }
  const extension = marketplaceVersion(version);
  setVersion(FILES.extension, extension);
  setVersion(FILES.cli, version);
  setVersion(FILES.mcp, version);
}

function current() {
  return {
    extension: readJson(FILES.extension).version,
    cli: readJson(FILES.cli).version,
    mcp: readJson(FILES.mcp).version,
  };
}

function assertMatch(product) {
  const wanted = {
    extension: marketplaceVersion(product),
    cli: product,
    mcp: product,
  };
  const got = current();
  const mismatches = Object.keys(wanted).filter((k) => got[k] !== wanted[k]);
  if (mismatches.length) {
    const detail = mismatches.map((k) => `  ${k}: ${got[k]} (want ${wanted[k]})`).join('\n');
    throw new Error(`Version mismatch:\n${detail}`);
  }
}

const args = process.argv.slice(2);
const setValue = args.includes('--set') ? args[args.indexOf('--set') + 1] : undefined;
const expectValue = args.includes('--expect') ? args[args.indexOf('--expect') + 1] : undefined;
const check = args.includes('--check');

if (setValue) {
  applyVersion(setValue);
}

const product = expectValue || readJson(FILES.cli).version;
if (check || expectValue) {
  assertMatch(product);
  console.log(`ok  extension ${marketplaceVersion(product)}  cli/mcp ${product}`);
  process.exit(0);
}

if (!setValue) {
  applyVersion(product);
}

assertMatch(product);
console.log(`synced  extension ${marketplaceVersion(product)}  cli/mcp ${product}`);
