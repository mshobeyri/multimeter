import type {EnvVariable, EnvVarSource} from '../data/EnvData';

export function isRuntimeEnvSource(source: EnvVarSource|undefined): boolean {
  return source === 'runtime';
}

/** Stamp / identity key: file and manual share the environment layer. */
export function envVarStorageKey(
    name: string, source: EnvVarSource|undefined): string {
  const layer = isRuntimeEnvSource(source) ? 'runtime' : 'environment';
  return `${name}\0${layer}`;
}

/**
 * Flat env map for runs: environment (file/manual) first, then runtime overlay.
 */
export function resolveWorkspaceEnvMap(
    vars: Array<{name?: unknown; value?: unknown; source?: unknown}>|
    null|undefined): Record<string, any> {
  const envVars: Record<string, any> = {};
  const list = Array.isArray(vars) ? vars : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = (item as any).name;
    if (typeof name !== 'string' || !name) {
      continue;
    }
    if (isRuntimeEnvSource((item as any).source)) {
      continue;
    }
    envVars[name] = (item as any).value;
  }
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const name = (item as any).name;
    if (typeof name !== 'string' || !name) {
      continue;
    }
    if (!isRuntimeEnvSource((item as any).source)) {
      continue;
    }
    envVars[name] = (item as any).value;
  }
  return envVars;
}
