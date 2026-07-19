import {isOmitSentinel, OMIT_SENTINEL} from './omitKeyword';
import {extractOutputs, ResponseData} from './outputExtractor';

export type SetenvLegacyRef = {
  envKey: string;
  outputKey: string;
  expression: string;
};

/**
 * True when a setenv value is a legacy reference to an outputs key name
 * (e.g. `TOKEN: token` where `outputs.token` exists).
 */
export function isLegacySetenvOutputRef(
    value: unknown, outputs?: Record<string, string>|null): value is string {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  if (!outputs || typeof outputs !== 'object') {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(outputs, value);
}

/**
 * Find setenv entries that still reference outputs keys by name.
 */
export function findLegacySetenvOutputRefs(
    setenv: Record<string, any>|null|undefined,
    outputs: Record<string, string>|null|undefined): SetenvLegacyRef[] {
  if (!setenv || typeof setenv !== 'object') {
    return [];
  }
  const refs: SetenvLegacyRef[] = [];
  for (const [envKey, value] of Object.entries(setenv)) {
    if (!envKey || !isLegacySetenvOutputRef(value, outputs)) {
      continue;
    }
    const expression = outputs![value];
    if (typeof expression !== 'string') {
      continue;
    }
    refs.push({envKey, outputKey: value, expression});
  }
  return refs;
}

/**
 * Build extractOutputs rules for setenv.
 * Legacy output-key refs are rewritten to that output's extraction expression.
 */
export function buildSetenvExtractRules(
    setenv: Record<string, any>|null|undefined,
    outputs?: Record<string, string>|null): Record<string, string> {
  if (!setenv || typeof setenv !== 'object') {
    return {};
  }
  const rules: Record<string, string> = {};
  for (const [envKey, value] of Object.entries(setenv)) {
    if (!envKey || typeof value !== 'string' || !value) {
      continue;
    }
    if (isLegacySetenvOutputRef(value, outputs)) {
      const expression = outputs![value];
      if (typeof expression === 'string' && expression) {
        rules[envKey] = expression;
      }
      continue;
    }
    rules[envKey] = value;
  }
  return rules;
}

export type ResolvedSetenvValue = {
  name: string;
  value: string|number|boolean;
};

/**
 * Resolve setenv values from a response.
 * Prefers already-extracted outputs for legacy refs when provided.
 */
export function resolveSetenvValues(options: {
  response: ResponseData;
  setenv?: Record<string, any>|null;
  outputs?: Record<string, string>|null;
  extractedOutputs?: Record<string, any>|null;
}): ResolvedSetenvValue[] {
  const {response, setenv, outputs, extractedOutputs} = options;
  if (!setenv || typeof setenv !== 'object') {
    return [];
  }

  const rules = buildSetenvExtractRules(setenv, outputs);
  const extracted = Object.keys(rules).length > 0 ?
      extractOutputs(response, rules) :
      {};

  const resolved: ResolvedSetenvValue[] = [];
  for (const [envKey, rawValue] of Object.entries(setenv)) {
    if (!envKey || rawValue == null || rawValue === '') {
      continue;
    }

    let value: any;
    if (isLegacySetenvOutputRef(rawValue, outputs) && extractedOutputs &&
        Object.prototype.hasOwnProperty.call(extractedOutputs, rawValue)) {
      value = extractedOutputs[rawValue];
    } else if (Object.prototype.hasOwnProperty.call(extracted, envKey)) {
      value = extracted[envKey];
    } else {
      continue;
    }

    if (value == null || value === '' || isOmitSentinel(value) ||
        value === OMIT_SENTINEL) {
      continue;
    }

    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    if (typeof value !== 'string' && typeof value !== 'number' &&
        typeof value !== 'boolean') {
      value = String(value);
    }

    resolved.push({name: envKey, value});
  }

  return resolved;
}
