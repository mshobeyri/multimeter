import type {JSONRecord, JSONValue} from 'mmt-core/CommonData';
import type {EnvNestedObject, EnvNestedValue, EnvVariableValue} from 'mmt-core/EnvData';
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

export function variablesToBoards(
    variables: Record<string, EnvVariableValue> | undefined,
): EnvVariableBoard[] {
  const safe =
    variables && typeof variables === 'object' && !Array.isArray(variables) ?
      variables :
      {};
  return Object.entries(safe).map(([name, value]) => {
    if (Array.isArray(value)) {
      return {name, type: 'list' as const, value: [...value] as JSONValue[]};
    }
    const obj = (value && typeof value === 'object') ? value : {};
    return {
      name,
      type: 'object' as const,
      value: {...(obj as JSONRecord)},
    };
  });
}

function coerceEnvEntry(entry: JSONValue): EnvNestedValue {
  if (typeof entry === 'string') {
    return inputBoxToYamlValue(entry) as EnvNestedValue;
  }
  return entry as EnvNestedValue;
}

/**
 * Boards → YAML `variables` map.
 * - Drops unnamed boards (UI draft rows before a name is typed).
 * - Keeps named empty objects (`foo: {}`) and lists (`bar: []`) so object/list
 *   types survive round-trips while the user fills them in.
 * - Coerces display text through {@link inputBoxToYamlValue} so numbers, bools,
 *   and JSON object/list literals keep their types.
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
      out[name] = raw
          .map((entry) => coerceEnvEntry(entry as JSONValue))
          .filter((entry) => entry !== '') as EnvNestedValue[];
      continue;
    }
    const raw = (board.value && typeof board.value === 'object' &&
            !Array.isArray(board.value)) ?
      board.value as JSONRecord :
      {};
    const obj: EnvNestedObject = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!key.trim()) {
        continue;
      }
      if (val === undefined) {
        continue;
      }
      obj[key] = coerceEnvEntry(val as JSONValue);
    }
    out[name] = obj;
  }
  return out;
}

/** Display helper for list rows (numbers/bools/objects → input-box text). */
export function envListValueToInputBox(value: JSONValue): string {
  return yamlValueToInputBox(value);
}
