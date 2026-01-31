import * as fs from 'fs';
import * as path from 'path';
import {handleNetworkMessage as coreHandleNetworkMessage, NetworkMessage, PostMessage} from 'mmt-core/network';
import {NetworkConfig} from 'mmt-core/NetworkData';
import * as vscode from 'vscode';

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

// Resolve relative paths against workspace root
function resolveCertPath(certPath: string): string {
  if (!certPath) {
    return '';
  }
  if (path.isAbsolute(certPath)) {
    return certPath;
  }
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
    envVars?: Record<string, any>): NetworkConfig {
  const storedCerts: StoredCertificates =
      context.workspaceState.get('multimeter.certificates.storage', {});
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
          const resolvedPath = resolveCertPath(caPath);
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
        const certResolvedPath = resolveCertPath(client.cert_path);
        const keyResolvedPath = resolveCertPath(client.key_path);
        certData = fs.readFileSync(certResolvedPath);
        keyData = fs.readFileSync(keyResolvedPath);
      } catch (e) {
        vscode.window.showErrorMessage(
            `Failed to load client certificate for ${client.host}: ${e}`);
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
  const config = context ?
      getPreparedConfigFromStorage(context, envVars) :
      getPreparedConfig();
  const postMessage: PostMessage = (msg: any) =>
      webviewPanel.webview.postMessage(msg);

  // Call the core handler with prepared config and postMessage
  coreHandleNetworkMessage(message, config, postMessage);
}