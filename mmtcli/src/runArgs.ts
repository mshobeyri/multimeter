import {findProjectRootSync} from 'mmt-core/fileHelper';
import fs from 'fs';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';
import type {RunFileOptions, RunReporterMessage} from 'mmt-core/runConfig';
import type {NetworkConfig, EnvCertificateSettings} from 'mmt-core/NetworkData';
import {DEFAULT_NETWORK_CONFIG, resolvePassphrase} from 'mmt-core/NetworkData';
import path from 'path';

export type ReportFormat = 'junit' | 'mmt' | 'html' | 'md';

const {mergeEnv, resolvePresetEnv, resolveEnvFromDoc} =
    ((mmtcore as any).runConfig || {}) as any;

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  log: 2,
  debug: 3,
  trace: 4,
};

/* ── ANSI helpers (no external deps, works in binaries too) ── */
const useColor = process.stdout.isTTY !== false;
const ANSI_RESET  = useColor ? '\x1b[0m' : '';
const ANSI_RED    = useColor ? '\x1b[31m' : '';
const ANSI_GREEN  = useColor ? '\x1b[32m' : '';
const ANSI_YELLOW = useColor ? '\x1b[33m' : '';
const ANSI_DIM    = useColor ? '\x1b[2m' : '';
const ANSI_BOLD   = useColor ? '\x1b[1m' : '';

function colorizeLogLine(level: string, msg: string): string {
  // Check / Assert results (✓ / ✗ markers emitted by check_)
  if (msg.startsWith('\u2713')) {
    return `${ANSI_GREEN}${msg}${ANSI_RESET}`;
  }
  if (msg.startsWith('\u00D7')) {
    return `${ANSI_RED}${ANSI_BOLD}${msg}${ANSI_RESET}`;
  }
  // Level-based coloring
  switch (level) {
    case 'error': return `${ANSI_RED}[${level}] ${msg}${ANSI_RESET}`;
    case 'warn':  return `${ANSI_YELLOW}[${level}] ${msg}${ANSI_RESET}`;
    case 'trace': return `${ANSI_DIM}[${level}] ${msg}${ANSI_RESET}`;
    case 'debug': return `${ANSI_DIM}[${level}] ${msg}${ANSI_RESET}`;
    default:      return `[${level}] ${msg}`;
  }
}

type AnyOpts = Record<string, any>;

function coerceCliValue(v: string): any {
  const t = (v ?? '').trim();
  if (/^(true|false)$/i.test(t)) {
    return /^true$/i.test(t);
  }
  if (/^[-+]?\d+$/.test(t)) {
    return Number(t);
  }
  if (/^[-+]?\d*\.\d+$/.test(t)) {
    return Number(t);
  }
  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith('\'') && t.endsWith('\''))) {
    return t.slice(1, -1);
  }
  return t;
}

function parsePairs(list: string[]|undefined): Record<string, any> {
  const out: Record<string, any> = {};
  const arr = Array.isArray(list) ? list : [];
  for (let i = 0; i < arr.length; i++) {
    const token = arr[i] ?? '';
    const eq = token.indexOf('=');
    if (eq > 0) {
      const k = token.slice(0, eq).trim();
      const v = token.slice(eq + 1);
      if (k) {
        out[k] = coerceCliValue(v);
      }
    } else if (i + 1 < arr.length) {
      const k = token.trim();
      const v = arr[++i];
      if (k) {
        out[k] = coerceCliValue(v);
      }
    }
  }
  return out;
}

interface EnvDocResult {
  variables?: Record<string, any>;
  presets?: Record<string, any>;
  certificates?: EnvCertificateSettings;
}

function loadEnvDoc(envPath: string): EnvDocResult {
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    const data = yaml.load(txt) as any;
    if (!data || typeof data !== 'object') {
      return {};
    }
    if (data.type && String(data.type) !== 'env') {
      return {};
    }
    return {
      variables: data.variables || {},
      presets: data.presets || {},
      certificates: data.certificates || undefined,
    };
  } catch {
    return {};
  }
}

// Resolve certificate path relative to env file directory
function resolveCertPath(certPath: string, envFileDir: string): string {
  if (!certPath) {
    return '';
  }
  if (path.isAbsolute(certPath)) {
    return certPath;
  }
  return path.resolve(envFileDir, certPath);
}

