import parseYaml, { packYaml } from './markupConvertor';
import { FlowType, TestData, TestFlowStep } from './TestData';

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
      tags: doc.tags || [],
      description: doc.description || '',
      import: doc.import,
      metrics: doc.metrics,
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
    title: test.title,
    tags: test.tags,
  };
  if (test.description) {
    yamlObj.description = test.description;
  }
  if (test.import) {
    yamlObj.import = test.import;
  }
  if (test.inputs) {
    yamlObj.inputs = test.inputs;
  }
  if (test.outputs) {
    yamlObj.outputs = test.outputs;
  }
  if (test.metrics) {
    yamlObj.metrics = test.metrics;
  }
  if (test.steps) {
    yamlObj.steps = test.steps;
  }
  if (test.stages) {
    yamlObj.stages = test.stages;
  }
  return packYaml(yamlObj);
}

export function getTestFlowStepType(step: TestFlowStep): FlowType | 'unknown' {
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