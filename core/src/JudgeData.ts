import {MMTFile} from './CommonData';
import {AuthConfig} from './APIData';
import {Timestr} from './TestData';

/** Supported judge engine ids (v1). */
export type JudgeEngineId =
    'ollama'|'openai'|'anthropic'|'google'|'azure-openai';

export interface JudgeOptions {
  temperature?: number;
  timeout?: number|Timestr;
  [key: string]: unknown;
}

export interface JudgeDefaults {
  checks?: JudgeChecksMap;
  criteria?: string[];
}

/**
 * `type: judge` resource — who performs judgment (engine/model/url/auth).
 * Step defines what to judge.
 */
export interface JudgeData extends MMTFile {
  type: 'judge';
  title?: string;
  description?: string;
  tags?: string[];
  engine: JudgeEngineId|string;
  model: string;
  /** Base URL for the engine HTTP API (required). */
  url: string;
  /** Optional auth (e.g. OpenAI bearer / api-key). Same shape as API `auth`. */
  auth?: AuthConfig;
  /** Model / execution options. */
  options?: JudgeOptions;
  /** Optional defaults merged into steps (step wins). */
  defaults?: JudgeDefaults;
}

/** Structured check: bare number = threshold shorthand. */
export type JudgeCheckValue = number|{
  threshold?: number;
  [key: string]: unknown;
};

export type JudgeChecksMap = Record<string, JudgeCheckValue>;

export interface JudgeCheckResult {
  name: string;
  passed: boolean;
  score?: number;
  threshold?: number;
  details?: string;
}

export interface JudgeCriterionResult {
  index: number;
  text: string;
  passed: boolean;
  reason?: string;
  score?: number;
}

export interface JudgeResult {
  passed: boolean;
  checks: JudgeCheckResult[];
  criteria: JudgeCriterionResult[];
  raw?: unknown;
}

export interface JudgeRequest {
  judge: JudgeData;
  inputs: Record<string, unknown>;
  checks: JudgeChecksMap;
  criteria: string[];
  options?: JudgeOptions;
}

/** Normalize check value; bare number → `{ threshold }`. */
export function normalizeJudgeCheckValue(value: JudgeCheckValue): {
  threshold?: number;
  [key: string]: unknown;
} {
  if (typeof value === 'number') {
    return {threshold: value};
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {...value};
  }
  return {};
}

export function mergeJudgeStepConfig(
    judge: JudgeData,
    stepChecks?: JudgeChecksMap,
    stepCriteria?: string[],
    ): {checks: JudgeChecksMap; criteria: string[]} {
  const defaults = judge.defaults ?? {};
  const checks: JudgeChecksMap = {
    ...(defaults.checks ?? {}),
    ...(stepChecks ?? {}),
  };
  const criteria = (stepCriteria && stepCriteria.length > 0) ?
      stepCriteria.slice() :
      (defaults.criteria ?? []).slice();
  return {checks, criteria};
}

/** Split an expect/require block into metrics vs free-text criteria. */
export function splitJudgeEvalBlock(
    block: Record<string, unknown>|undefined|null,
    ): {metrics: JudgeChecksMap; criteria: string[]} {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return {metrics: {}, criteria: []};
  }
  const metrics: JudgeChecksMap = {};
  let criteria: string[] = [];
  for (const [key, value] of Object.entries(block)) {
    if (key === 'criteria') {
      criteria = Array.isArray(value) ?
          value.filter((item): item is string => typeof item === 'string') :
          [];
      continue;
    }
    metrics[key] = value as JudgeCheckValue;
  }
  return {metrics, criteria};
}

/**
 * Build a single checks map for the model call from soft + hard metrics.
 * When the same metric appears at both levels, send the looser (min) threshold;
 * caller re-applies each level's threshold to the returned score.
 */
export function unionJudgeChecksForModel(
    soft: JudgeChecksMap,
    hard: JudgeChecksMap,
    ): JudgeChecksMap {
  const names = new Set([...Object.keys(soft), ...Object.keys(hard)]);
  const out: JudgeChecksMap = {};
  for (const name of names) {
    const softSpec = soft[name] != null ? normalizeJudgeCheckValue(soft[name]) : undefined;
    const hardSpec = hard[name] != null ? normalizeJudgeCheckValue(hard[name]) : undefined;
    const softT = softSpec?.threshold;
    const hardT = hardSpec?.threshold;
    const thresholds = [softT, hardT].filter(
        (t): t is number => typeof t === 'number' && Number.isFinite(t));
    if (thresholds.length > 0) {
      out[name] = Math.min(...thresholds);
    } else {
      out[name] = soft[name] ?? hard[name];
    }
  }
  return out;
}
