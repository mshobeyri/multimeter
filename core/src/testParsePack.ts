import parseYaml, {packYaml, parseYamlStrict} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject} from './safer';
import {FlowType, opsList, TestData, TestFlowStep, TestFlowSteps, TestFlowStages} from './TestData';

/**
 * Canonical key orders for each step type.
 * Keys not listed here are appended in original order after the canonical ones.
 */
export const STEP_KEY_ORDER: Record<string, string[]> = {
  call:   ['call', 'id', 'title', 'inputs', 'expect', 'debug', 'report'],
  run:    ['run'],
  check:  ['check'],
  assert: ['assert'],
  if:     ['if', 'steps', 'else'],
  for:    ['for', 'steps'],
  repeat: ['repeat', 'steps'],
  delay:  ['delay'],
  js:     ['js'],
  print:  ['print'],
  set:    ['set'],
  var:    ['var'],
  const:  ['const'],
  let:    ['let'],
  data:   ['data'],
  setenv: ['setenv'],
};

/** Canonical key order for check/assert object-form (ComparisonObject) values. */
export const CHECK_ASSERT_VALUE_ORDER = ['title', 'actual', 'operator', 'expected', 'report', 'details'];

/** Valid root-level keys for type: test files. */
const VALID_TEST_ROOT_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'import', 'inputs', 'outputs',
  'steps', 'stages', 'flow',
]);

/** Valid keys per step type. */
const VALID_STEP_KEYS: Record<string, Set<string>> = {
  call:    new Set(['call', 'id', 'title', 'inputs', 'expect', 'debug', 'report', 'interface', 'url', 'headers', 'outputs', 'body']),
  run:     new Set(['run']),
  check:   new Set(['check', 'title', 'report', 'details']),
  assert:  new Set(['assert', 'title', 'report', 'details']),
  if:      new Set(['if', 'steps', 'else']),
  for:     new Set(['for', 'steps']),
  repeat:  new Set(['repeat', 'steps']),
  delay:   new Set(['delay']),
  js:      new Set(['js']),
  print:   new Set(['print']),
  set:     new Set(['set']),
  var:     new Set(['var']),
  const:   new Set(['const']),
  let:     new Set(['let']),
  data:    new Set(['data']),
  setenv:  new Set(['setenv']),
};

/** Canonical key order for stage items. */
export const STAGE_KEY_ORDER = ['id', 'title', 'condition', 'after', 'steps'];

/**
 * Operators that need quoting in YAML because they start with a character that
 * YAML interprets specially:
 *   `!`  → tag indicator  (value silently loses the operator)
 *   `>`  → block-scalar indicator  (parse error)
 * We pre-quote these inside `expect:` blocks before YAML.parse sees them.
 */
const YAML_UNSAFE_OPS = opsList.filter(op => op.startsWith('!') || op.startsWith('>'));

/**
 * Pre-process raw YAML text to double-quote `expect:` map values and array
 * items whose leading characters would be mangled by the YAML parser.
 *
 * Handles both flat and array forms:
 *   expect:                      expect:
 *     status: != 200               status:
 *     name: > 5                      - != 500
 *                                    - > 0
 *
 * Already-quoted values (starting with " or ') are left untouched.
 */
export function quoteExpectOperators(yaml: string): string {
  const lines = yaml.split('\n');
  let inExpect = false;
  let expectIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }
    const indent = line.search(/\S/);

    // Detect `expect:` or `debug:` with nothing after the colon (block form)
    if (/^\s*(?:expect|debug):\s*$/.test(line)) {
      inExpect = true;
      expectIndent = indent;
      continue;
    }

    // Still inside the expect block?
    if (inExpect) {
      if (indent <= expectIndent) {
        inExpect = false;
        // fall through — this line is outside the block
      } else {
        lines[i] = quoteLineIfNeeded(line);
        continue;
      }
    }
  }

  return lines.join('\n');
}

