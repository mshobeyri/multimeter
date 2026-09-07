import axios from 'axios';
import {execFileSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {pipeline} from 'stream/promises';
import {createWriteStream} from 'fs';

export type InstallChannel = 'standalone' | 'npm' | 'homebrew' | 'unknown';

export type UpdatePlatform =
  'macos-x64'|'macos-arm64'|'linux-x64'|'linux-arm64'|'win-x64';

export interface UpdateOptions {
  currentVersion: string;
  version?: string;
  channel?: string;
  checkOnly?: boolean;
  force?: boolean;
  /** Override process.execPath (tests). */
  execPath?: string;
  /** Override process.argv[1] (tests). */
  scriptPath?: string;
  /** GitHub owner/repo (default mshobeyri/multimeter). */
  repo?: string;
  /**
   * Download base for portal mirrors.
   * Assets: `${base}/v${version}/testlight-${platform}.tar.gz|zip`
   */
  releaseBaseUrl?: string;
  /** Injected fetch for tests. */
  fetchJson?: (url: string) => Promise<any>;
  downloadToFile?: (url: string, dest: string) => Promise<void>;
  log?: (message: string) => void;
}

export interface UpdatePlan {
  channel: InstallChannel;
  platform: UpdatePlatform;
  currentVersion: string;
  targetVersion: string;
  installDir: string;
  binaryName: string;
  downloadUrl: string;
  action: 'download' | 'advise-npm' | 'advise-homebrew' | 'noop';
  advice?: string;
}

export interface UpdateResult {
  ok: boolean;
  plan: UpdatePlan;
  message: string;
  updated?: boolean;
}

const DEFAULT_REPO = 'mshobeyri/multimeter';

export function normalizeVersion(version: string): string {
  return String(version || '').trim().replace(/^v/i, '');
}

/** Compare semver-ish versions. Returns -1 / 0 / 1. */
export function compareVersions(a: string, b: string): number {
  const na = normalizeVersion(a);
  const nb = normalizeVersion(b);
  const parse = (v: string) => {
    const [core, pre] = v.split('-', 2);
    const parts = core.split('.').map(p => Number.parseInt(p, 10) || 0);
    while (parts.length < 3) {
      parts.push(0);
    }
    return {parts, pre: pre || ''};
  };
  const aa = parse(na);
  const bb = parse(nb);
  for (let i = 0; i < 3; i++) {
    if (aa.parts[i] !== bb.parts[i]) {
      return aa.parts[i] < bb.parts[i] ? -1 : 1;
    }
  }
  if (aa.pre === bb.pre) {
    return 0;
  }
  if (!aa.pre) {
    return 1;
  }
  if (!bb.pre) {
    return -1;
  }
  return aa.pre < bb.pre ? -1 : 1;
}

export function detectPlatform(
    unameOs = process.platform, unameArch = process.arch): UpdatePlatform {
  let osName: string;
  if (unameOs === 'darwin') {
    osName = 'macos';
  } else if (unameOs === 'win32') {
    osName = 'win';
  } else {
    osName = 'linux';
  }
  let arch = unameArch === 'arm64' ? 'arm64' : 'x64';
  if (osName === 'win' && arch === 'arm64') {
    arch = 'x64';
  }
  return `${osName}-${arch}` as UpdatePlatform;
}

export function detectInstallChannel(execPath: string, scriptPath?: string):
    InstallChannel {
  const exec = execPath.replace(/\\/g, '/');
  const script = (scriptPath || '').replace(/\\/g, '/');
  if ((process as any).pkg) {
    return 'standalone';
  }
  if (/\/Cellar\/mmt-testlight\//i.test(exec) ||
      /\/homebrew\/.*(mmt-testlight|testlight)/i.test(exec)) {
    return 'homebrew';
  }
  if (/\/node_modules\/mmt-testlight\//i.test(exec) ||
      /\/node_modules\/mmt-testlight\//i.test(script)) {
    return 'npm';
  }
  const base = path.basename(exec).toLowerCase();
  if (base === 'testlight' || base === 'testlight.exe' || base === 'mmt' ||
      base === 'mmt.exe') {
    return 'standalone';
  }
  // node running bundled cli.js from a global npm link / local dist
  if (/\/mmtcli\/dist\/cli\.js$/i.test(script) ||
      /\/mmt-testlight\/dist\/cli\.js$/i.test(script)) {
    return 'npm';
  }
  return 'unknown';
}

export function buildDownloadUrl(opts: {
  version: string;
  platform: UpdatePlatform;
  repo?: string;
  releaseBaseUrl?: string;
}): string {
  const version = normalizeVersion(opts.version);
  const ext = opts.platform.startsWith('win-') ? 'zip' : 'tar.gz';
  const file = `testlight-${opts.platform}.${ext}`;
  if (opts.releaseBaseUrl) {
    const base = opts.releaseBaseUrl.replace(/\/+$/, '');
    return `${base}/v${version}/${file}`;
  }
  const repo = opts.repo || DEFAULT_REPO;
  return `https://github.com/${repo}/releases/download/v${version}/${file}`;
}

async function defaultFetchJson(url: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'testlight-update',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await axios.get(url, {
    headers,
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status === 403) {
    throw new Error(
        `GitHub API rate limit or access denied (HTTP 403) for ${url}. ` +
        `Pass --version explicitly, set GITHUB_TOKEN, or use --base-url for a portal mirror.`);
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.data;
}

async function defaultDownloadToFile(url: string, dest: string): Promise<void> {
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 120000,
    headers: {'User-Agent': 'testlight-update'},
    validateStatus: () => true,
  });
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} downloading ${url}`);
  }
  await pipeline(res.data, createWriteStream(dest));
}

export async function resolveTargetVersion(opts: {
  version?: string;
  channel?: string;
  repo?: string;
  fetchJson?: (url: string) => Promise<any>;
}): Promise<string> {
  if (opts.version) {
    return normalizeVersion(opts.version);
  }
  const repo = opts.repo || DEFAULT_REPO;
  const fetchJson = opts.fetchJson || defaultFetchJson;
  const channel = (opts.channel || '').trim().toLowerCase();

  if (channel) {
    const releases = await fetchJson(
        `https://api.github.com/repos/${repo}/releases?per_page=30`);
    if (!Array.isArray(releases)) {
      throw new Error('Unexpected GitHub releases response');
    }
    for (const release of releases) {
      const tag = normalizeVersion(String(release?.tag_name || ''));
      if (!tag) {
        continue;
      }
      if (channel === 'prerelease' || channel === 'pre') {
        if (release?.prerelease || tag.includes('-')) {
          return tag;
        }
        continue;
      }
      if (tag.toLowerCase().includes(channel) ||
          String(release?.name || '').toLowerCase().includes(channel)) {
        return tag;
      }
    }
    throw new Error(`No GitHub release found for channel "${channel}"`);
  }

  const latest = await fetchJson(
      `https://api.github.com/repos/${repo}/releases/latest`);
  const tag = normalizeVersion(String(latest?.tag_name || ''));
  if (!tag) {
    throw new Error('Could not resolve latest GitHub release tag');
  }
  return tag;
}

