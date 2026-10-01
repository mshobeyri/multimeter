import type {JSONRecord, JSONValue} from 'mmt-core/CommonData';
import type {EnvScalar, EnvVariableValue} from 'mmt-core/EnvData';
import {inputBoxToYamlValue, yamlValueToInputBox} from 'mmt-core/yamlValueConvert';

export type EnvVariableBoard = {
  name: string;
  type: 'list' | 'object';
  value: JSONValue[] | JSONRecord;
};

/** Stable signature so the editor can resync when YAML changes externally. */
export function envVariablesSignature(
    variables: Record<string, EnvVariableValue> | undefined,
): string {
  return JSON.stringify(variables ?? {});
}

export function isEnvScalar(value: unknown): value is EnvScalar {
  return value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';
}

/**
 * Coerce UI text / values to an env scalar. Object and list results are ignored
 * (return undefined) — env values stay string | number | boolean | null only.
 */
export function coerceEnvScalar(entry: JSONValue): EnvScalar | undefined {
  const typed = typeof entry === 'string' ? inputBoxToYamlValue(entry) : entry;
  if (!isEnvScalar(typed)) {
    return undefined;
  }
  return typed;
}

function scalarRecordFromUnknown(
    raw: Record<string, unknown>,
): Record<string, EnvScalar | undefined> {
  const out: Record<string, EnvScalar | undefined> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!key.trim()) {
      continue;
    }
    if (isEnvScalar(val)) {
      out[key] = val;
    }
    // object / list choice values are dropped
  }
  return out;
}

export function variablesToBoards(
    variables: Record<string, EnvVariableValue> | undefined,
): EnvVariableBoard[] {
  const safe =
    variables && typeof variables === 'object' && !Array.isArray(variables) ?
      variables :
      {};
  return Object.entries(safe).map(([name, value]) => {
    if (Array.isArray(value)) {
      return {
        name,
        type: 'list' as const,
        value: value.filter(isEnvScalar) as JSONValue[],
      };
    }
    const obj = (value && typeof value === 'object') ? value : {};
    return {
      name,
      type: 'object' as const,
      value: scalarRecordFromUnknown(obj as Record<string, unknown>) as JSONRecord,
    };
  });
}

/**
 * Boards → YAML `variables` map.
 * - Drops unnamed boards (UI draft rows before a name is typed).
 * - Keeps named empty objects (`foo: {}`) and lists (`bar: []`).
 * - Coerces display text to scalars; object/list values are ignored.
 */
export function boardsToVariables(
    boards: EnvVariableBoard[],
): Record<string, EnvVariableValue> {
  const out: Record<string, EnvVariableValue> = {};
  for (const board of boards) {
    const name = (board.name ?? '').trim();
    if (!name) {
      continue;
    }
    if (board.type === 'list') {
      const raw = Array.isArray(board.value) ? board.value : [];
      const list: EnvScalar[] = [];
      for (const entry of raw) {
        const scalar = coerceEnvScalar(entry as JSONValue);
        if (scalar === undefined || scalar === '') {
          continue;
        }
        list.push(scalar);
      }
      out[name] = list;
      continue;
    }
    const raw = (board.value && typeof board.value === 'object' &&
            !Array.isArray(board.value)) ?
      board.value as JSONRecord :
      {};
    const obj: Record<string, EnvScalar | undefined> = {};
    for (const [key, val] of Object.entries(raw)) {
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
      obj[key] = scalar;
    }
    out[name] = obj;
  }
  return out;
}

/** Display helper for list rows (numbers/bools → input-box text). */
export function envListValueToInputBox(value: JSONValue): string {
  if (!isEnvScalar(value) && value !== undefined) {
    return '';
  }
  return yamlValueToInputBox(value);
}
