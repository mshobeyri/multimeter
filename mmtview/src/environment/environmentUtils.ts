import {JSONValue} from 'mmt-core/CommonData';
import {EnvVariable, EnvVarSource, EnvCertificates, CertificateSettings} from './EnvironmentData';
import {clearEnvPresets, loadEnvVariables, saveEnvVariablesFromObject, saveCertificatesFromObject, loadCertificates, clearCertificates, saveCertificateSettings, loadCertificateSettings, clearCertificateSettings as clearCertSettingsStorage} from '../workspaceStorage';

/**
 * Reads environment variables from storage
 * @param callback Function to call with the loaded environment variables
 * @returns Cleanup function to unsubscribe from updates
 */
export const readEnvironmentVariables =
    (callback: (vars: EnvVariable[]|undefined|null) => void): (() => void) => {
      return loadEnvVariables(callback);
    };

/**
 * Writes environment variables to storage
 * @param variables Array of environment variables to save
 */
export const writeEnvironmentVariables =
    (variables: EnvVariable[]): void => {
      saveEnvVariablesFromObject(variables);
    };

/**
 * Upsert `incoming` by name; keep other existing vars (manual / runtime /
 * vars from other env files). Incoming order is preserved first.
 */
export function mergeEnvVariableLists(
    existing: EnvVariable[]|undefined|null,
    incoming: EnvVariable[]|undefined|null,
): EnvVariable[] {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const incomingNames = new Set(
      safeIncoming.map(v => v?.name).filter((n): n is string => !!n));
  return [
    ...safeIncoming,
    ...safeExisting.filter(v => v?.name && !incomingNames.has(v.name)),
  ];
}

/**
 * Merge incoming vars into current workspace storage (does not wipe others).
 */
export const mergeEnvironmentVariables =
    (incoming: EnvVariable[]): void => {
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return;
      }
      const cleanup = loadEnvVariables((existingVars) => {
        saveEnvVariablesFromObject(
            mergeEnvVariableLists(existingVars, incoming));
        cleanup();
      });
    };

/** Drop vars whose names are in `names`; keep everything else. */
export function removeEnvVariablesByNames(
    existing: EnvVariable[]|undefined|null,
    names: string[],
): EnvVariable[] {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const drop = new Set(
      (Array.isArray(names) ? names : [])
          .map(n => String(n ?? '').trim())
          .filter(Boolean));
  if (drop.size === 0) {
    return safeExisting;
  }
  return safeExisting.filter(v => !v?.name || !drop.has(v.name));
}

/**
 * Remove named vars from workspace storage; leave other keys untouched.
 */
export const removeEnvironmentVariablesByNames =
    (names: string[]): void => {
      const drop = (Array.isArray(names) ? names : [])
                       .map(n => String(n ?? '').trim())
                       .filter(Boolean);
      if (drop.length === 0) {
        return;
      }
      const cleanup = loadEnvVariables((existingVars) => {
        saveEnvVariablesFromObject(
            removeEnvVariablesByNames(existingVars, drop));
        cleanup();
      });
    };

/**
 * Sets a single environment variable in storage
 * @param name Variable name
 * @param value Variable value
 * @param label Optional label (defaults to name if not provided)
 */
export const setEnvironmentVariable =
    (name: string, value: string|number|boolean, label?: string): void => {
      setEnvironmentVariables([{name, value, label}]);
    };

/**
 * Sets multiple environment variables in one read-modify-write to avoid races.
 */
export const setEnvironmentVariables =
    (updates: Array<{
      name: string;
      value: string|number|boolean;
      label?: string;
      source?: EnvVarSource;
    }>): void => {
          if (!Array.isArray(updates) || updates.length === 0) {
            return;
          }
          const cleanup = loadEnvVariables((existingVars) => {
            let updated = Array.isArray(existingVars) ? [...existingVars] : [];
            for (const item of updates) {
              if (!item?.name) {
                continue;
              }
              updated = updated.filter(v => v.name !== item.name);
              const source: EnvVarSource = item.source || 'runtime';
              updated.push({
                name: item.name,
                label: item.label || item.name,
                value: item.value,
                options: [],
                source,
              });
            }
            saveEnvVariablesFromObject(updated);
            cleanup();
          });
        };

/**
 * Gets a single environment variable value from storage
 * @param name Variable name to retrieve
 * @returns Promise that resolves with the variable value or undefined if not
 *     found
 */
export const getEnvironmentVariable = (name: string): Promise<JSONValue> => {
  return new Promise((resolve) => {
    const cleanup = loadEnvVariables((vars) => {
      const existing = Array.isArray(vars) ? vars : [];
      const found = existing.find(v => v.name === name);
      resolve(found ? found.value : null);
      cleanup();  // Clean up the subscription immediately
    });
  });
};

/**
 * Clears all environment variables from storage
 */
export const clearEnvironmentVariables = (): void => {
  saveEnvVariablesFromObject([]);
  clearEnvPresets();
};

/**
 * Reads certificate file paths from storage (YAML data only)
 * @param callback Function to call with the loaded certificates
 * @returns Cleanup function to unsubscribe from updates
 */
export const readCertificates =
    (callback: (certs: EnvCertificates|null) => void): (() => void) => {
      return loadCertificates(callback);
    };

/**
 * Writes certificate file paths to storage (YAML data only)
 * @param certificates Certificate settings to save
 */
export const writeCertificates =
    (certificates: EnvCertificates): void => {
      saveCertificatesFromObject(certificates);
    };

/**
 * Clears all certificate file paths from storage
 */
export const clearCertificatesData = (): void => {
  clearCertificates();
};

/**
 * Reads certificate boolean settings from storage
 * @param callback Function to call with the loaded settings
 * @returns Cleanup function to unsubscribe from updates
 */
export const readCertificateSettings =
    (callback: (settings: CertificateSettings) => void): (() => void) => {
      return loadCertificateSettings(callback);
    };

/**
 * Writes certificate boolean settings to storage
 * @param settings Certificate boolean settings to save
 */
export const writeCertificateSettings =
    (settings: CertificateSettings): void => {
      saveCertificateSettings(settings);
    };

/**
 * Clears all certificate boolean settings from storage
 */
export const clearCertificateSettings = (): void => {
  clearCertSettingsStorage();
};