export async function planUpdate(options: UpdateOptions): Promise<UpdatePlan> {
  const execPath = options.execPath || process.execPath;
  const scriptPath = options.scriptPath || process.argv[1];
  const channel = detectInstallChannel(execPath, scriptPath);
  const platform = detectPlatform();
  const currentVersion = normalizeVersion(options.currentVersion);
  const repo = options.repo || process.env.TESTLIGHT_REPO || DEFAULT_REPO;
  const releaseBaseUrl =
      options.releaseBaseUrl || process.env.TESTLIGHT_RELEASE_BASE_URL ||
      undefined;

  const targetVersion = await resolveTargetVersion({
    version: options.version,
    channel: options.channel,
    repo,
    fetchJson: options.fetchJson,
  });

  const installDir = path.dirname(execPath);
  const binaryName =
      platform.startsWith('win-') ? 'testlight.exe' : 'testlight';
  const downloadUrl = buildDownloadUrl({
    version: targetVersion,
    platform,
    repo,
    releaseBaseUrl,
  });

  if (channel === 'npm') {
    return {
      channel,
      platform,
      currentVersion,
      targetVersion,
      installDir,
      binaryName,
      downloadUrl,
      action: 'advise-npm',
      advice:
          `npm install -g mmt-testlight@${targetVersion}`,
    };
  }
  if (channel === 'homebrew') {
    return {
      channel,
      platform,
      currentVersion,
      targetVersion,
      installDir,
      binaryName,
      downloadUrl,
      action: 'advise-homebrew',
      advice: 'brew upgrade mmt-testlight',
    };
  }

  if (!options.force && compareVersions(currentVersion, targetVersion) >= 0) {
    return {
      channel: channel === 'unknown' ? 'standalone' : channel,
      platform,
      currentVersion,
      targetVersion,
      installDir,
      binaryName,
      downloadUrl,
      action: 'noop',
      advice: `Already up to date (v${currentVersion}).`,
    };
  }

  return {
    channel: channel === 'unknown' ? 'standalone' : channel,
    platform,
    currentVersion,
    targetVersion,
    installDir,
    binaryName,
    downloadUrl,
    action: 'download',
  };
}

