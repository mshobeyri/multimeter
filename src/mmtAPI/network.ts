import * as fs from 'fs';
import * as path from 'path';
import {handleNetworkMessage as coreHandleNetworkMessage, NetworkMessage, PostMessage} from 'mmt-core/network';
import {NetworkConfig} from 'mmt-core/NetworkData';
import * as vscode from 'vscode';
import * as YAML from 'yaml';

// Certificate YAML data stored in workspace (file paths only)
interface StoredCaCertificate {
  paths: string[];  // Multiple CA cert paths
}

interface StoredClientCertificate {
  name: string;
  host: string;
  cert_path: string;
  key_path: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

interface StoredCertificates {
  ca?: StoredCaCertificate;
  clients?: StoredClientCertificate[];
}

interface EnvVariableEntry {
  name: string;
  value: string|number|boolean;
}

interface ParsedEnvFile {
  envVars: Record<string, any>;
  certificates: StoredCertificates;
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
    const caObj = (certsObj as any).ca;
    if (caObj) {
      if (Array.isArray(caObj)) {
        result.ca = {paths: caObj as any};
      } else if (typeof caObj === 'string') {
        result.ca = {paths: [caObj]};
      } else if (caObj.paths && Array.isArray(caObj.paths)) {
        result.ca = {paths: caObj.paths};
      }
    }

