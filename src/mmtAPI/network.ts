import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {findProjectRootSync, resolveCertFilePath} from 'mmt-core/fileHelper';
import {handleNetworkMessage as coreHandleNetworkMessage, NetworkMessage, PostMessage} from 'mmt-core/network';
import {CertificateSettings, DEFAULT_CERT_SETTINGS, DEFAULT_NETWORK_CONFIG, EnvSetting, NetworkConfig, resolvePassphrase} from 'mmt-core/NetworkData';
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import * as mmtcore from 'mmt-core';

// Certificate YAML data stored in workspace (file paths only)
interface StoredCaCertificate {
  path?: string;
  paths?: string[];  // Legacy multiple CA cert paths
}

interface StoredClientCertificate {
  name: string;
  host: string;
  cert?: string;
  key?: string;
  pfx?: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

interface StoredCertificates {
  server_ca?: string | StoredCaCertificate;
  clients?: StoredClientCertificate[];
}

interface EnvVariableEntry {
  name: string;
  value: string|number|boolean;
}

interface ParsedEnvFile {
  envVars: Record<string, any>;
  certificates: StoredCertificates;
  setting?: EnvSetting;
}

interface ParsedEnvCacheEntry {
  hash: string;
  parsed?: ParsedEnvFile;
}

interface PreparedCertificateMaterial {
  ca: {
    enabled: boolean;
    certPath: string;
    certPaths?: string[];
    certData?: Buffer[];
  };
  clients: Array<{
    id: string;
    name: string;
    host: string;
    passphrase_plain?: string;
    certPath?: string;
    keyPath?: string;
    pfxPath?: string;
    certData?: Buffer;
    keyData?: Buffer;
    pfxData?: Buffer;
    enabled: boolean;
  }>;
}

interface CertificateMaterialCacheEntry {
  key: string;
  material: PreparedCertificateMaterial;
}

const VALID_HTTP_VERSIONS = new Set(['auto', '1', '1.1', '2']);
const parsedEnvCache = new Map<string, ParsedEnvCacheEntry>();
const certificateMaterialCache = new Map<string, CertificateMaterialCacheEntry>();

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
        key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const DATA_IMPORT_EXTENSIONS = ['.json', '.yaml', '.yml'];

function isLocalDataImportPath(pathValue: string): boolean {
  const lower = String(pathValue ?? '').trim().toLowerCase().split(/[?#]/, 1)[0];
  return DATA_IMPORT_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function localGetAccessorValue(value: any, accessor: string): any {
  if (!accessor) {
    return value;
  }
  const parts = accessor
      .replace(/\[(\d+)\]/g, '.$1')
      .replace(/^\./, '')
      .split('.')
      .filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current === null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function processEnvDataImportsFallback(rawText: string, filePath: string, projectRoot?: string): string {
  const doc = YAML.parse(rawText);
  if (!doc || typeof doc !== 'object') {
    return rawText;
  }
  const imports = (doc as any).import || {};
  const data: Record<string, any> = {};
  for (const [alias, requestedPath] of Object.entries(imports)) {
    if (typeof requestedPath !== 'string' || !isLocalDataImportPath(requestedPath)) {
      continue;
    }
    const resolvedPath = requestedPath.startsWith('+/') && projectRoot ?
      path.join(projectRoot, requestedPath.slice(2)) :
      path.resolve(path.dirname(filePath), requestedPath);
    const content = fs.readFileSync(resolvedPath, 'utf8');
    data[alias] = requestedPath.toLowerCase().endsWith('.json') ?
      JSON.parse(content) :
      YAML.parse(content);
  }
  if (Object.keys(data).length === 0) {
    return rawText;
  }
  const refRe = /\$\{\s*([A-Za-z_][A-Za-z0-9_-]*)((?:\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\])*)\s*\}/g;
  const wholeRefRe = /^\$\{\s*([A-Za-z_][A-Za-z0-9_-]*)((?:\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\])*)\s*\}$/;
  const replaceValue = (value: any): any => {
    if (typeof value === 'string') {
      const whole = wholeRefRe.exec(value);
      if (whole && Object.prototype.hasOwnProperty.call(data, whole[1])) {
        const resolved = localGetAccessorValue(data[whole[1]], whole[2] || '');
        return resolved !== undefined ? resolved : value;
      }
      return value.replace(refRe, (match, alias: string, accessor: string) => {
        if (!Object.prototype.hasOwnProperty.call(data, alias)) {
          return match;
        }
        const resolved = localGetAccessorValue(data[alias], accessor || '');
        if (resolved === undefined || resolved === null) {
          return '';
        }
        return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
      });
    }
    if (Array.isArray(value)) {
      return value.map(replaceValue);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceValue(nested)]));
    }
    return value;
  };
  const replaced = replaceValue(doc);
  delete replaced.import;
  return YAML.stringify(replaced);
}

