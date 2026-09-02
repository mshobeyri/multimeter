import {APIData, ExampleData} from './APIData';
import {resolveApiHttpMethod} from './apiMethod';
import {JSONRecord} from './CommonData';
import {apiToYaml} from './apiParsePack';
import {parseYamlDoc} from './markupConvertor';
import {TestFlowHttp} from './TestData';
import {collectInputRefsFromObject} from './variableReplacer';
import {yamlToTest} from './testParsePack';

export type HttpStepApiPreviewOptions = {
  /** Test-level `inputs` defaults; used to copy `i:` refs into the API. */
  testInputs?: JSONRecord;
};

/**
 * Build a temporary `type: api` document from an inline HTTP test step.
 * - `expect` fields become `outputs` (path → path) and an example with expected values.
 * - `e:` tokens are left as-is.
 * - `i:` refs are copied into `inputs` using test-level defaults when present.
 */
export function buildApiPreviewFromHttpStep(
    step: TestFlowHttp,
    options?: HttpStepApiPreviewOptions): APIData {
  const outputs: Record<string, string> = {};
  for (const [name, pathExpr] of Object.entries(step.outputs || {})) {
    if (typeof pathExpr === 'string' && pathExpr.trim()) {
      outputs[name] = pathExpr;
    }
  }

  const exampleOutputs: JSONRecord = {};
  const expectMap = step.expect;
  if (expectMap) {
    for (const [field, rawValue] of Object.entries(expectMap)) {
      if (!field) {
        continue;
      }
      const outputName = resolveOutputNameForExpectField(outputs, field);
      if (!outputs[outputName]) {
        outputs[outputName] = field;
      }
      exampleOutputs[outputName] = pickExpectExampleValue(rawValue);
    }
  }

  const inputs = collectInputsForHttpStep(step, options?.testInputs);

  const examples: ExampleData[]|undefined =
      Object.keys(exampleOutputs).length > 0 ?
      [{
        name: step.title || step.id || 'from-expect',
        ...(Object.keys(inputs).length > 0 ? {inputs: {...inputs}} : {}),
        outputs: exampleOutputs,
      }] :
      undefined;

  const api: APIData = {
    type: 'api',
    title: step.title || step.id || undefined,
    ...(Object.keys(inputs).length > 0 ? {inputs} : {}),
    ...(Object.keys(outputs).length > 0 ? {outputs} : {}),
    url: step.http || '',
    query: step.query,
    protocol: 'http',
    format: step.format,
    method: resolveApiHttpMethod(step.method, step.body),
    timeout: step.timeout,
    headers: step.headers,
    body: step.body,
    ...(examples ? {examples} : {}),
  };
  return api;
}

export function httpStepToApiPreviewYaml(
    step: TestFlowHttp,
    options?: HttpStepApiPreviewOptions): string {
  return apiToYaml(buildApiPreviewFromHttpStep(step, options));
}

/**
 * Prefer an existing named output whose extraction path matches the expect field.
 * Otherwise use the expect field path itself as the output name.
 */
export function resolveOutputNameForExpectField(
    outputs: Record<string, string>,
    expectField: string): string {
  for (const [name, pathExpr] of Object.entries(outputs)) {
    if (pathExpr === expectField) {
      return name;
    }
  }
  return expectField;
}

/** Keep operator-prefixed expect values (e.g. `!= null`) as the example RHS. */
export function pickExpectExampleValue(rawValue: unknown): any {
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    return rawValue[0];
  }
  return rawValue as any;
}

export function collectInputsForHttpStep(
    step: TestFlowHttp,
    testInputs?: JSONRecord): JSONRecord {
  const refs = collectInputRefsFromObject({
    http: step.http,
    query: step.query,
    headers: step.headers,
    body: step.body,
    title: step.title,
  });
  if (refs.length === 0) {
    return {};
  }
  const inputs: JSONRecord = {};
  const defaults = testInputs && typeof testInputs === 'object' ? testInputs : {};
  for (const name of refs) {
    if (Object.prototype.hasOwnProperty.call(defaults, name)) {
      inputs[name] = defaults[name];
    } else {
      inputs[name] = '';
    }
  }
  return inputs;
}

export type HttpStepAtPosition = {
  step: TestFlowHttp;
  /** 1-based line of the `http:` URL value (for underline). */
  urlLine: number;
  urlStartColumn: number;
  urlEndColumn: number;
};

/**
 * Find an HTTP step whose `http:` URL value contains the cursor (1-based line/column).
 */
