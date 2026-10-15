/**
 * Built-in structured judge checks (Promptfoo-inspired).
 * Free-text `criteria` remains available for one-off rules.
 */

export type JudgeBuiltinCheckId =
    'semanticSimilarity'|'answerRelevance'|'contextFaithfulness'|'factuality';

export interface JudgeBuiltinCheckDef {
  id: JudgeBuiltinCheckId;
  /** Short autocomplete / docs label */
  label: string;
  /** Human description for docs / autocomplete */
  description: string;
  /** Context fields this check typically uses */
  contextHints: string[];
  /** Suggested default threshold (docs / autocomplete inserts) */
  defaultThreshold: number;
  /** Guidance line embedded in the judge system prompt */
  promptGuidance: string;
}

export const JUDGE_BUILTIN_CHECKS: readonly JudgeBuiltinCheckDef[] = [
  {
    id: 'semanticSimilarity',
    label: 'Semantic similarity',
    description:
        'How similar inputs.actual is to inputs.expected (or the closest reference field) in meaning, not exact wording.',
    contextHints: ['actual', 'expected'],
    defaultThreshold: 0.8,
    promptGuidance:
        'semanticSimilarity: score 0..1 similarity between inputs.actual and inputs.expected (or closest available reference).',
  },
  {
    id: 'answerRelevance',
    label: 'Answer relevance',
    description:
        'Whether inputs.actual answers the user question / request (inputs.question, or inferred from context).',
    contextHints: ['actual', 'question'],
    defaultThreshold: 0.8,
    promptGuidance:
        'answerRelevance: score 0..1 how well inputs.actual answers inputs.question (or the implied user request). Irrelevant or off-topic replies score low.',
  },
  {
    id: 'contextFaithfulness',
    label: 'Context faithfulness',
    description:
        'Whether inputs.actual stays faithful to provided policy / retrieved context (anti-hallucination).',
    contextHints: ['actual', 'policy', 'retrievedContext'],
    defaultThreshold: 0.7,
    promptGuidance:
        'contextFaithfulness: score 0..1 how well inputs.actual is grounded in inputs.policy and/or inputs.retrievedContext. Penalize claims not supported by that context.',
  },
  {
    id: 'factuality',
    label: 'Factuality',
    description:
        'Whether inputs.actual is factually consistent with inputs.expected and/or other provided ground-truth fields.',
    contextHints: ['actual', 'expected', 'policy'],
    defaultThreshold: 0.7,
    promptGuidance:
        'factuality: score 0..1 factual correctness of inputs.actual relative to inputs.expected and other ground-truth fields in inputs (policy, facts, …).',
  },
] as const;

export const JUDGE_BUILTIN_CHECK_IDS: readonly JudgeBuiltinCheckId[] =
    JUDGE_BUILTIN_CHECKS.map(c => c.id);

export function getJudgeBuiltinCheck(id: string): JudgeBuiltinCheckDef|undefined {
  return JUDGE_BUILTIN_CHECKS.find(c => c.id === id);
}

/** Extra system-prompt lines describing built-in checks. */
export function buildJudgeBuiltinChecksPrompt(): string {
  return [
    'Built-in checks (when present in the checks map):',
    ...JUDGE_BUILTIN_CHECKS.map(c => `- ${c.promptGuidance}`),
    'For any other check name, interpret it sensibly from the name and score 0..1; set passed if score >= threshold when a threshold is provided.',
  ].join('\n');
}

/** Comma-separated builtin ids (docs / autocomplete copy). */
export function builtinJudgeCheckIdsCsv(): string {
  return JUDGE_BUILTIN_CHECK_IDS.join(', ');
}

const JUDGE_CHECK_VALUE_ANYOF = [
  {type: 'number'},
  {
    type: 'object',
    properties: {threshold: {type: 'number'}},
    additionalProperties: true,
  },
] as const;

/** JSON Schema `properties` for the four built-in metric keys. */
export function builtinJudgeCheckSchemaProperties(
    opts?: {includeDescription?: boolean},
    ): Record<string, Record<string, unknown>> {
  const withDesc = opts?.includeDescription !== false;
  const out: Record<string, Record<string, unknown>> = {};
  for (const check of JUDGE_BUILTIN_CHECKS) {
    const prop: Record<string, unknown> = {
      anyOf: JUDGE_CHECK_VALUE_ANYOF.map(item => ({...item})),
    };
    if (withDesc) {
      prop.description =
          `${check.description} (0..1 threshold or { threshold })`;
    }
    out[check.id] = prop;
  }
  return out;
}

/** YAML snippet for `defaults.checks` autocomplete (first two builtins). */
export function builtinJudgeDefaultsChecksYaml(indentTabs = 2): string {
  const prefix = '\t'.repeat(indentTabs);
  return JUDGE_BUILTIN_CHECKS.slice(0, 2)
      .map(c => `${prefix}${c.id}: ${c.defaultThreshold}`)
      .join('\n');
}

export type JudgeBuiltinSuggest = {
  id: JudgeBuiltinCheckId;
  insertText: string;
  detail: string;
  documentation: string;
};

/** Autocomplete rows for expect/require metric keys. */
export function builtinJudgeEvalSuggestions(): JudgeBuiltinSuggest[] {
  return JUDGE_BUILTIN_CHECKS.map(c => ({
    id: c.id,
    insertText: `${c.id}: ${c.defaultThreshold}\n`,
    detail: `${c.label} threshold`,
    documentation: c.description,
  }));
}