function fileFingerprint(filePath: string): string {
  if (!filePath) {
    return '';
  }
  try {
    const stat = fs.statSync(filePath);
    return `${filePath}:${stat.size}:${stat.mtimeMs}`;
  } catch {
    return `${filePath}:missing`;
  }
}

function parseEnvSetting(raw: any): EnvSetting|undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const http: NonNullable<EnvSetting['http']> = {};
  const httpRaw = raw.http;
  if (httpRaw && typeof httpRaw === 'object' && !Array.isArray(httpRaw)) {
    if (typeof httpRaw.version === 'string' && VALID_HTTP_VERSIONS.has(httpRaw.version.trim())) {
      http.version = httpRaw.version.trim();
    }
    if (typeof httpRaw.timeout === 'number' &&
        Number.isFinite(httpRaw.timeout) &&
        httpRaw.timeout >= 0) {
      http.timeout = httpRaw.timeout;
    }
  }
  return Object.keys(http).length > 0 ? {http} : undefined;
}

function getHttpTimeout(setting: EnvSetting|undefined, fallback: number): number {
  const timeout = setting?.http?.timeout;
  return typeof timeout === 'number' && Number.isFinite(timeout) && timeout >= 0 ?
    timeout :
    fallback;
}

function getHttpVersion(setting: EnvSetting|undefined): string|undefined {
  const version = setting?.http?.version;
  return typeof version === 'string' && VALID_HTTP_VERSIONS.has(version.trim()) ?
    version.trim() :
    undefined;
}

function hasStoredCertificatePaths(certs?: StoredCertificates): boolean {
  return Boolean(
      certs &&
      ((certs.server_ca && getCaPath(certs.server_ca)) ||
       (certs.clients && certs.clients.length > 0)));
}

function createDefaultCertificateSettings(certs?: StoredCertificates): CertificateSettings {
  const settings: CertificateSettings = {
    ...DEFAULT_CERT_SETTINGS,
    clientsEnabled: {},
  };
  if (certs?.server_ca && getCaPath(certs.server_ca)) {
    settings.caEnabled = true;
  }
  for (const client of certs?.clients || []) {
    settings.clientsEnabled[clientKey(client)] = true;
  }
  return settings;
}

function parseCertificatesFromYaml(yaml: any): StoredCertificates {
  const certsObj = yaml && (yaml as any).certificates;
  if (!certsObj || typeof certsObj !== 'object') {
    return {};
  }

  const result: StoredCertificates = {};
  const caObj = (certsObj as any).server_ca;
  if (caObj) {
    if (Array.isArray(caObj)) {
      result.server_ca = {paths: caObj as any};
    } else if (typeof caObj === 'string') {
      result.server_ca = {path: caObj};
    } else if (typeof caObj.path === 'string') {
      result.server_ca = {path: caObj.path};
    } else if (caObj.paths && Array.isArray(caObj.paths)) {
      result.server_ca = {paths: caObj.paths};
    }
  }

  const clientsObj = (certsObj as any).clients;
  if (Array.isArray(clientsObj)) {
    result.clients = clientsObj.map((client: any) => ({
      name: client?.name || '',
      host: client?.host || '',
      cert: client?.cert || undefined,
      key: client?.key || undefined,
      pfx: client?.pfx || undefined,
      passphrase_plain: client?.passphrase_plain,
      passphrase_env: client?.passphrase_env,
    }));
  }

  return result;
}

