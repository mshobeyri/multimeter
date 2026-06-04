import * as fs from 'fs';
import * as path from 'path';
import {findProjectRootSync, resolveCertFilePath} from 'mmt-core/fileHelper';
import {handleNetworkMessage as coreHandleNetworkMessage, NetworkMessage, PostMessage} from 'mmt-core/network';
import {CertificateSettings, DEFAULT_CERT_SETTINGS, DEFAULT_NETWORK_CONFIG, EnvSetting, NetworkConfig, resolvePassphrase} from 'mmt-core/NetworkData';
import * as vscode from 'vscode';
import * as YAML from 'yaml';

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

const VALID_HTTP_VERSIONS = new Set(['auto', '1', '1.1', '2']);

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

function tryParseEnvCertificatesFromFile(filePath: string): StoredCertificates|undefined {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return undefined;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('type: env')) {
      return undefined;
    }
    const yaml = YAML.parse(content);
    const certsObj = yaml && (yaml as any).certificates;
    if (!certsObj || typeof certsObj !== 'object') {
      return undefined;
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
  } catch {
    return undefined;
  }
}

export function resolveWorkspaceEnvFilePath(baseFilePath?: string): string|undefined {
  const config = vscode.workspace.getConfiguration('multimeter');
  const envRelPath = config.get<string>('workspaceEnvFile', '');

  const defaultEnvFiles = ['multimeter.mmt', 'env.mmt'];

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

  // If baseFilePath provided, walk up directory tree looking for the env file
  if (baseFilePath) {
    const searchNames = envRelPath ? [envRelPath] : defaultEnvFiles;
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

  return undefined;
}
function tryParseEnvFile(filePath: string): ParsedEnvFile|undefined {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return undefined;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('type: env')) {
      return undefined;
    }
    const yaml = YAML.parse(content);
    if (!yaml || typeof yaml !== 'object') {
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

    const certificates = tryParseEnvCertificatesFromFile(filePath) || {};
    const setting = parseEnvSetting((yaml as any).setting);
    return {envVars, certificates, setting};
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

  // Load CA cert data
  let caCertData: Buffer|undefined = undefined;
  const ca = storedCerts.server_ca || {};
  const caPath = getCaPath(ca);
  let resolvedCaPath = caPath;
  if (certSettings.caEnabled && caPath) {
    try {
      const resolvedPath = resolveCertPath(caPath, certBaseFilePath);
      resolvedCaPath = resolvedPath;
      caCertData = fs.readFileSync(resolvedPath);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load CA certificate from ${caPath}: ${e}`);
    }
  }

  // Load client cert/key data
  const clients = storedCerts.clients || [];
  const clientsWithData = clients.map((client, idx) => {
    const key = clientKey(client);
    const isEnabled = certSettings.clientsEnabled[key] !== false;  // Default true
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    let pfxData: Buffer|undefined = undefined;
    let certPath: string|undefined = undefined;
    let keyPath: string|undefined = undefined;
    let pfxPath: string|undefined = undefined;
    const crtSrc = client.cert || '';
    const keySrc = client.key || '';
    const pfxSrc = client.pfx || '';
    if (isEnabled) {
      if (pfxSrc) {
        try {
          pfxPath = resolveCertPath(pfxSrc, certBaseFilePath);
          pfxData = fs.readFileSync(pfxPath);
        } catch (e) {
          vscode.window.showErrorMessage(
              `Failed to load PFX for ${client.host}: ${e}`);
        }
      } else if (crtSrc && keySrc) {
        try {
          certPath = resolveCertPath(crtSrc, certBaseFilePath);
          keyPath = resolveCertPath(keySrc, certBaseFilePath);
          certData = fs.readFileSync(certPath);
          keyData = fs.readFileSync(keyPath);
        } catch (e) {
          vscode.window.showErrorMessage(
              `Failed to load client certificate for ${client.host}: ${e}`);
        }
      }
    }
    const passphrase = resolvePassphrase(
      client.passphrase_plain, client.passphrase_env, mergedEnvVars, process.env);
    return {
      id: `client-${idx}`,
      name: client.name,
      host: client.host,
      passphrase_plain: passphrase,
      certPath,
      keyPath,
      pfxPath,
      certData,
      keyData,
      pfxData,
      enabled: isEnabled,
    };
  });

  return {
    ca: {enabled: certSettings.caEnabled, certPath: resolvedCaPath, certPaths: resolvedCaPath ? [resolvedCaPath] : undefined, certData: caCertData ? [caCertData] : undefined},
    clients: clientsWithData,
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

  let caCertData: Buffer|undefined = undefined;
  const ca = storedCerts.server_ca || {};
  const caPath = getCaPath(ca);
  let resolvedCaPath = caPath;
  // Always load the CA cert if present (no toggle needed for file-driven runs)
  if (caPath) {
    try {
      const resolvedPath = resolveCertFilePath(caPath, certPathOpts);
      resolvedCaPath = resolvedPath;
      caCertData = fs.readFileSync(resolvedPath);
    } catch {
    }
  }

  const clients = storedCerts.clients || [];
  const clientsWithData = clients.map((client, idx) => {
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    let pfxData: Buffer|undefined = undefined;
    let certPath: string|undefined = undefined;
    let keyPath: string|undefined = undefined;
    let pfxPath: string|undefined = undefined;
    const crtSrc = client.cert || '';
    const keySrc = client.key || '';
    const pfxSrc = client.pfx || '';
    if (pfxSrc) {
      try {
        pfxPath = resolveCertFilePath(pfxSrc, certPathOpts);
        pfxData = fs.readFileSync(pfxPath);
      } catch {
      }
    } else if (crtSrc && keySrc) {
      try {
        certPath = resolveCertFilePath(crtSrc, certPathOpts);
        keyPath = resolveCertFilePath(keySrc, certPathOpts);
        certData = fs.readFileSync(certPath);
        keyData = fs.readFileSync(keyPath);
      } catch {
      }
    }
    const passphrase = resolvePassphrase(
        client.passphrase_plain, client.passphrase_env, envVars, process.env);
    return {
      id: `client-${idx}`,
      name: client.name,
      host: client.host,
      passphrase_plain: passphrase,
      certPath,
      keyPath,
      pfxPath,
      certData,
      keyData,
      pfxData,
      enabled: true,
    };
  });

  return {
    ca: {enabled: !!caCertData, certPath: resolvedCaPath, certPaths: resolvedCaPath ? [resolvedCaPath] : undefined, certData: caCertData ? [caCertData] : undefined},
    clients: clientsWithData,
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
