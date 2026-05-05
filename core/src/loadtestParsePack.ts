import YAML from 'yaml';
import {LoadTestData} from './LoadTestData';
import {SuiteEnvironment} from './SuiteData';

function intoStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(v => (typeof v === 'string' ? v.trim() : String(v)))
    .filter(v => v.length > 0);
}

function parseEnvironment(doc: any): SuiteEnvironment | undefined {
  const env = doc?.environment;
  if (!env || typeof env !== 'object') {
    return undefined;
  }
  const result: SuiteEnvironment = {};
  if (typeof env.preset === 'string' && env.preset.trim()) {
    result.preset = env.preset.trim();
  }
  if (typeof env.file === 'string' && env.file.trim()) {
    result.file = env.file.trim();
  }
  if (env.variables && typeof env.variables === 'object' && !Array.isArray(env.variables)) {
    result.variables = {...env.variables};
  }
  if (!result.preset && !result.file && !result.variables) {
    return undefined;
  }
  return result;
}

export function yamlToLoadTest(rawYaml: string): LoadTestData {
  const doc = YAML.parse(rawYaml || '') || {};
  const type = typeof doc?.type === 'string' ? doc.type : '';
  if (type !== 'loadtest') {
    throw new Error('Not a loadtest document');
  }

  const test = typeof doc.test === 'string' ? doc.test.trim() : '';
  if (!test) {
    throw new Error('Loadtest.test must be a non-empty string');
  }
  const repeat = typeof doc.repeat === 'number' || typeof doc.repeat === 'string' ? doc.repeat : undefined;
  if (repeat === undefined || (typeof repeat === 'string' && !repeat.trim())) {
    throw new Error('Loadtest.repeat is required and must be a number or duration string');
  }

  const tags = Array.isArray(doc.tags)
    ? doc.tags.filter((t: any) => typeof t === 'string').map((t: string) => t.trim()).filter(Boolean)
    : undefined;
  const environment = parseEnvironment(doc);
  const exportPaths = intoStringArray(doc.export);

  const loadtest: LoadTestData = {
    type: 'loadtest',
    title: typeof doc.title === 'string' ? doc.title : undefined,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    tags,
    test,
    threads: typeof doc.threads === 'number' ? doc.threads : 1,
    repeat,
    rampup: typeof doc.rampup === 'string' ? doc.rampup : '0s',
    environment,
    export: exportPaths.length > 0 ? exportPaths : undefined,
  };

  return loadtest;
}

export function loadtestToYaml(loadtest: LoadTestData): string {
  const yamlObj: Record<string, any> = {
    type: loadtest.type,
  };
  if (loadtest.title) {
    yamlObj.title = loadtest.title;
  }
  if (loadtest.description) {
    yamlObj.description = loadtest.description;
  }
  if (loadtest.tags && loadtest.tags.length > 0) {
    yamlObj.tags = loadtest.tags;
  }
  if (loadtest.environment) {
    const env: Record<string, any> = {};
    if (loadtest.environment.preset) {
      env.preset = loadtest.environment.preset;
    }
    if (loadtest.environment.file) {
      env.file = loadtest.environment.file;
    }
    if (loadtest.environment.variables && Object.keys(loadtest.environment.variables).length > 0) {
      env.variables = loadtest.environment.variables;
    }
    if (Object.keys(env).length > 0) {
      yamlObj.environment = env;
    }
  }
  if (typeof loadtest.threads === 'number' && loadtest.threads !== 1) {
    yamlObj.threads = loadtest.threads;
  }
  yamlObj.repeat = loadtest.repeat;
  if (loadtest.rampup && loadtest.rampup !== '0s') {
    yamlObj.rampup = loadtest.rampup;
  }
  if (loadtest.export && loadtest.export.length > 0) {
    yamlObj.export = loadtest.export;
  }
  yamlObj.test = loadtest.test;
  return YAML.stringify(yamlObj, {lineWidth: 0});
}