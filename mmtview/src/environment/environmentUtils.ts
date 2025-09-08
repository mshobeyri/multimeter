import {JSONValue} from 'mmt-core/dist/CommonData';
import {EnvVariable} from './EnvironmentData';
import {loadEnvVariables, saveEnvVariablesFromObject} from '../workspaceStorage';

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
 * Sets a single environment variable in storage
 * @param name Variable name
 * @param value Variable value
 * @param label Optional label (defaults to name if not provided)
 */
export const setEnvironmentVariable =
    (name: string, value: string|number|boolean, label?: string): void => {
      // First read existing variables
      const cleanup = loadEnvVariables((existingVars) => {
        const existing = Array.isArray(existingVars) ? existingVars : [];

        // Update or add the new variable
        const updated = existing.filter(v => v.name !== name);
        updated.push({name, label: label || name, value, options: []});

        // Save back to storage
        saveEnvVariablesFromObject(updated);
        cleanup();  // Clean up the subscription immediately
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
};