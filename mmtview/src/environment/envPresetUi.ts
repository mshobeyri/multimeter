import type {JSONValue} from 'mmt-core/CommonData';
import type {EnvPresetMapping, EnvPresets, EnvPresetValue} from 'mmt-core/EnvData';
import {coerceEnvScalar, isEnvScalar} from './envVariableUi';

export type EnvPresetEnvBoard = {
  env: string;
  kv: Record<string, JSONValue>;
};

export type EnvPresetBoard = {
  name: string;
  values: EnvPresetEnvBoard[];
};

export function envPresetsSignature(presets: EnvPresets | undefined): string {
  return JSON.stringify(presets ?? {});
}

export function presetsToBoards(presets: EnvPresets | undefined): EnvPresetBoard[] {
  return Object.entries(presets || {}).map(([name, envs]) => ({
    name,
    values: Object.entries(envs || {}).map(([env, kv]) => {
      const scalarKv: Record<string, JSONValue> = {};
      for (const [key, val] of Object.entries(kv || {})) {
        if (isEnvScalar(val)) {
          scalarKv[key] = val;
        }
      }
      return {env, kv: scalarKv};
    }),
  }));
}

/**
 * Boards → YAML `presets` map.
 * - Drops unnamed preset / env boards.
 * - Drops empty env mappings (`dev: {}`).
 * - Keeps typed scalars only; object/list values are ignored.
 */
export function boardsToPresets(boards: EnvPresetBoard[]): EnvPresets {
  const out: EnvPresets = {};
  for (const board of boards) {
    const name = (board.name ?? '').trim();
    if (!name) {
      continue;
    }
    const group: Record<string, EnvPresetMapping> = {};
    for (const entry of board.values) {
      const env = (entry.env ?? '').trim();
      if (!env) {
        continue;
      }
      const kv: EnvPresetMapping = {};
      for (const [key, val] of Object.entries(entry.kv || {})) {
        if (!key.trim()) {
          continue;
        }
        if (val === undefined) {
          continue;
        }
        const scalar = coerceEnvScalar(val as JSONValue);
        if (scalar === undefined) {
          continue;
        }
        kv[key] = scalar as EnvPresetValue;
      }
      if (Object.keys(kv).length === 0) {
        continue;
      }
      group[env] = kv;
    }
    if (Object.keys(group).length === 0) {
      continue;
    }
    out[name] = group;
  }
  return out;
}
