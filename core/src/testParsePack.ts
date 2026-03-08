import parseYaml, {packYaml} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject} from './safer';
import {FlowType, TestData, TestFlowStep, TestFlowSteps, TestFlowStages} from './TestData';

/**
 * Canonical key orders for each step type.
 * Keys not listed here are appended in original order after the canonical ones.
 */
export const STEP_KEY_ORDER: Record<string, string[]> = {
  call:   ['call', 'id', 'title', 'inputs', 'check', 'assert', 'report'],
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

/** Canonical key order for stage items. */
export const STAGE_KEY_ORDER = ['id', 'title', 'condition', 'depends_on', 'steps'];

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
    const doc = parseYaml(yamlContent) as any;
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
      metrics: doc.metrics,
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
    title: test.title,
  };
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
  if (isNonEmptyObject(test.metrics)) {
    yamlObj.metrics = test.metrics;
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