    const clientsObj = (certsObj as any).clients;
    if (Array.isArray(clientsObj)) {
      result.clients = clientsObj.map((client: any) => ({
        name: client?.name || '',
        host: client?.host || '',
        cert_path: client?.cert_path || '',
        key_path: client?.key_path || '',
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
  const envRelPath = config.get<string>('workspaceEnvFile', 'multimeter.mmt');
  if (!envRelPath) {
    return undefined;
  }

  // If no base file is provided, try workspace root(s) first.
  if (!baseFilePath) {
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const candidate = path.join(folder.uri.fsPath, envRelPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // Use project root of the current document when possible.
  const baseDir = baseFilePath ? path.dirname(baseFilePath) : undefined;
  if (baseDir) {
    let currentDir = baseDir;
    const visited = new Set<string>();
    while (currentDir && !visited.has(currentDir)) {
      visited.add(currentDir);
      const candidate = path.join(currentDir, envRelPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  // Fallback: workspace folder(s)
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const candidate = path.join(folder.uri.fsPath, envRelPath);
    if (fs.existsSync(candidate)) {
      return candidate;
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
    return {envVars, certificates};
  } catch {
    return undefined;
  }
}

// Certificate boolean settings stored separately
interface CertificateSettings {
  sslValidation: boolean;
  allowSelfSigned: boolean;
  caEnabled: boolean;
  clientsEnabled: Record<string, boolean>;  // keyed by "name:host"
}

const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  sslValidation: true,
  allowSelfSigned: false,
  caEnabled: false,
  clientsEnabled: {},
};

// Resolve certificate paths against the current document's project root
function resolveCertPath(certPath: string, baseFilePath?: string): string {
  if (!certPath) {
    return '';
  }
  if (path.isAbsolute(certPath)) {
    return certPath;
  }
  const baseDir = baseFilePath ? path.dirname(baseFilePath) : undefined;
  if (baseDir) {
    // Walk up from the current document to find multimeter.mmt and treat that
    // folder as the project root (mirrors +/ import behavior).
    let currentDir = baseDir;
    const visited = new Set<string>();
    while (currentDir && !visited.has(currentDir)) {
      visited.add(currentDir);
      const markerPath = path.join(currentDir, 'multimeter.mmt');
      if (fs.existsSync(markerPath)) {
        return path.resolve(currentDir, certPath);
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    // Fallback: relative to document folder
    return path.resolve(baseDir, certPath);
  }

  // Last resort: relative to first workspace folder
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (ws) {
    return path.resolve(ws.uri.fsPath, certPath);
  }
  return certPath;
}

// Resolve passphrase from plain text or environment variable
function resolvePassphrase(
    passphrasePlain?: string, passphraseEnv?: string,
    envVars?: Record<string, any>): string|undefined {
  if (passphrasePlain) {
    return passphrasePlain;
  }
  if (passphraseEnv) {
    // First check passed envVars, then process.env
    if (envVars && passphraseEnv in envVars) {
      return String(envVars[passphraseEnv]);
    }
    if (process.env[passphraseEnv]) {
      return process.env[passphraseEnv];
    }
  }
  return undefined;
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
  const storedCerts: StoredCertificates =
    (parsed?.certificates &&
     ((parsed.certificates.ca && parsed.certificates.ca.paths && parsed.certificates.ca.paths.length) ||
      (parsed.certificates.clients && parsed.certificates.clients.length)))
      ? parsed.certificates
      : context.workspaceState.get('multimeter.certificates.storage', {});
  const certSettings: CertificateSettings =
      context.workspaceState.get('multimeter.certificates.settings', DEFAULT_CERT_SETTINGS);
  const config = vscode.workspace.getConfiguration('multimeter');

  // Load CA cert data (multiple paths)
  const caCertDataList: Buffer[] = [];
  const ca = storedCerts.ca || {paths: []};
  const caPaths = ca.paths || [];
  if (certSettings.caEnabled && caPaths.length > 0) {
    for (const caPath of caPaths) {
      if (caPath) {
        try {
          const resolvedPath = resolveCertPath(caPath, baseFilePath);
          caCertDataList.push(fs.readFileSync(resolvedPath));
        } catch (e) {
          vscode.window.showErrorMessage(`Failed to load CA certificate from ${caPath}: ${e}`);
        }
      }
    }
  }

  // Load client cert/key data
  const clients = storedCerts.clients || [];
  const clientsWithData = clients.map((client, idx) => {
    const key = clientKey(client);
    const isEnabled = certSettings.clientsEnabled[key] !== false;  // Default true
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    if (isEnabled && client.cert_path && client.key_path) {
      try {
        const certResolvedPath = resolveCertPath(client.cert_path, baseFilePath);
        const keyResolvedPath = resolveCertPath(client.key_path, baseFilePath);
        certData = fs.readFileSync(certResolvedPath);
        keyData = fs.readFileSync(keyResolvedPath);
      } catch (e) {
        vscode.window.showErrorMessage(
            `Failed to load client certificate for ${client.host}: ${e}`);
      }
    }
    const passphrase = resolvePassphrase(
      client.passphrase_plain, client.passphrase_env, mergedEnvVars);
    return {
      id: `client-${idx}`,
      name: client.name,
      host: client.host,
      cert_path: client.cert_path,
      key_path: client.key_path,
      passphrase_plain: passphrase,
      certData,
      keyData,
      enabled: isEnabled,
    };
  });

  return {
    ca: {enabled: certSettings.caEnabled, certPaths: caPaths, certData: caCertDataList.length > 0 ? caCertDataList : undefined},
    clients: clientsWithData,
    sslValidation: certSettings.sslValidation,
    allowSelfSigned: certSettings.allowSelfSigned,
    timeout: config.get('network.timeout', 30000),
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
  const storedCerts: StoredCertificates = parsed?.certificates || {};

  // Resolve cert paths relative to the project file's directory
  const projectDir = path.dirname(projectFilePath);

  const caCertDataList: Buffer[] = [];
  const ca = storedCerts.ca || {paths: []};
  const caPaths = ca.paths || [];
  // Always load CA certs if present (no toggle needed for file-driven runs)
  for (const caPath of caPaths) {
    if (caPath) {
      try {
        const resolvedPath = path.isAbsolute(caPath) ? caPath : path.resolve(projectDir, caPath);
        caCertDataList.push(fs.readFileSync(resolvedPath));
      } catch {
      }
    }
  }

  const clients = storedCerts.clients || [];
  const clientsWithData = clients.map((client, idx) => {
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    if (client.cert_path && client.key_path) {
      try {
        const certResolvedPath = path.isAbsolute(client.cert_path) ? client.cert_path : path.resolve(projectDir, client.cert_path);
        const keyResolvedPath = path.isAbsolute(client.key_path) ? client.key_path : path.resolve(projectDir, client.key_path);
        certData = fs.readFileSync(certResolvedPath);
        keyData = fs.readFileSync(keyResolvedPath);
      } catch {
      }
    }
    const passphrase = resolvePassphrase(
        client.passphrase_plain, client.passphrase_env, envVars);
    return {
      id: `client-${idx}`,
      name: client.name,
      host: client.host,
      cert_path: client.cert_path,
      key_path: client.key_path,
      passphrase_plain: passphrase,
      certData,
      keyData,
      enabled: true,
    };
  });

  return {
    ca: {enabled: caCertDataList.length > 0, certPaths: caPaths, certData: caCertDataList.length > 0 ? caCertDataList : undefined},
    clients: clientsWithData,
    sslValidation: true,
    allowSelfSigned: false,
    timeout: config.get('network.timeout', 30000),
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
): NetworkConfig {
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
    timeout: config.get('network.timeout', 30000),
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
    timeout: config.get('network.timeout', 30000),
    autoFormat: config.get('body.auto.format', false)
  };
}

// The VS Code-specific handler
export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel,
    context?: vscode.ExtensionContext, envVars?: Record<string, any>) {
  const baseFilePath = vscode.window.activeTextEditor?.document?.uri?.fsPath;
  const config = context ?
    getPreparedConfigFromStorage(context, envVars, baseFilePath) :
    getPreparedConfig();
  const postMessage: PostMessage = (msg: any) =>
      webviewPanel.webview.postMessage(msg);

  // Call the core handler with prepared config and postMessage
  coreHandleNetworkMessage(message, config, postMessage);
}