export function findHttpStepAtPosition(
    content: string,
    lineNumber: number,
    column: number): HttpStepAtPosition|null {
  if (!content || lineNumber < 1) {
    return null;
  }
  const doc = parseYamlDoc(content);
  if (!doc || doc.errors?.length) {
    // Still try: some operator-quoting paths leave residual errors filtered already
  }
  const rootItems: any[] =
      Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const typePair = rootItems.find((item) => item?.key?.value === 'type');
  const typeValue = typePair?.value?.value;
  if (typeValue !== 'test') {
    return null;
  }

  const candidates: Array<{node: any; stepJs: any}> = [];
  const stepsPair = rootItems.find((item) => item?.key?.value === 'steps');
  collectHttpStepNodes(stepsPair?.value, candidates);
  const stagesPair = rootItems.find((item) => item?.key?.value === 'stages');
  collectHttpStepNodesFromStages(stagesPair?.value, candidates);

  for (const {node, stepJs} of candidates) {
    if (!stepJs || typeof stepJs !== 'object' || typeof stepJs.http !== 'string') {
      continue;
    }
    const httpPair = findMapPair(node, 'http');
    const valueNode = httpPair?.value;
    const range = Array.isArray(valueNode?.range) ? valueNode.range : null;
    if (!range || typeof range[0] !== 'number' || typeof range[1] !== 'number') {
      continue;
    }
    const start = offsetToLineCol(content, range[0]);
    const end = offsetToLineCol(content, range[1]);
    if (lineNumber < start.line || lineNumber > end.line) {
      continue;
    }
    if (lineNumber === start.line && column < start.column) {
      continue;
    }
    if (lineNumber === end.line && column > end.column) {
      continue;
    }
    return {
      step: stepJs as TestFlowHttp,
      urlLine: start.line,
      urlStartColumn: start.column,
      urlEndColumn: end.column,
    };
  }

  return null;
}

/**
 * Build preview YAML for the HTTP step under the cursor, or null if none.
 */
export function httpStepApiPreviewYamlAtPosition(
    content: string,
    lineNumber: number,
    column: number): string|null {
  const hit = findHttpStepAtPosition(content, lineNumber, column);
  if (!hit) {
    return null;
  }
  const test = yamlToTest(content);
  return httpStepToApiPreviewYaml(hit.step, {
    testInputs: test?.inputs as JSONRecord|undefined,
  });
}

function collectHttpStepNodesFromStages(
    stagesNode: any,
    out: Array<{node: any; stepJs: any}>): void {
  if (!stagesNode || !Array.isArray(stagesNode.items)) {
    return;
  }
  for (const stageItem of stagesNode.items) {
    const stepsPair = findMapPair(stageItem, 'steps');
    collectHttpStepNodes(stepsPair?.value, out);
  }
}

function collectHttpStepNodes(
    stepsNode: any,
    out: Array<{node: any; stepJs: any}>): void {
  if (!stepsNode || !Array.isArray(stepsNode.items)) {
    return;
  }
  for (const item of stepsNode.items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const httpPair = findMapPair(item, 'http');
    if (httpPair) {
      let stepJs: any;
      try {
        stepJs = item.toJSON ? item.toJSON() : null;
      } catch {
        stepJs = null;
      }
      if (stepJs && typeof stepJs.http === 'string') {
        out.push({node: item, stepJs});
      }
    }
    // Nested flows
    const nestedSteps = findMapPair(item, 'steps');
    collectHttpStepNodes(nestedSteps?.value, out);
    const elseSteps = findMapPair(item, 'else');
    collectHttpStepNodes(elseSteps?.value, out);
  }
}

function findMapPair(mapNode: any, key: string): any|null {
  if (!mapNode || !Array.isArray(mapNode.items)) {
    return null;
  }
  return mapNode.items.find((pair: any) => pair?.key?.value === key) ?? null;
}

function offsetToLineCol(content: string, offset: number): {line: number; column: number} {
  const pre = content.slice(0, Math.max(0, offset));
  const lines = pre.split(/\n/);
  const line = lines.length;
  const column = (lines[lines.length - 1] || '').length + 1;
  return {line, column};
}

/** Suggested untitled filename for a preview API. */
export function suggestHttpStepApiFilename(step: TestFlowHttp): string {
  const base = (step.id || step.title || 'http-step')
                   .toLowerCase()
                   .replace(/[^a-z0-9]+/g, '-')
                   .replace(/^-+|-+$/g, '')
                   .slice(0, 40) ||
      'http-step';
  return `${base}.mmt`;
}

export function listHttpStepUrlLinkRanges(content: string): Array<{
  line: number;
  startColumn: number;
  endColumn: number;
}> {
  const doc = parseYamlDoc(content);
  const rootItems: any[] =
      Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const typePair = rootItems.find((item) => item?.key?.value === 'type');
  if (typePair?.value?.value !== 'test') {
    return [];
  }
  const candidates: Array<{node: any; stepJs: any}> = [];
  const stepsPair = rootItems.find((item) => item?.key?.value === 'steps');
  collectHttpStepNodes(stepsPair?.value, candidates);
  const stagesPair = rootItems.find((item) => item?.key?.value === 'stages');
  collectHttpStepNodesFromStages(stagesPair?.value, candidates);

  const ranges: Array<{line: number; startColumn: number; endColumn: number}> = [];
  for (const {node, stepJs} of candidates) {
    if (!stepJs || typeof stepJs.http !== 'string') {
      continue;
    }
    const httpPair = findMapPair(node, 'http');
    const valueNode = httpPair?.value;
    const range = Array.isArray(valueNode?.range) ? valueNode.range : null;
    if (!range || typeof range[0] !== 'number' || typeof range[1] !== 'number') {
      continue;
    }
    const start = offsetToLineCol(content, range[0]);
    const end = offsetToLineCol(content, range[1]);
    ranges.push({
      line: start.line,
      startColumn: start.column,
      endColumn: end.column,
    });
  }
  return ranges;
}
