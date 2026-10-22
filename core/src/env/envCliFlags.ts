import type {JSONValue} from '../data/CommonData';
import type {EnvPresets, EnvVarSource} from '../data/EnvData';
import {
  derivePresetSelections,
  type EnvVarSnapshot,
} from './envPresetMatch';
import {
  isRuntimeEnvSource,
  resolveWorkspaceEnvMap,
} from './workspaceEnvVars';

/** Always single-quote for POSIX shells (escape embedded `'`). */
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Quote a token for POSIX shells when spaces or special chars are present. */
export function shellQuoteIfNeeded(value: string): string {
  if (value.length === 0) {
    return "''";
  }
  if (!/[\s'"\\]/.test(value)) {
    return value;
  }
  return shellSingleQuote(value);
}

/**
 * Format a value for `testlight -e key=…` so `coerceCliValue` round-trips.
 * Numbers/bools/null stay bare; strings that look like those (or need shell
 * safety) are single-quoted.
 */
export function formatCliEnvValue(value: JSONValue | undefined): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const needsQuote = value.length === 0 ||
        /[\s'"\\]/.test(value) ||
        /^(true|false|null|omit)$/i.test(value) ||
        /^[-+]?\d+(\.\d+)?$/.test(value);
    return needsQuote ? shellSingleQuote(value) : value;
  }
  return shellSingleQuote(JSON.stringify(value ?? null));
}

export type BuildSmartEnvCliFlagsParams = {
  /** Relative (preferred) or absolute path for `-F`. Omit when unavailable. */
  envFile?: string | null;
  variables: Array<EnvVarSnapshot & {source?: EnvVarSource}>;
  presets?: EnvPresets | null;
};

/**
 * Build smart testlight env flags from workspace env state:
 * `-F file -P group.option … -e key=val …`
 *
 * `-F` / `-P` only when an env file is provided and at least one preset fully
 * matches current environment-layer variables. Covered preset keys are omitted
 * from `-e` unless a runtime overlay supplies that key; remaining / manual /
 * runtime values are emitted as `-e`.
 */
export function buildSmartEnvCliFlags(params: BuildSmartEnvCliFlagsParams): string {
  const vars = Array.isArray(params.variables) ?
      params.variables.filter(
          (v): v is EnvVarSnapshot & {source?: EnvVarSource} =>
              !!v && typeof v.name === 'string' && v.name.trim().length > 0) :
      [];
  const envLayer = vars.filter(v => !isRuntimeEnvSource(v.source));
  const runtimeNames = new Set(
      vars.filter(v => isRuntimeEnvSource(v.source)).map(v => v.name));
  const resolved = resolveWorkspaceEnvMap(vars);
  const envFile =
      typeof params.envFile === 'string' ? params.envFile.trim() : '';
  const parts: string[] = [];
  const covered = new Set<string>();

  if (envFile) {
    const selections = derivePresetSelections(envLayer, params.presets);
    const presetNames = Object.keys(selections).sort((a, b) => a.localeCompare(b));
    if (presetNames.length > 0) {
      parts.push(`-F ${shellQuoteIfNeeded(envFile)}`);
      for (const group of presetNames) {
        const option = selections[group];
        parts.push(`-P ${shellQuoteIfNeeded(`${group}.${option}`)}`);
        const mapping = params.presets?.[group]?.[option];
        if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
          for (const key of Object.keys(mapping)) {
            covered.add(key);
          }
        }
      }
    }
  }

  const names = Object.keys(resolved).sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    if (covered.has(name) && !runtimeNames.has(name)) {
      continue;
    }
    const value = resolved[name];
    if (typeof value === 'undefined') {
      continue;
    }
    parts.push(
        `-e ${shellQuoteIfNeeded(name)}=${formatCliEnvValue(value as JSONValue)}`);
  }

  return parts.join(' ');
}