export function resolveWorkspaceEnvFilePath(baseFilePath?: string): string|undefined {
  const config = vscode.workspace.getConfiguration('multimeter');
  const envRelPath = config.get<string>('workspaceEnvFile', '');

  const defaultEnvFiles = ['multimeter.mmt', 'env.mmt'];

  // Prefer the environment file nearest to the file being run. This lets
  // examples and nested projects carry their own multimeter.mmt/env.mmt instead
  // of accidentally inheriting the workspace root environment.
  if (baseFilePath) {
    const searchNames = envRelPath ?
      [envRelPath, ...defaultEnvFiles.filter(fileName => fileName !== envRelPath)] :
      defaultEnvFiles;
    let currentDir = path.dirname(baseFilePath);
    const visited = new Set<string>();
    while (currentDir && !visited.has(currentDir)) {
      visited.add(currentDir);
      for (const searchName of searchNames) {
        const candidate = path.join(currentDir, searchName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  // If config specifies a path, use it directly
  if (envRelPath) {
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const candidate = path.join(folder.uri.fsPath, envRelPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // No config set - search for default files in workspace roots
  for (const fileName of defaultEnvFiles) {
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const candidate = path.join(folder.uri.fsPath, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
function tryParseEnvFile(filePath: string): ParsedEnvFile|undefined {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return undefined;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = sha256(content);
    const hasDataImports = /^\s*import\s*:/m.test(content);
    const cached = parsedEnvCache.get(filePath);
    if (!hasDataImports && cached && cached.hash === hash) {
      return cached.parsed;
    }
    if (!content.includes('type: env')) {
      parsedEnvCache.set(filePath, {hash, parsed: undefined});
      return undefined;
    }
    const projectRoot = findProjectRootSync(filePath, fs.existsSync, path.dirname, path.join) ?? undefined;
    const processor = (mmtcore as any).dataImportProcessor;
    const processed = processor?.processDataImportsInYamlSync ?
      processor.processDataImportsInYamlSync({
        rawText: content,
        filePath,
        projectRoot,
        fileLoader: (p: string) => fs.readFileSync(p, 'utf8'),
      }) :
      processEnvDataImportsFallback(content, filePath, projectRoot);
    const yaml = YAML.parse(processed);
    if (!yaml || typeof yaml !== 'object') {
      parsedEnvCache.set(filePath, {hash, parsed: undefined});
      return undefined;
    }

    const envVars: Record<string, any> = {};
    const varsObj = (yaml as any).variables;
    if (varsObj && typeof varsObj === 'object' && !Array.isArray(varsObj)) {
      for (const [name, value] of Object.entries(varsObj)) {
        if (typeof name !== 'string' || !name) {
          continue;
        }
        // Use the first option for arrays & maps (consistent with current UI defaulting)
        if (Array.isArray(value)) {
          envVars[name] = (value as any[])[0];
        } else if (value && typeof value === 'object') {
          const entries = Object.entries(value as any);
          envVars[name] = entries.length ? entries[0][1] : '';
        } else {
          envVars[name] = value as any;
        }
      }
    }

    const certificates = parseCertificatesFromYaml(yaml);
    const setting = parseEnvSetting((yaml as any).setting);
    const parsed = {envVars, certificates, setting};
    parsedEnvCache.set(filePath, {hash, parsed});
    return parsed;
  } catch {
    return undefined;
  }
}

function resolveCertPath(certPath: string, baseFilePath?: string): string {
  if (!certPath) {
    return '';
  }
  const projectRoot = baseFilePath
    ? findProjectRootSync(baseFilePath, fs.existsSync, path.dirname, path.join)
    : null;
  if (projectRoot) {
    return resolveCertFilePath(certPath, {baseFilePath, projectRoot});
  }
  if (baseFilePath) {
    return resolveCertFilePath(certPath, {baseFilePath});
  }
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (ws) {
    return resolveCertFilePath(certPath, {baseDir: ws.uri.fsPath});
  }
  return resolveCertFilePath(certPath);
}

function getCaPath(ca?: string | StoredCaCertificate): string {
  if (!ca) {
    return '';
  }
  if (typeof ca === 'string') {
    return ca;
  }
  if (typeof ca.path === 'string' && ca.path) {
    return ca.path;
  }
  return ca.paths?.find(pathValue => !!pathValue) || '';
}

// Generate key for client certificate enable/disable
function clientKey(client: StoredClientCertificate): string {
  return `${client.name || ''}:${client.host || ''}`;
}

function cloneCertificateMaterial(
    material: PreparedCertificateMaterial): PreparedCertificateMaterial {
  return {
    ca: {
      ...material.ca,
      certData: material.ca.certData ? [...material.ca.certData] : undefined,
      certPaths: material.ca.certPaths ? [...material.ca.certPaths] : undefined,
    },
    clients: material.clients.map(client => ({...client})),
  };
}

function prepareCertificateMaterial(
    storedCerts: StoredCertificates,
    certSettings: CertificateSettings,
    envVars: Record<string, any>,
    resolvePath: (certPath: string) => string): PreparedCertificateMaterial {
  const ca = storedCerts.server_ca || {};
  const caPath = getCaPath(ca);
  const resolvedCaPath = caPath ? resolvePath(caPath) : caPath;
  const caEnabled = !!certSettings.caEnabled && !!caPath;

  const clientDescriptors = (storedCerts.clients || []).map((client, idx) => {
    const key = clientKey(client);
    const enabled = certSettings.clientsEnabled[key] !== false;
    const passphrase = resolvePassphrase(
        client.passphrase_plain, client.passphrase_env, envVars, process.env);
    const certPath = enabled && client.cert ? resolvePath(client.cert) : undefined;
    const keyPath = enabled && client.key ? resolvePath(client.key) : undefined;
    const pfxPath = enabled && client.pfx ? resolvePath(client.pfx) : undefined;
    return {
      idx,
      id: `client-${idx}`,
      name: client.name,
      host: client.host,
      enabled,
      passphrase,
      certPath,
      keyPath,
      pfxPath,
      certFingerprint: certPath ? fileFingerprint(certPath) : '',
      keyFingerprint: keyPath ? fileFingerprint(keyPath) : '',
      pfxFingerprint: pfxPath ? fileFingerprint(pfxPath) : '',
    };
  });

  const cacheKey = sha256(stableStringify({
    ca: {
      enabled: caEnabled,
      path: resolvedCaPath,
      fingerprint: caEnabled ? fileFingerprint(resolvedCaPath) : '',
    },
    clients: clientDescriptors,
  }));
  const cached = certificateMaterialCache.get(cacheKey);
  if (cached) {
    return cloneCertificateMaterial(cached.material);
  }

  let caCertData: Buffer|undefined = undefined;
  if (caEnabled && resolvedCaPath) {
    try {
      caCertData = fs.readFileSync(resolvedCaPath);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load CA certificate from ${caPath}: ${e}`);
    }
  }

  const clients = clientDescriptors.map(descriptor => {
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    let pfxData: Buffer|undefined = undefined;
    if (descriptor.enabled) {
      if (descriptor.pfxPath) {
        try {
          pfxData = fs.readFileSync(descriptor.pfxPath);
        } catch (e) {
          vscode.window.showErrorMessage(
              `Failed to load PFX for ${descriptor.host}: ${e}`);
        }
      } else if (descriptor.certPath && descriptor.keyPath) {
        try {
          certData = fs.readFileSync(descriptor.certPath);
          keyData = fs.readFileSync(descriptor.keyPath);
        } catch (e) {
          vscode.window.showErrorMessage(
              `Failed to load client certificate for ${descriptor.host}: ${e}`);
        }
      }
    }
    return {
      id: descriptor.id,
      name: descriptor.name,
      host: descriptor.host,
      passphrase_plain: descriptor.passphrase,
      certPath: descriptor.certPath,
      keyPath: descriptor.keyPath,
      pfxPath: descriptor.pfxPath,
      certData,
      keyData,
      pfxData,
      enabled: descriptor.enabled,
    };
  });

  const material: PreparedCertificateMaterial = {
    ca: {
      enabled: caEnabled,
      certPath: resolvedCaPath,
      certPaths: resolvedCaPath ? [resolvedCaPath] : undefined,
      certData: caCertData ? [caCertData] : undefined,
    },
    clients,
  };
  certificateMaterialCache.set(cacheKey, {key: cacheKey, material});
  return cloneCertificateMaterial(material);
}

// Prepare config with loaded cert/key data from workspace storage
export function getPreparedConfigFromStorage(
    context: vscode.ExtensionContext,
  envVars?: Record<string, any>,
  baseFilePath?: string): NetworkConfig {
  const envFileAbsPath = resolveWorkspaceEnvFilePath(baseFilePath);
  const parsed = envFileAbsPath ? tryParseEnvFile(envFileAbsPath) : undefined;
  const mergedEnvVars = {
    ...(parsed?.envVars || {}),
    ...(envVars || {}),
  };
  const parsedCerts = parsed?.certificates;
  const hasParsedCerts = hasStoredCertificatePaths(parsedCerts);
  const storedCerts: StoredCertificates =
    hasParsedCerts
      ? parsedCerts as StoredCertificates
      : context.workspaceState.get('multimeter.certificates.storage', {});
  const certBaseFilePath = hasParsedCerts && envFileAbsPath ? envFileAbsPath : baseFilePath;
    const storedCertSettings = context.workspaceState.get<CertificateSettings | undefined>(
      'multimeter.certificates.settings');
    const certSettings: CertificateSettings = storedCertSettings ||
      createDefaultCertificateSettings(storedCerts);
  const config = vscode.workspace.getConfiguration('multimeter');
  const fallbackTimeout = DEFAULT_NETWORK_CONFIG.timeout;
  const material = prepareCertificateMaterial(
      storedCerts,
      certSettings,
      mergedEnvVars,
      certPath => resolveCertPath(certPath, certBaseFilePath));

  return {
    ca: material.ca,
    clients: material.clients,
    sslValidation: true,
    allowSelfSigned: false,
    httpVersion: getHttpVersion(parsed?.setting),
    timeout: getHttpTimeout(parsed?.setting, fallbackTimeout),
    autoFormat: config.get('body.auto.format', false)
  };
}

/**
 * Parse env data (variables + certificates) from a project env file.
 * Returns the parsed data for immediate use without storing to workspaceState.
 */
export function parseEnvFileForRun(projectFilePath: string): ParsedEnvFile|undefined {
  return tryParseEnvFile(projectFilePath);
}

/**
 * Prepare a NetworkConfig purely from the given project env file,
 * without relying on VS Code workspaceState for certificate paths.
 *
 * This is intended for glyph runs so they always follow the current project file.
 * @param projectFilePath Absolute path to the project env file (e.g. multimeter.mmt)
 * @param overrideEnvVars Optional env vars to merge on top of the file's variables
 */
export function prepareNetworkConfigFromProjectFile(
    projectFilePath: string,
    overrideEnvVars?: Record<string, any>,
): NetworkConfig {
  const parsed = tryParseEnvFile(projectFilePath);
  const envVars = {
    ...(parsed?.envVars || {}),
    ...(overrideEnvVars || {}),
  };

  const config = vscode.workspace.getConfiguration('multimeter');
  const fallbackTimeout = DEFAULT_NETWORK_CONFIG.timeout;
  const storedCerts: StoredCertificates = parsed?.certificates || {};

  const projectDir = path.dirname(projectFilePath);
  const certPathOpts = {baseDir: projectDir};
  const material = prepareCertificateMaterial(
      storedCerts,
      createDefaultCertificateSettings(storedCerts),
      envVars,
      certPath => resolveCertFilePath(certPath, certPathOpts));

  return {
    ca: material.ca,
    clients: material.clients,
    sslValidation: true,
    allowSelfSigned: false,
    httpVersion: getHttpVersion(parsed?.setting),
    timeout: getHttpTimeout(parsed?.setting, fallbackTimeout),
    autoFormat: config.get('body.auto.format', false)
  };
}

/**
 * Find and prepare a NetworkConfig by locating the project file from the running document.
 * This searches upward from the document path for a file matching `multimeter.workspaceEnvFile` setting.
 */
export function prepareNetworkConfigForFile(
    baseFilePath: string,
    overrideEnvVars?: Record<string, any>,
    context?: vscode.ExtensionContext,
): NetworkConfig {
  if (context) {
    return getPreparedConfigFromStorage(context, overrideEnvVars, baseFilePath);
  }
  const projectFilePath = resolveWorkspaceEnvFilePath(baseFilePath);
  if (projectFilePath) {
    return prepareNetworkConfigFromProjectFile(projectFilePath, overrideEnvVars);
  }
  // No project file found, return defaults
  const config = vscode.workspace.getConfiguration('multimeter');
  return {
    ca: {enabled: false},
    clients: [],
    sslValidation: true,
    allowSelfSigned: false,
    httpVersion: undefined,
    timeout: DEFAULT_NETWORK_CONFIG.timeout,
    autoFormat: config.get('body.auto.format', false)
  };
}

// Legacy function for backward compatibility - now uses storage
export function getPreparedConfig(): NetworkConfig {
  // This is a fallback that returns default config
  // The main code paths should use getPreparedConfigFromStorage
  const config = vscode.workspace.getConfiguration('multimeter');
  return {
    ca: {enabled: false},
    clients: [],
    sslValidation: true,
    allowSelfSigned: false,
    httpVersion: undefined,
    timeout: DEFAULT_NETWORK_CONFIG.timeout,
    autoFormat: config.get('body.auto.format', false)
  };
}

// The VS Code-specific handler
export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel,
    context?: vscode.ExtensionContext, envVars?: Record<string, any>,
    documentPath?: string) {
  const getConfig = () => context ?
    getPreparedConfigFromStorage(context, envVars, documentPath) :
    getPreparedConfig();
  const config = getConfig();

  const postMessage: PostMessage = (msg: any) =>
      webviewPanel.webview.postMessage(msg);

  // Create fileLoader for gRPC proto loading
  const baseDir = documentPath ? path.dirname(documentPath) :
    (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
  const fileLoader = async (relPath: string): Promise<string> => {
    const absPath = path.isAbsolute(relPath) ? relPath : path.resolve(baseDir, relPath);
    return fs.readFileSync(absPath, 'utf8');
  };

  // Call the core handler with prepared config and postMessage
  coreHandleNetworkMessage(message, config, postMessage, { fileLoader, basePath: baseDir, getConfig });
}
