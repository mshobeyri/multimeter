import type {JSONRecord, JSONValue} from 'mmt-core/CommonData';
import type {EnvVariableValue} from 'mmt-core/EnvData';
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
      return {name, type: 'list' as const, value: [...value]};
    }
    const obj = (value && typeof value === 'object') ? value : {};
    return {
      name,
      type: 'object' as const,
      value: {...(obj as JSONRecord)},
    };
  });
}

/**
 * Boards → YAML `variables` map.
 * - Drops unnamed boards (UI draft rows).
 * - Drops empty objects / empty lists so we never write `foo: {}`.
 * - Coerces list entry text through {@link inputBoxToYamlValue} so `8080` stays a number.
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
      const list = raw
          .map((entry) => {
            if (typeof entry === 'string') {
              return inputBoxToYamlValue(entry);
            }
            return entry as JSONValue;
          })
          .filter((entry) => entry !== '');
      if (list.length === 0) {
        continue;
      }
      out[name] = list as EnvVariableValue;
      continue;
    }
    const raw = (board.value && typeof board.value === 'object' &&
            !Array.isArray(board.value)) ?
      board.value as JSONRecord :
      {};
    const obj: Record<string, string | number | boolean | null | undefined> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!key.trim()) {
        continue;
      }
      if (val === undefined) {
        continue;
      }
      obj[key] = val as string | number | boolean | null;
    }
    if (Object.keys(obj).length === 0) {
      continue;
    }
    out[name] = obj;
  }
  return out;
}

/** Display helper for list rows (numbers/bools → input-box text). */
export function envListValueToInputBox(value: JSONValue): string {
  return yamlValueToInputBox(value);
}
