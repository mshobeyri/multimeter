#!/usr/bin/env node
/**
 * Keep extension, Testlight CLI, Cursor plugin, and GitHub Action on one version.
 *
 *   node scripts/sync-versions.mjs              # copy root package.json → others
 *   node scripts/sync-versions.mjs --set 1.40.0
 *   node scripts/sync-versions.mjs --check
 *   node scripts/sync-versions.mjs --check --expect 1.40.0
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(path.join(root, rel), text);
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function replaceOnce(rel, pattern, replacement) {
  const text = read(rel);
  if (!pattern.test(text)) {
    throw new Error(`No match in ${rel} for ${pattern}`);
  }
  write(rel, text.replace(pattern, replacement));
}

function replaceJsonVersion(rel, version) {
  replaceOnce(rel, /("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
}

function currentVersions() {
  const action = read('.github/actions/testlight/action.yml');
  const versionMatch = action.match(
      /  version:\n    description:[\s\S]*?\n    default:\s*'([^']+)'/,
  );
  const versionDefault = versionMatch?.[1] || '';
  return {
    extension: readJson('package.json').version,
    plugin: readJson('.cursor-plugin/plugin.json').version,
    cli: readJson('mmtcli/package.json').version,
    action: versionDefault,
  };
}

function applyVersion(version) {
  if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  replaceJsonVersion('package.json', version);
  replaceJsonVersion('.cursor-plugin/plugin.json', version);
  replaceJsonVersion('mmtcli/package.json', version);
  replaceOnce('mmtcli/package-lock.json', /("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  replaceOnce(
      'mmtcli/package-lock.json',
      /("name"\s*:\s*"mmt-testlight",\s*"version"\s*:\s*")[^"]+(")/,
      `$1${version}$2`,
  );

  replaceOnce(
      '.github/actions/testlight/action.yml',
      /(description: 'testlight version to install \(default: )[^)]+(\))/,
      `$1${version}$2`,
  );
  replaceOnce(
      '.github/actions/testlight/action.yml',
      /(  version:\n    description:[^\n]+\n    required: false\n    default: ')[^']+(')/,
      `$1${version}$2`,
  );
  replaceOnce(
      '.github/actions/testlight/README.md',
      /(\| `version` \| No \| `)[^`]+(`)/,
      `$1${version}$2`,
  );
  const website = path.join(root, 'website/src/sections/CICDReady.tsx');
  if (fs.existsSync(website)) {
    replaceOnce(
        'website/src/sections/CICDReady.tsx',
        /(mmt-testlight@)[0-9]+(?:\.[0-9]+){2}/,
        `$1${version}`,
    );
  }
}

function assertMatch(expect) {
  const versions = currentVersions();
  const mismatches = Object.entries(versions).filter(([, value]) => value !== expect);
  if (mismatches.length) {
    const detail = mismatches.map(([name, value]) => `  ${name}=${value}`).join('\n');
    throw new Error(`Version mismatch (expected ${expect}):\n${detail}`);
  }
}

const args = process.argv.slice(2);
const setIdx = args.indexOf('--set');
const expectIdx = args.indexOf('--expect');
const check = args.includes('--check');
const setValue = setIdx >= 0 ? args[setIdx + 1] : undefined;
const expectValue = expectIdx >= 0 ? args[expectIdx + 1] : undefined;

if (setValue) {
  applyVersion(setValue);
}

const expected = expectValue || readJson('package.json').version;
if (check || expectValue) {
  assertMatch(expected);
  console.log(`versions ok: ${expected}`);
  process.exit(0);
}

if (!setValue) {
  applyVersion(expected);
}

assertMatch(expected);
console.log(`synced versions to ${expected}`);