// Build NetworkConfig from certificate settings in env file
// Note: Boolean settings (sslValidation, allowSelfSigned, enabled) default to sensible values
// since they are not stored in YAML
export function buildNetworkConfigFromEnv(
    certSettings: EnvCertificateSettings | undefined,
    envFileDir: string,
    envVars?: Record<string, any>): NetworkConfig {
  if (!certSettings) {
    return {...DEFAULT_NETWORK_CONFIG};
  }

  // Load CA certs (multiple paths)
  const caCertDataList: Buffer[] = [];
  const caPaths = certSettings.ca?.paths || [];
  // CA is enabled if there are paths defined
  const caEnabled = caPaths.length > 0;
  for (const caPath of caPaths) {
    if (caPath) {
      try {
        const resolvedPath = resolveCertPath(caPath, envFileDir);
        caCertDataList.push(fs.readFileSync(resolvedPath));
      } catch (e) {
        console.warn(`Failed to load CA certificate from ${caPath}: ${e}`);
      }
    }
  }

  // Load client certs (use snake_case fields from YAML)
  const clients = (certSettings.clients || []).map((client, idx) => {
    let certData: Buffer | undefined = undefined;
    let keyData: Buffer | undefined = undefined;
    // Client is enabled by default (boolean not in YAML)
    const clientEnabled = true;
    const certPath = client.cert_path || '';
    const keyPath = client.key_path || '';
    if (certPath && keyPath) {
      try {
        const certResolvedPath = resolveCertPath(certPath, envFileDir);
        const keyResolvedPath = resolveCertPath(keyPath, envFileDir);
        certData = fs.readFileSync(certResolvedPath);
        keyData = fs.readFileSync(keyResolvedPath);
      } catch (e) {
        console.warn(`Failed to load client certificate for ${client.host || 'unknown'}: ${e}`);
      }
    }
    const passphrase = resolvePassphrase(
        client.passphrase_plain, client.passphrase_env, envVars, process.env);
    return {
      id: `client-${idx}`,
      name: client.name || '',
      host: client.host || '*',
      cert_path: certPath,
      key_path: keyPath,
      passphrase_plain: passphrase,
      certData,
      keyData,
      enabled: clientEnabled,
    };
  });

  return {
    ca: {enabled: caEnabled, certPaths: caPaths, certData: caCertDataList.length > 0 ? caCertDataList : undefined},
    clients,
    sslValidation: true,  // Default true (not stored in YAML)
    allowSelfSigned: false,  // Default false (not stored in YAML)
    timeout: 30000,
    autoFormat: false,
  };
}

/**
 * Find the project root by walking up from startPath looking for multimeter.mmt.
 * Returns the directory containing multimeter.mmt, or undefined if not found.
 */
function findProjectRootForCli(startPath: string): string | undefined {
  return findProjectRootSync(startPath, fs.existsSync, path.dirname, path.join) ?? undefined;
}

export interface ParsedCliRunArgs {
  runFileOptions: RunFileOptions;
  networkConfig?: NetworkConfig;
  quiet: boolean;
  outFile?: string;
  printJs: boolean;
  reportFormat?: ReportFormat;
  reportFile?: string;
  getReportResults?: () => import('mmt-core/reportCollector').CollectedResults;
}

