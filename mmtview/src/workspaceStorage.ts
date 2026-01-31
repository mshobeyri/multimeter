// Save variables to VSCode workspace state

import {EnvVariable, EnvCertificates, CertificateSettings} from './environment/EnvironmentData';

export function saveEnvVariablesFromObject(flatVars: EnvVariable[]) {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.environment.storage',
    value: flatVars,
  });
}

export function saveEnvPresets(presets: Record<string, any>) {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.environment.presets',
    value: presets,
  });
}

export function clearEnvPresets() {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.environment.presets',
    value: {},
  });
}

// Load variables from VSCode workspace state
export function loadEnvVariables(
    callback: (variables: EnvVariable[]) => void) {
  function handler(event: MessageEvent) {
    const message = event.data;
    if (message.command === 'loadWorkspaceState' &&
        message.name === 'multimeter.environment.storage') {
      callback(message.value || []);
    }
  }
  window.addEventListener('message', handler);
  window.vscode?.postMessage(
      {command: 'loadWorkspaceState', name: 'multimeter.environment.storage'});
  // Return a cleanup function
  return () => window.removeEventListener('message', handler);
}

// Certificate YAML data storage (file paths only, no booleans)
export function saveCertificatesFromObject(certs: EnvCertificates) {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.certificates.storage',
    value: certs,
  });
}

export function loadCertificates(
    callback: (certificates: EnvCertificates | null) => void) {
  function handler(event: MessageEvent) {
    const message = event.data;
    if (message.command === 'loadWorkspaceState' &&
        message.name === 'multimeter.certificates.storage') {
      callback(message.value || null);
    }
  }
  window.addEventListener('message', handler);
  window.vscode?.postMessage(
      {command: 'loadWorkspaceState', name: 'multimeter.certificates.storage'});
  // Return a cleanup function
  return () => window.removeEventListener('message', handler);
}

export function clearCertificates() {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.certificates.storage',
    value: null,
  });
}

// Certificate boolean settings storage (separate from YAML)
const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  sslValidation: true,
  allowSelfSigned: false,
  caEnabled: false,
  clientsEnabled: {},
};

export function saveCertificateSettings(settings: CertificateSettings) {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.certificates.settings',
    value: settings,
  });
}

export function loadCertificateSettings(
    callback: (settings: CertificateSettings) => void) {
  function handler(event: MessageEvent) {
    const message = event.data;
    if (message.command === 'loadWorkspaceState' &&
        message.name === 'multimeter.certificates.settings') {
      const raw = message.value;
      if (!raw || typeof raw !== 'object') {
        callback(DEFAULT_CERT_SETTINGS);
        return;
      }
      callback({
        sslValidation: (raw as any).sslValidation !== false,
        allowSelfSigned: (raw as any).allowSelfSigned === true,
        caEnabled: (raw as any).caEnabled === true,
        clientsEnabled:
          (raw as any).clientsEnabled && typeof (raw as any).clientsEnabled === 'object'
            ? (raw as any).clientsEnabled
            : {},
      });
    }
  }
  window.addEventListener('message', handler);
  window.vscode?.postMessage(
      {command: 'loadWorkspaceState', name: 'multimeter.certificates.settings'});
  // Return a cleanup function
  return () => window.removeEventListener('message', handler);
}

export function clearCertificateSettings() {
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.certificates.settings',
    value: DEFAULT_CERT_SETTINGS,
  });
}