function extractArchive(archivePath: string, destDir: string, platform: UpdatePlatform) {
  if (platform.startsWith('win-')) {
    if (process.platform === 'win32') {
      execFileSync(
          'powershell.exe',
          [
            '-NoProfile', '-Command',
            `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
          ],
          {stdio: 'ignore'});
      return;
    }
    execFileSync('unzip', ['-q', archivePath, '-d', destDir], {stdio: 'ignore'});
    return;
  }
  execFileSync('tar', ['-xzf', archivePath, '-C', destDir], {stdio: 'ignore'});
}

function findExtractedBinary(dir: string, binaryName: string): string {
  const direct = path.join(dir, binaryName);
  if (fs.existsSync(direct)) {
    return direct;
  }
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, {withFileTypes: true})) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === binaryName) {
        return full;
      }
    }
  }
  throw new Error(`Extracted archive did not contain ${binaryName}`);
}

function replaceBinary(source: string, dest: string, platform: UpdatePlatform) {
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, {recursive: true});
  if (platform.startsWith('win-')) {
    const staging = `${dest}.new`;
    const bak = `${dest}.bak`;
    fs.copyFileSync(source, staging);
    try {
      if (fs.existsSync(dest)) {
        try {
          fs.unlinkSync(bak);
        } catch {
        }
        fs.renameSync(dest, bak);
      }
      fs.renameSync(staging, dest);
      try {
        fs.unlinkSync(bak);
      } catch {
        // Windows may keep a lock on the running binary; leave .bak
      }
    } catch (error) {
      throw new Error(
          `Could not replace ${dest} while testlight is running. ` +
          `Downloaded to ${staging}. Close other testlight processes and retry, ` +
          `or copy manually. (${(error as Error).message})`);
    }
    const mmtCmd = path.join(destDir, 'mmt.cmd');
    if (!fs.existsSync(mmtCmd)) {
      fs.writeFileSync(
          mmtCmd,
          '@echo off\r\nsetlocal\r\n"%~dp0testlight.exe" %*\r\nexit /b %ERRORLEVEL%\r\n');
    }
    return;
  }

  const staging = `${dest}.new`;
  fs.copyFileSync(source, staging);
  fs.chmodSync(staging, 0o755);
  fs.renameSync(staging, dest);
  const mmt = path.join(destDir, 'mmt');
  try {
    fs.unlinkSync(mmt);
  } catch {
  }
  fs.symlinkSync(dest, mmt);
}

export async function runUpdate(options: UpdateOptions): Promise<UpdateResult> {
  const log = options.log || ((message: string) => console.error(message));
  const plan = await planUpdate(options);

  if (plan.action === 'advise-npm' || plan.action === 'advise-homebrew') {
    return {
      ok: true,
      plan,
      updated: false,
      message:
          `This testlight was installed via ${plan.channel}. Update with:\n  ${plan.advice}`,
    };
  }

  if (plan.action === 'noop') {
    return {
      ok: true,
      plan,
      updated: false,
      message: plan.advice || `Already up to date (v${plan.currentVersion}).`,
    };
  }

  if (options.checkOnly) {
    return {
      ok: true,
      plan,
      updated: false,
      message:
          `Update available: v${plan.currentVersion} → v${plan.targetVersion}\n` +
          `  ${plan.downloadUrl}`,
    };
  }

  const download = options.downloadToFile || defaultDownloadToFile;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testlight-update-'));
  const archiveExt = plan.platform.startsWith('win-') ? 'zip' : 'tar.gz';
  const archivePath = path.join(tmpRoot, `testlight.${archiveExt}`);
  const extractDir = path.join(tmpRoot, 'out');
  fs.mkdirSync(extractDir, {recursive: true});

  try {
    log(`Downloading testlight v${plan.targetVersion} (${plan.platform})...`);
    log(`  ${plan.downloadUrl}`);
    await download(plan.downloadUrl, archivePath);
    log('Extracting...');
    extractArchive(archivePath, extractDir, plan.platform);
    const extracted = findExtractedBinary(extractDir, plan.binaryName);
    const dest = path.join(plan.installDir, plan.binaryName);
    log(`Installing to ${dest}`);
    replaceBinary(extracted, dest, plan.platform);
    return {
      ok: true,
      plan,
      updated: true,
      message: `Updated testlight v${plan.currentVersion} → v${plan.targetVersion} in ${plan.installDir}`,
    };
  } finally {
    try {
      fs.rmSync(tmpRoot, {recursive: true, force: true});
    } catch {
    }
  }
}
