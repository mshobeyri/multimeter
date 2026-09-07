import {APIData} from './APIData';
import {JSONRecord, JSONValue} from './CommonData';
import {safeStepIdFromAlias, slugToCamel, slugValue} from './identifierUtils';
import {ExpectMap, TestData, TestFlowStep} from './TestData';

export type ScaffoldStrategy = 'smoke' | 'example';

export interface ScaffoldTestFromApiOptions {
  alias: string;
  importPath: string;
  strategy?: ScaffoldStrategy;
}

export interface ApiDetailsSummary {
  filePath: string;
  title: string;
  method?: string;
  url?: string;
  protocol?: string;
  inputs: JSONRecord;
  outputs?: Record<string, string>;
  examples?: APIData['examples'];
  suggestedAlias: string;
  suggestedImportPath: string;
  suggestedTestPath: string;
}

function splitPath(filePath: string): string[] {
  const raw = filePath
      .replace(/\\/g, '/')
      .split('/')
      .filter(part => part.length > 0);
  const out: string[] = [];
  for (const part of raw) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else {
        out.push('..');
      }
      continue;
    }
    out.push(part);
  }
  return out;
}

function basename(filePath: string): string {
  const parts = splitPath(filePath);
  const last = parts[parts.length - 1] || 'item';
  return last.replace(/\.mmt$/i, '');
}

function dirname(filePath: string): string {
  const parts = splitPath(filePath);
  if (parts.length <= 1) {
    return '.';
  }
  return parts.slice(0, -1).join('/');
}

function joinPath(...segments: string[]): string {
  return segments
      .flatMap(segment => segment.replace(/\\/g, '/').split('/'))
      .filter(Boolean)
      .join('/');
}

function toPosixRelative(fromDir: string, toFile: string): string {
  const fromParts = splitPath(fromDir);
  const toParts = splitPath(toFile);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }
  const up = fromParts.length - common;
  const relParts = [
    ...Array.from({length: up}, () => '..'),
    ...toParts.slice(common),
  ];
  if (relParts.length === 0) {
    return `./${toParts[toParts.length - 1] || 'file.mmt'}`;
  }
  const rel = relParts.join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

export function suggestAliasFromPath(apiPath: string): string {
  return slugToCamel(basename(apiPath));
}

export {safeStepIdFromAlias} from './identifierUtils';

export function suggestTestPath(apiPath: string): string {
  const slug = slugValue(basename(apiPath));
  const apiDir = dirname(apiPath);
  return joinPath(dirname(apiDir), 'tests', `${slug}-smoke.mmt`);
}

export function buildApiDetailsSummary(
    apiPath: string, api: APIData, testPath?: string): ApiDetailsSummary {
  const resolvedTestPath = testPath || suggestTestPath(apiPath);
  const alias = suggestAliasFromPath(apiPath);
  const testDir = dirname(resolvedTestPath);
  return {
    filePath: apiPath,
    title: api.title || basename(apiPath),
    method: api.method,
    url: api.url,
    protocol: api.protocol,
    inputs: api.inputs || {},
    outputs: api.outputs,
    examples: api.examples,
    suggestedAlias: alias,
    suggestedImportPath: toPosixRelative(testDir, apiPath),
    suggestedTestPath: resolvedTestPath,
  };
}

function stringifyTestInputs(inputs: JSONRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (value === null) {
      out[key] = 'null';
    } else if (typeof value === 'object') {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function isInputToken(value: JSONValue): boolean {
  return typeof value === 'string' && /^i:[A-Za-z0-9_]+$/.test(value.trim());
}

function defaultTestInputs(api: APIData, strategy: ScaffoldStrategy): JSONRecord {
  if (strategy === 'example' && api.examples && api.examples.length > 0) {
    const first = api.examples[0];
    if (first?.inputs && typeof first.inputs === 'object') {
      return {...first.inputs};
    }
  }
  const out: JSONRecord = {};
  for (const [key, value] of Object.entries(api.inputs || {})) {
    if (isInputToken(value)) {
      out[key] = value;
      continue;
    }
    out[key] = `i:${key}`;
  }
  return out;
}

function callInputsForStep(testInputs: JSONRecord): Record<string, JSONValue> {
  const out: Record<string, JSONValue> = {};
  for (const key of Object.keys(testInputs)) {
    out[key] = `i:${key}`;
  }
  return out;
}

function defaultStatusExpect(method?: string): number {
  const m = (method || 'get').toLowerCase();
  if (m === 'post') {
    return 200;
  }
  if (m === 'delete') {
    return 200;
  }
  return 200;
}

function buildExpectMap(api: APIData): ExpectMap {
  const expect: ExpectMap = {
    status: defaultStatusExpect(api.method),
  };
  for (const outputKey of Object.keys(api.outputs || {})) {
    expect[outputKey] = '!= null';
  }
  return expect;
}

function smokeTags(api: APIData): string[] {
  const tags = new Set<string>(['smoke']);
  if (api.method) {
    tags.add(api.method.toLowerCase());
  }
  if (api.tags && api.tags.length > 0) {
    tags.add(api.tags[0]);
  }
  return Array.from(tags);
}

export function scaffoldTestFromApi(
    api: APIData, options: ScaffoldTestFromApiOptions): TestData {
  const strategy = options.strategy || 'smoke';
  const alias = options.alias;
  const stepId = safeStepIdFromAlias(alias);
  const testInputs = defaultTestInputs(api, strategy);
  const callStep: TestFlowStep = {
    call: alias,
    id: stepId,
    inputs: callInputsForStep(testInputs),
    expect: buildExpectMap(api),
  };
  const title = `${api.title || alias} smoke test`;
  return {
    type: 'test',
    title,
    description: `Smoke test for API "${api.title || alias}".`,
    tags: smokeTags(api),
    import: {
      [alias]: options.importPath,
    },
    inputs: stringifyTestInputs(testInputs),
    steps: [callStep],
  };
}
