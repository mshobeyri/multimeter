import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';

interface EnvOption {
  label: string;
  value: string | number | boolean;
}

interface EnvVariable {
  name: string;
  label: string;
  value: string | number | boolean;
  options: EnvOption[];
}

interface EnvCaCertificate {
  paths: string[];
}

interface EnvClientCertificate {
  name: string;
  host: string;
  cert_path: string;
  key_path: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

interface EnvCertificates {
  ca?: EnvCaCertificate;
  clients?: EnvClientCertificate[];
}

interface CertificateSettings {
  sslValidation: boolean;
  allowSelfSigned: boolean;
  caEnabled: boolean;
  clientsEnabled: Record<string, boolean>;
}

const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  sslValidation: true,
  allowSelfSigned: false,
  caEnabled: false,
  clientsEnabled: {},
};

/**
 * Load the workspace environment file (multimeter.mmt by default)
 * and apply its variables, presets, and certificates to workspace state.
 * Only sets values that don't already exist in workspace state (preserves user modifications).
 * @param context VS Code extension context
 * @param force If true, overwrites existing values (used for manual reload)
 */
export async function loadWorkspaceEnvFile(
    context: vscode.ExtensionContext,
    force: boolean = false
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const config = vscode.workspace.getConfiguration('multimeter');
  const envFilePath = config.get<string>('workspaceEnvFile', 'multimeter.mmt');

  // Try each workspace folder
  for (const folder of workspaceFolders) {
    const fullPath = path.join(folder.uri.fsPath, envFilePath);
    const fileUri = vscode.Uri.file(fullPath);

    try {
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileContent).toString('utf8');

      // Verify it's an env file
      if (!content.includes('type: env')) {
        continue;
      }

      const yaml = parseYaml(content);
      if (!yaml) {
        continue;
      }

      // Check if environment storage already has values
      const existingEnvStorage = context.workspaceState.get<EnvVariable[]>('multimeter.environment.storage');
      const hasExistingEnv = Array.isArray(existingEnvStorage) && existingEnvStorage.length > 0;

      // Only set variables if no existing values (or force is true)
      if (force || !hasExistingEnv) {
        const envVariables = parseEnvVariables(yaml.variables);
        if (envVariables.length > 0) {
          await context.workspaceState.update('multimeter.environment.storage', envVariables);
        }
      }

      // Check if presets already exist
      const existingPresets = context.workspaceState.get<Record<string, any>>('multimeter.environment.presets');
      const hasExistingPresets = existingPresets && typeof existingPresets === 'object' && Object.keys(existingPresets).length > 0;

      // Only set presets if no existing values (or force is true)
      if ((force || !hasExistingPresets) && yaml.presets && typeof yaml.presets === 'object') {
        await context.workspaceState.update('multimeter.environment.presets', yaml.presets);
      }

      // Check if certificates already exist
      const existingCerts = context.workspaceState.get<EnvCertificates>('multimeter.certificates.storage');
      const hasExistingCerts = existingCerts && typeof existingCerts === 'object' && 
        (existingCerts.ca || (existingCerts.clients && existingCerts.clients.length > 0));

      // Only set certificates if no existing values (or force is true)
      if ((force || !hasExistingCerts) && yaml.certificates && typeof yaml.certificates === 'object') {
        const certs = parseCertificates(yaml.certificates);
        await context.workspaceState.update('multimeter.certificates.storage', certs);

        // Check if certificate settings already exist
        const existingCertSettings = context.workspaceState.get<CertificateSettings>('multimeter.certificates.settings');
        const hasExistingCertSettings = existingCertSettings && typeof existingCertSettings === 'object';

        // Only initialize certificate settings if no existing values (or force is true)
        if (force || !hasExistingCertSettings) {
          const certSettings = initCertificateSettings(certs);
          await context.workspaceState.update('multimeter.certificates.settings', certSettings);
        }
      }

      // Show message only when force reload is used
      if (force) {
        vscode.window.showInformationMessage(
          `Reloaded workspace environment from ${envFilePath}`
        );
      }

      // Successfully processed from this folder
      return;
    } catch (error) {
      // File doesn't exist or can't be read - continue to next folder
      continue;
    }
  }
}

function parseYaml(yamlString: string): any {
  try {
    return YAML.parse(yamlString);
  } catch (e) {
    return null;
  }
}

function parseEnvVariables(variablesObj: Record<string, any> | undefined): EnvVariable[] {
  if (!variablesObj || typeof variablesObj !== 'object') {
    return [];
  }

  const envVariables: EnvVariable[] = [];

  for (const [name, value] of Object.entries(variablesObj)) {
    if (Array.isArray(value)) {
      // List of allowed values
      const options: EnvOption[] = value.map((v) => ({
        label: String(v),
        value: v
      }));
      const firstOption = options[0];
      envVariables.push({
        name,
        label: firstOption?.label ?? name,
        value: firstOption?.value ?? '',
        options
      });
    } else if (typeof value === 'object' && value !== null) {
      // Object map (named choices)
      const options: EnvOption[] = Object.entries(value).map(([label, val]) => ({
        label,
        value: val as string | number | boolean
      }));
      const firstOption = options[0];
      envVariables.push({
        name,
        label: firstOption?.label ?? name,
        value: firstOption?.value ?? '',
        options
      });
    } else {
      // Scalar value
      envVariables.push({
        name,
        label: name,
        value: value as string | number | boolean,
        options: [{label: String(value), value: value as string | number | boolean}]
      });
    }
  }

  return envVariables;
}

function parseCertificates(certsObj: any): EnvCertificates {
  const result: EnvCertificates = {};

  if (certsObj.ca) {
    if (Array.isArray(certsObj.ca)) {
      result.ca = {paths: certsObj.ca};
    } else if (certsObj.ca.paths && Array.isArray(certsObj.ca.paths)) {
      result.ca = {paths: certsObj.ca.paths};
    } else if (typeof certsObj.ca === 'string') {
      result.ca = {paths: [certsObj.ca]};
    }
  }

  if (certsObj.clients && Array.isArray(certsObj.clients)) {
    result.clients = certsObj.clients.map((client: any) => ({
      name: client.name || '',
      host: client.host || '',
      cert_path: client.cert_path || '',
      key_path: client.key_path || '',
      passphrase_plain: client.passphrase_plain,
      passphrase_env: client.passphrase_env
    }));
  }

  return result;
}

function initCertificateSettings(certs: EnvCertificates): CertificateSettings {
  const settings: CertificateSettings = {...DEFAULT_CERT_SETTINGS};

  // Enable CA if paths are defined
  if (certs.ca && certs.ca.paths && certs.ca.paths.length > 0) {
    settings.caEnabled = true;
  }

  // Enable each client certificate by default
  if (certs.clients && Array.isArray(certs.clients)) {
    for (const client of certs.clients) {
      const key = `${client.name}:${client.host}`;
      settings.clientsEnabled[key] = true;
    }
  }

  return settings;
}