export function buildCliRunArgs(file: string, opts: AnyOpts): ParsedCliRunArgs {
  const full = path.resolve(process.cwd(), file);
  const dir = path.dirname(full);
  const rawText = fs.readFileSync(full, 'utf8');

  const manualInputs = parsePairs(opts.input);
  const manualEnvvars = parsePairs(opts.env);

  const exampleOptRaw = typeof (opts as any).example === 'string' ?
      String((opts as any).example) :
      undefined;
  let exampleIndexOpt: number|undefined = undefined;
  let exampleNameOpt: string|undefined = undefined;
  if (exampleOptRaw && exampleOptRaw.trim()) {
    const trimmed = exampleOptRaw.trim();
    const numeric = trimmed.match(/^#?(\d+)$/);
    if (numeric) {
      const parsed = Number(numeric[1]);
      exampleIndexOpt = parsed > 0 ? parsed - 1 : 0;
    } else {
      exampleNameOpt = trimmed;
    }
  }

  let envvar: Record<string, any>|undefined = undefined;
  let networkConfig: NetworkConfig|undefined = undefined;
  const envFileOpt = opts.envFile as string | undefined;
  const presetName = opts.preset as string | undefined;
  let envFileDir = dir;

  // Detect if this is a suite file and check for suite environment config
  let suiteEnvConfig: {preset?: string; file?: string; variables?: Record<string, unknown>} | undefined;
  try {
    const parsed = yaml.load(rawText) as any;
    if (parsed && parsed.type === 'suite' && parsed.environment) {
      suiteEnvConfig = parsed.environment;
    }
  } catch {
    // Not valid YAML or not a suite, continue normally
  }

  if (envFileOpt) {
    let p = String(envFileOpt);
    if (!path.isAbsolute(p)) {
      const fromCwd = path.resolve(process.cwd(), p);
      if (fs.existsSync(fromCwd)) {
        p = fromCwd;
      } else {
        p = path.resolve(dir, p);
      }
    }
    envFileDir = path.dirname(p);
    const doc = loadEnvDoc(p);
    if (typeof resolveEnvFromDoc === 'function') {
      envvar = resolveEnvFromDoc({doc, presetName, manualEnvvars});
    } else {
      const presetEnv = resolvePresetEnv(doc, presetName);
      envvar = mergeEnv({envvar: presetEnv, manualEnvvars});
    }
    // Build network config from certificates in env file
    if (doc.certificates) {
      networkConfig = buildNetworkConfigFromEnv(doc.certificates, envFileDir, envvar);
    }
  } else {
    envvar = mergeEnv({envvar: undefined, manualEnvvars});
  }

  // Merge suite environment for CLI
  // Priority: CLI -e > suite environment.variables > suite preset > --env-file/--preset > defaults
  if (suiteEnvConfig) {
    const projectRoot = findProjectRootForCli(full);

    // Resolve suite preset if specified
    let suitePresetEnv: Record<string, any> = {};
    if (suiteEnvConfig.preset) {
      let suiteEnvFilePath: string | undefined;
      if (suiteEnvConfig.file) {
        // Resolve relative to suite file or project root for +/ paths
        if (suiteEnvConfig.file.startsWith('+/')) {
          suiteEnvFilePath = projectRoot ? path.join(projectRoot, suiteEnvConfig.file.slice(2)) : undefined;
        } else {
          suiteEnvFilePath = path.resolve(dir, suiteEnvConfig.file);
        }
      } else if (projectRoot) {
        // Use multimeter.mmt in project root
        suiteEnvFilePath = path.join(projectRoot, 'multimeter.mmt');
      }

      if (suiteEnvFilePath && fs.existsSync(suiteEnvFilePath)) {
        const suiteEnvDoc = loadEnvDoc(suiteEnvFilePath);
        suitePresetEnv = resolvePresetEnv(suiteEnvDoc, suiteEnvConfig.preset);
      }
    }

    // Merge: base (--env-file/--preset) < suite preset < suite variables < CLI -e
    const baseEnv = {...(envvar || {})};
    // Remove CLI -e from base (it will be applied at highest priority)
    for (const key of Object.keys(manualEnvvars)) {
      delete baseEnv[key];
    }
    const suiteVariables = suiteEnvConfig.variables ? {...suiteEnvConfig.variables} : {};
    envvar = {...baseEnv, ...suitePresetEnv, ...suiteVariables, ...manualEnvvars};
  }

  const runFileOptions: RunFileOptions&{
    fileLoader: (path: string) => Promise<string>;
    jsRunner: (
        code: string, title: string,
        logger: (level: any, msg: string) => void) => Promise<void>;
    logger: (level: any, msg: string) => void;
    reporter: (message: RunReporterMessage) => void;
  }
  = {
    file: rawText,
    fileType: 'raw',
    filePath: full,
    exampleIndex: exampleIndexOpt,
    exampleName: exampleNameOpt,
    manualInputs,
    envvar,
    manualEnvvars,
    fileLoader: async (p: string) => {
      const rel = path.isAbsolute(p) ? p : path.join(dir, p);
      if (!fs.existsSync(rel)) {
        return '';
      }
      return fs.readFileSync(rel, 'utf8');
    },
    jsRunner: async () => {},
    logger: (level: any, msg: string) => {
      const maxLevel = LOG_LEVEL_PRIORITY[opts.logLevel ?? 'info'] ?? 2;
      const msgLevel = LOG_LEVEL_PRIORITY[level] ?? 2;
      if (msgLevel <= maxLevel) {
        console.log(colorizeLogLine(level, msg));
      }
    },
    reporter: (_message: RunReporterMessage) => {},
    projectRoot: findProjectRootForCli(full),
  };

  // Wire collecting reporter when --report is requested
  const reportFormat = opts.report as ReportFormat | undefined;
  let getReportResults: (() => any) | undefined;
  if (reportFormat) {
    const {createReportCollector} = (mmtcore as any).reportCollector || {};
    if (typeof createReportCollector === 'function') {
      const collector = createReportCollector();
      runFileOptions.reporter = collector.reporter;
      getReportResults = collector.getResults;
    }
  }

  const defaultReportFiles: Record<ReportFormat, string> = {
    junit: 'test-results.xml',
    mmt: 'test-results.mmt',
    html: 'test-results.html',
    md: 'test-results.md',
  };

  return {
    runFileOptions,
    networkConfig,
    quiet: !!opts.quiet,
    outFile: opts.out ? String(opts.out) : undefined,
    printJs: !!opts.printJs,
    reportFormat,
    reportFile: reportFormat
      ? (opts.reportFile ? String(opts.reportFile) : defaultReportFiles[reportFormat])
      : undefined,
    getReportResults,
  };
}

export {parsePairs, coerceCliValue};
