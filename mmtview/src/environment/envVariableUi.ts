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

export type EnvChoice = {label: string; value: JSONValue};

/**
 * Choices for one env variable. The stored value keeps its YAML type.
 * List labels use input-box text so `10` and `"10"` stay distinct.
 * Object labels are the field names. A scalar is a single choice.
 */
export function envVariableChoices(value: unknown): EnvChoice[] {
  if (Array.isArray(value)) {
    return envScalarChoices(value);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([label, item]) => ({
      label,
      value: item as JSONValue,
    }));
  }
  if (isEnvScalar(value)) {
    return [{label: yamlValueToInputBox(value), value}];
  }
  return [];
}

/**
 * Which choice is active. Identity is the label (the field name, or the
 * input-box text for a list). A stored value that was stringified (`"10"`
 * for the number 10) does not replace the YAML type.
 */
export function pickEnvChoice(
    options: EnvChoice[],
    stored?: {label?: unknown; value?: unknown}|null,
): EnvChoice|undefined {
  if (options.length === 0) {
    return undefined;
  }
  if (stored && typeof stored.label === 'string') {
    const byLabel = options.find(opt => opt.label === stored.label);
    if (byLabel) {
      return byLabel;
    }
  }
  if (stored) {
    const byValue = options.find(opt => Object.is(opt.value, stored.value));
    if (byValue) {
      return byValue;
    }
  }
  return options[0];
}

/**
 * Choices for a list env variable. The stored value keeps its YAML type.
 * The label uses input-box text so `10` and `"10"` stay distinct.
 */
export function envScalarChoices(value: unknown): EnvChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const options: EnvChoice[] = [];
  for (const item of value) {
    if (!isEnvScalar(item)) {
      continue;
    }
    options.push({label: yamlValueToInputBox(item), value: item});
  }
  return options;
}

/** Display helper for list rows (numbers/bools/quoted strings → input-box text). */
export function envListValueToInputBox(value: JSONValue): string {
  if (!isEnvScalar(value) && value !== undefined) {
    return '';
  }
  return yamlValueToInputBox(value);
}