/** Quote a single value string, escaping inner double-quotes and backslashes. */
function quoteValue(raw: string): string {
  return '"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Check if a bare value would be mangled by the YAML parser. */
function needsOperatorQuoting(value: string): boolean {
  if (/^["']/.test(value)) { return false; } // already quoted
  for (const op of YAML_UNSAFE_OPS) {
    if (value === op || value.startsWith(op + ' ')) {
      return true;
    }
  }
  return false;
}

/** If the value portion of a map entry or array item needs quoting, return the fixed line. */
function quoteLineIfNeeded(line: string): string {
  const trimmed = line.trimStart();
  // Map entry:  key: value
  const mapMatch = trimmed.match(/^([\w.]+:\s+)(.+)$/);
  if (mapMatch) {
    const [, prefix, value] = mapMatch;
    if (needsOperatorQuoting(value)) {
      const leadingWS = line.slice(0, line.length - trimmed.length);
      return leadingWS + prefix + quoteValue(value);
    }
    return line;
  }
  // Array item:  - value
  const arrayMatch = trimmed.match(/^(-\s+)(.+)$/);
  if (arrayMatch) {
    const [, prefix, value] = arrayMatch;
    if (needsOperatorQuoting(value)) {
      const leadingWS = line.slice(0, line.length - trimmed.length);
      return leadingWS + prefix + quoteValue(value);
    }
  }
  return line;
}

/**
 * Reorder the keys of an object according to a canonical order.
 * Keys present in `order` come first (in that order); remaining keys follow in original order.
 */
function reorderKeys(obj: Record<string, any>, order: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of order) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  for (const key of Object.keys(obj)) {
    if (!(key in result)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Reorder a single step's keys and recursively process nested steps. */
function reorderStep(step: any): any {
  if (!step || typeof step !== 'object') {
    return step;
  }
  const stepType = getTestFlowStepType(step as TestFlowStep);
  const order = STEP_KEY_ORDER[stepType];

  let ordered = order ? reorderKeys(step, order) : {...step};

  // Recursively reorder nested steps
  if (Array.isArray(ordered.steps)) {
    ordered.steps = reorderSteps(ordered.steps);
  }
  if (Array.isArray(ordered.else)) {
    ordered.else = reorderSteps(ordered.else);
  }

  // Reorder check/assert object-form values (ComparisonObject)
  if ((stepType === 'check' || stepType === 'assert') &&
      ordered[stepType] && typeof ordered[stepType] === 'object' &&
      !Array.isArray(ordered[stepType])) {
    ordered[stepType] = reorderKeys(ordered[stepType], CHECK_ASSERT_VALUE_ORDER);
  }

  return ordered;
}

/** Reorder keys for each step in a steps array. */
function reorderSteps(steps: any[]): any[] {
  return steps.map(reorderStep);
}

/** Reorder keys for each stage, including its nested steps. */
function reorderStages(stages: any[]): any[] {
  return stages.map(stage => {
    if (!stage || typeof stage !== 'object') {
      return stage;
    }
    const ordered = reorderKeys(stage, STAGE_KEY_ORDER);
    if (Array.isArray(ordered.steps)) {
      ordered.steps = reorderSteps(ordered.steps);
    }
    return ordered;
  });
}

export function yamlToTest(yamlContent: string): TestData {
  try {
    const doc = parseYaml(quoteExpectOperators(yamlContent)) as any;
    if (!doc || typeof doc !== 'object') {
      return {} as TestData;
    }
    // Backwards compatibility: allow legacy 'flow' key as alias for 'steps'
    if (!doc.steps && Array.isArray(doc.flow)) {
      doc.steps = doc.flow;
    }
    return {
      type: doc.type || '',
      title: doc.title || '',
      description: doc.description || '',
      tags: doc.tags,
      import: doc.import,
      inputs: doc.inputs,
      outputs: doc.outputs,
      steps: doc.steps,
      stages: doc.stages,
    };
  } catch {
    return {} as TestData;
  }
}

export function testToYaml(test: TestData): string {
  const yamlObj: Record<string, any> = {
    type: test.type,
  };
  if (test.title) {
    yamlObj.title = test.title;
  }
  if (test.description) {
    yamlObj.description = test.description;
  }
  if (isNonEmptyList(test.tags)) {
    yamlObj.tags = test.tags;
  };
  if (isNonEmptyObject(test.import)) {
    yamlObj.import = test.import;
  }
  if (isNonEmptyObject(test.inputs)) {
    yamlObj.inputs = test.inputs;
  }
  if (isNonEmptyObject(test.outputs)) {
    yamlObj.outputs = test.outputs;
  }
  if (test.steps) {
    yamlObj.steps = reorderSteps(test.steps);
  }
  if (test.stages) {
    yamlObj.stages = reorderStages(test.stages);
  }
  return packYaml(yamlObj);
}

export function getTestFlowStepType(step: TestFlowStep): FlowType|'unknown' {
  if (!step || typeof step !== 'object') {
    return 'unknown';
  }
  if ('stage' in step) {
    return 'stage';
  }
  if ('step' in step) {
    return 'step';
  }
  if ('call' in step) {
    return 'call';
  }
  if ('run' in step) {
    return 'run';
  }
  if ('check' in step) {
    return 'check';
  }
  if ('assert' in step) {
    return 'assert';
  }
  if ('if' in step) {
    return 'if';
  }
  if ('repeat' in step) {
    return 'repeat';
  }
  if ('delay' in step) {
    return 'delay' as FlowType;
  }
  if ('for' in step) {
    return 'for';
  }
  if ('js' in step) {
    return 'js';
  }
  if ('print' in step) {
    return 'print';
  }
  if ('data' in step) {
    return 'data' as FlowType;
  }
  if ('setenv' in step) {
    return 'setenv' as FlowType;
  }
  if ('set' in step) {
    return 'set';
  }
  if ('var' in step) {
    return 'var';
  }
  if ('const' in step) {
    return 'const';
  }
  if ('let' in step) {
    return 'let';
  }
  // Generic containers should be detected after specific control-steps
  if ('stages' in step) {
    return 'stages';
  }
  if ('steps' in step) {
    return 'steps';
  }
  return 'unknown';
}

/**
 * Parse a test YAML strictly: throws on YAML parse errors and validates
 * the resulting structure. Used in execution paths where errors must
 * be surfaced clearly.
 */
export function yamlToTestStrict(yamlContent: string): TestData {
  const doc = parseYamlStrict(quoteExpectOperators(yamlContent)) as any;
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid test file: YAML content is empty or not an object');
  }
  if (doc.type !== 'test') {
    throw new Error(`Invalid test file: expected type "test" but got "${doc.type || '(none)'}"`);
  }
  // Backwards compatibility: allow legacy 'flow' key as alias for 'steps'
  if (!doc.steps && Array.isArray(doc.flow)) {
    doc.steps = doc.flow;
  }
  // Check for unknown root-level keys
  const unknownRootKeys = Object.keys(doc).filter(k => !VALID_TEST_ROOT_KEYS.has(k));
  if (unknownRootKeys.length > 0) {
    throw new Error(`Invalid test file: unknown key(s): ${unknownRootKeys.map(k => `"${k}"`).join(', ')}`);
  }
  const test: TestData = {
    type: doc.type || '',
    title: doc.title || '',
    description: doc.description || '',
    tags: doc.tags,
    import: doc.import,
    inputs: doc.inputs,
    outputs: doc.outputs,
    steps: doc.steps,
    stages: doc.stages,
  };
  const errors = validateTestData(test);
  if (errors.length > 0) {
    throw new Error('Invalid test file:\n' + errors.map(e => `  - ${e}`).join('\n'));
  }
  return test;
}

/**
 * Validate parsed test data for structural errors.
 * Returns an array of error messages (empty if valid).
 */
export function validateTestData(test: TestData): string[] {
  const errors: string[] = [];
  const hasSteps = Array.isArray(test.steps);
  const hasStages = Array.isArray(test.stages) && test.stages.length > 0;
  const hasImports = test.import && Object.keys(test.import).length > 0;

  if (!hasSteps && !hasStages && !hasImports) {
    errors.push('Test has no "steps" or "stages" defined');
  }
  if (hasSteps && hasStages) {
    errors.push('Test cannot have both "steps" and "stages"');
  }

  const importKeys = new Set(Object.keys(test.import ?? {}));

  if (hasSteps && test.steps!.length > 0) {
    collectStepErrors(test.steps!, importKeys, errors, 'steps');
  }
  if (hasStages) {
    const validStageKeys = new Set(['id', 'title', 'condition', 'after', 'steps']);
    for (const stage of test.stages!) {
      if (!stage || typeof stage !== 'object') {
        errors.push('Stage entry is not a valid object');
        continue;
      }
      if (!stage.id) {
        errors.push('Stage is missing required "id" field');
      }
      const unknownStageKeys = Object.keys(stage).filter(k => !validStageKeys.has(k));
      if (unknownStageKeys.length > 0) {
        errors.push(`Stage "${stage.id || '?'}": unknown key(s): ${unknownStageKeys.map(k => `"${k}"`).join(', ')}`);
      }
      if (Array.isArray(stage.steps)) {
        collectStepErrors(stage.steps, importKeys, errors, `stage "${stage.id || '?'}"`);
      }
    }
  }

  return errors;
}

function collectStepErrors(
    steps: TestFlowSteps, importKeys: Set<string>,
    errors: string[], context: string): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepType = getTestFlowStepType(step);
    if (stepType === 'unknown') {
      const keys = step && typeof step === 'object' ? Object.keys(step).join(', ') : String(step);
      errors.push(`Unknown step type at ${context}[${i}] (keys: ${keys})`);
    }
    // Check for unknown keys in this step
    if (stepType !== 'unknown' && step && typeof step === 'object') {
      const allowed = VALID_STEP_KEYS[stepType];
      if (allowed) {
        const unknownKeys = Object.keys(step).filter(k => !allowed.has(k));
        if (unknownKeys.length > 0) {
          errors.push(`Step ${context}[${i}] (${stepType}): unknown key(s): ${unknownKeys.map(k => `"${k}"`).join(', ')}`);
        }
      }
    }
    if (stepType === 'call') {
      const callStep = step as any;
      const alias = callStep.call;
      if (typeof alias !== 'string' || !alias.trim()) {
        errors.push(`Step ${context}[${i}]: "call" must be a non-empty string`);
      } else if (!importKeys.has(alias)) {
        errors.push(`Step ${context}[${i}]: call target "${alias}" is not imported`);
      }
    }
    // Recurse into nested steps
    const s = step as any;
    if (Array.isArray(s?.steps)) {
      collectStepErrors(s.steps, importKeys, errors, `${context}[${i}].steps`);
    }
    if (Array.isArray(s?.else)) {
      collectStepErrors(s.else, importKeys, errors, `${context}[${i}].else`);
    }
  }
}