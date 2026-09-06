import {
  JudgeCheckResult,
  JudgeCriterionResult,
  JudgeData,
  JudgeRequest,
  JudgeResult,
  mergeJudgeStepConfig,
  normalizeJudgeCheckValue,
} from './JudgeData';
import {buildJudgeBuiltinChecksPrompt} from './judgeChecks';
import {parseDurationString} from './JSerHelper';

export type JudgeHttpPost = (args: {
  url: string;
  headers?: Record<string, string>;
  body: unknown;
  timeoutMs?: number;
}) => Promise<{status: number; statusText: string; body: any}>;

export interface JudgeEngine {
  readonly id: string;
  /** Validate judge connection fields for this engine (url/auth/…). Empty = ok. */
  validate(judge: JudgeData): string[];
  evaluate(req: JudgeRequest, httpPost?: JudgeHttpPost): Promise<JudgeResult>;
}

const engines = new Map<string, JudgeEngine>();
let injectedHttpPost: JudgeHttpPost|undefined;

export function registerJudgeEngine(engine: JudgeEngine): void {
  engines.set(engine.id, engine);
}

export function getJudgeEngine(id: string): JudgeEngine|undefined {
  return engines.get(id);
}

export function listJudgeEngines(): string[] {
  return [...engines.keys()];
}

/** Inject HTTP for judge engines (set from jsRunner / Node host). */
export function setJudgeHttpPost_(fn: JudgeHttpPost|undefined): void {
  injectedHttpPost = fn;
}

export function getJudgeHttpPost_(): JudgeHttpPost {
  if (!injectedHttpPost) {
    throw new Error('Judge HTTP transport not configured (setJudgeHttpPost_)');
  }
  return injectedHttpPost;
}

/** Prefer explicit httpPost; else use host-injected transport. */
export function resolveJudgeHttpPost(httpPost?: JudgeHttpPost): JudgeHttpPost {
  return httpPost ?? getJudgeHttpPost_();
}

export function resolveJudgeTimeoutMs(judge: JudgeData): number|undefined {
  const raw = judge.options?.timeout;
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const parsed = parseDurationString(String(raw));
  return parsed != null && parsed >= 0 ? parsed : undefined;
}

export function buildJudgeSystemPrompt(): string {
  return [
    'You are a strict automated test judge.',
    'Evaluate the provided inputs against structured checks and free-text criteria.',
    'Reply with JSON only (no markdown), using this shape:',
    '{',
    '  "checks": { "<name>": { "score": 0-1, "passed": true|false, "details": "..." } },',
    '  "criteria": [ { "passed": true|false, "reason": "..." } ]',
    '}',
    'criteria array MUST have the same length and order as the criteria list you were given.',
    'For each check, set passed true when score >= the given threshold (if any).',
    buildJudgeBuiltinChecksPrompt(),
  ].join('\n');
}

export function buildJudgeUserPrompt(req: JudgeRequest): string {
  const checkSpecs: Record<string, {threshold?: number}> = {};
  for (const [name, value] of Object.entries(req.checks || {})) {
    checkSpecs[name] = normalizeJudgeCheckValue(value);
  }
  return [
    '## Inputs',
    JSON.stringify(req.inputs ?? {}, null, 2),
    '',
    '## Checks (evaluate each)',
    JSON.stringify(checkSpecs, null, 2),
    '',
    '## Criteria (evaluate each in order)',
    JSON.stringify(req.criteria ?? [], null, 2),
  ].join('\n');
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

function asNumber(v: unknown): number|undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return undefined;
}

/**
 * Parse model JSON into JudgeResult, applying thresholds from the request.
 */
export function parseJudgeModelJson(
    rawText: string,
    req: JudgeRequest,
    ): JudgeResult {
  const cleaned = String(rawText ?? '').trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      passed: false,
      checks: Object.keys(req.checks || {}).map(name => ({
        name,
        passed: false,
        details: `Judge returned invalid JSON: ${msg}`,
      })),
      criteria: (req.criteria || []).map((text, index) => ({
        index,
        text,
        passed: false,
        reason: `Judge returned invalid JSON: ${msg}`,
      })),
      raw: rawText,
    };
  }

  const checkResults: JudgeCheckResult[] = [];
  for (const [name, value] of Object.entries(req.checks || {})) {
    const spec = normalizeJudgeCheckValue(value);
    const threshold = typeof spec.threshold === 'number' ? spec.threshold : undefined;
    const fromModel = parsed?.checks?.[name] ?? parsed?.checks?.[name.toLowerCase()];
    const score = asNumber(fromModel?.score);
    let passed = fromModel != null ? asBool(fromModel.passed) : false;
    if (threshold != null && score != null) {
      passed = score >= threshold;
    }
    checkResults.push({
      name,
      passed,
      score,
      threshold,
      details: typeof fromModel?.details === 'string' ? fromModel.details : undefined,
    });
  }

  const criterionResults: JudgeCriterionResult[] = [];
  const modelCriteria = Array.isArray(parsed?.criteria) ? parsed.criteria : [];
  (req.criteria || []).forEach((text, index) => {
    const fromModel = modelCriteria[index];
    criterionResults.push({
      index,
      text,
      passed: fromModel != null ? asBool(fromModel.passed) : false,
      reason: typeof fromModel?.reason === 'string' ? fromModel.reason :
          (fromModel == null ? 'Missing criterion result from judge' : undefined),
      score: asNumber(fromModel?.score),
    });
  });

  const passed =
      checkResults.every(c => c.passed) && criterionResults.every(c => c.passed);

  return {
    passed,
    checks: checkResults,
    criteria: criterionResults,
    raw: parsed,
  };
}

export async function evaluateJudge(
    judge: JudgeData,
    step: {
      inputs: Record<string, unknown>;
      checks?: Record<string, any>;
      criteria?: string[];
    },
    httpPost?: JudgeHttpPost,
    ): Promise<JudgeResult> {
  const {checks, criteria} = mergeJudgeStepConfig(judge, step.checks, step.criteria);
  if (Object.keys(checks).length === 0 && criteria.length === 0) {
    return {
      passed: false,
      checks: [],
      criteria: [{
        index: 0,
        text: '',
        passed: false,
        reason: 'Judge step requires checks and/or criteria',
      }],
    };
  }

  const engine = getJudgeEngine(String(judge.engine || ''));
  if (!engine) {
    return {
      passed: false,
      checks: Object.keys(checks).map(name => ({
        name,
        passed: false,
        details: `Unknown judge engine: ${judge.engine}`,
      })),
      criteria: criteria.map((text, index) => ({
        index,
        text,
        passed: false,
        reason: `Unknown judge engine: ${judge.engine}`,
      })),
    };
  }

  const configErrors = engine.validate(judge);
  if (configErrors.length > 0) {
    const details = configErrors.join('; ');
    return {
      passed: false,
      checks: Object.keys(checks).map(name => ({name, passed: false, details})),
      criteria: criteria.map((text, index) => ({
        index,
        text,
        passed: false,
        reason: details,
      })),
    };
  }

  const req: JudgeRequest = {
    judge,
    inputs: step.inputs ?? {},
    checks,
    criteria,
    options: judge.options,
  };
  return engine.evaluate(req, httpPost);
}
