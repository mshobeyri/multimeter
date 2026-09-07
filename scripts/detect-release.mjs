#!/usr/bin/env node
/**
 * Decide whether this commit should publish a release.
 *
 * Triggers:
 *   - commit subject `Release version X.Y.Z` (optional `pre-release`)
 *   - CHANGELOG.md in the commit and a new top `## [X.Y.Z]` that is not tagged yet
 *   - RELEASE_VERSION env (workflow_dispatch)
 *
 * Writes GitHub outputs: should_release, version, reason
 */
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const VERSION_RE = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

export function versionFromCommitMessage(message) {
  const line = String(message || '').split('\n')[0].trim();
  const match = line.match(new RegExp(`^Release version ${VERSION_RE.source}`, 'i'));
  return match?.[1] || '';
}

export function versionFromChangelog(text) {
  const match = String(text || '').match(new RegExp(`^## \\[${VERSION_RE.source}\\]`, 'm'));
  return match?.[1] || '';
}

function git(args) {
  return execSync(`git ${args}`, {encoding: 'utf8'}).trim();
}

function writeOutput(key, value) {
  const line = `${key}=${value}`;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
  }
  console.log(line);
}

function tagExists(version) {
  const tag = `v${version}`;
  try {
    const remote = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
      encoding: 'utf8',
    }).trim();
    if (remote) {
      return true;
    }
  } catch {
    // offline or no origin
  }
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function changedFiles() {
  try {
    return git('diff-tree --no-commit-id --name-only -r HEAD').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function detect() {
  const forced = String(process.env.RELEASE_VERSION || '').trim();
  if (forced) {
    if (!VERSION_RE.test(forced)) {
      throw new Error(`Invalid RELEASE_VERSION: ${forced}`);
    }
    return {version: forced, reason: 'dispatch'};
  }

  const message = process.env.COMMIT_MESSAGE || git('log -1 --format=%s');
  const fromCommit = versionFromCommitMessage(message);
  if (fromCommit) {
    return {version: fromCommit, reason: 'commit'};
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const changelogChanged = changedFiles().includes('CHANGELOG.md');
  if (changelogChanged) {
    const fromLog = versionFromChangelog(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'));
    if (fromLog) {
      return {version: fromLog, reason: 'changelog'};
    }
  }

  return {version: '', reason: 'none'};
}

if (process.argv.includes('--self-test')) {
  const commit = versionFromCommitMessage('Release version 1.40.0');
  const pre = versionFromCommitMessage('Release version 1.40.0 pre-release');
  const log = versionFromChangelog('# Change Log\n\n## [1.40.0]\n\nPre-release.\n');
  const skipTestlight = versionFromChangelog('## [testlight 0.4.4]\n');
  if (commit !== '1.40.0' || pre !== '1.40.0' || log !== '1.40.0' || skipTestlight) {
    throw new Error('detect-release self-test failed');
  }
  console.log('detect-release self-test ok');
  process.exit(0);
}

const {version, reason} = detect();
if (!version) {
  writeOutput('should_release', 'false');
  writeOutput('version', '');
  writeOutput('reason', reason);
  process.exit(0);
}

if (tagExists(version)) {
  console.log(`Tag v${version} already exists; skip`);
  writeOutput('should_release', 'false');
  writeOutput('version', version);
  writeOutput('reason', 'already-tagged');
  process.exit(0);
}

writeOutput('should_release', 'true');
writeOutput('version', version);
writeOutput('reason', reason);
