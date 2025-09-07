
import parseYaml, {packYaml} from '../markupConvertor';

import {TestData} from './TestData';

export function yamlToTest(yamlContent: string): TestData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== 'object') {
      return {} as TestData;
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
