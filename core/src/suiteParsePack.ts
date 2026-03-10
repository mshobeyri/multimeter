import YAML from 'yaml';
import {SuiteData, SuiteEnvironment} from './SuiteData';

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
  // Return undefined if no fields are set
  if (!result.preset && !result.file && !result.variables) {
    return undefined;
  }
  return result;
}

export function yamlToSuite(rawYaml: string): SuiteData {
  const doc = YAML.parse(rawYaml || '') || {};
  const type = typeof doc?.type === 'string' ? doc.type : '';
  if (type !== 'suite') {
    throw new Error('Not a suite document');
  }

  const tests = intoStringArray(doc.tests);
  if (tests.length === 0) {
    throw new Error('Suite.tests must be a non-empty array');
  }

  const tags = Array.isArray(doc.tags) ? doc.tags.filter((t: any) => typeof t === 'string').map((t: string) => t.trim()).filter(Boolean) : undefined;

  const environment = parseEnvironment(doc);
  const exportPaths = intoStringArray(doc.export);

  const suite: SuiteData = {
    type: 'suite',
    title: typeof doc.title === 'string' ? doc.title : undefined,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    tags,
    servers: intoStringArray(doc.servers).length > 0 ? intoStringArray(doc.servers) : undefined,
    tests,
    environment,
    export: exportPaths.length > 0 ? exportPaths : undefined,
  };

  return suite;
}

export function suiteToYaml(suite: SuiteData): string {
  const yamlObj: Record<string, any> = {
    type: suite.type,
  };
  if (suite.title) {
    yamlObj.title = suite.title;
  }
  if (suite.description) {
    yamlObj.description = suite.description;
  }
  if (suite.tags && suite.tags.length > 0) {
    yamlObj.tags = suite.tags;
  }
  // Canonical order: environment, servers, export, tests
  if (suite.environment) {
    const env: Record<string, any> = {};
    if (suite.environment.preset) {
      env.preset = suite.environment.preset;
    }
    if (suite.environment.file) {
      env.file = suite.environment.file;
    }
    if (suite.environment.variables && Object.keys(suite.environment.variables).length > 0) {
      env.variables = suite.environment.variables;
    }
    if (Object.keys(env).length > 0) {
      yamlObj.environment = env;
    }
  }
  if (suite.servers && suite.servers.length > 0) {
    yamlObj.servers = suite.servers;
  }
  if (suite.export && suite.export.length > 0) {
    yamlObj.export = suite.export;
  }
  yamlObj.tests = suite.tests;
  return YAML.stringify(yamlObj, { lineWidth: 0 });
}

export function splitSuiteGroups(items: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) {
      throw new Error('Suite.tests contains an empty group (misplaced "then")');
    }
    groups.push(current);
    current = [];
  };

  for (const raw of items || []) {
    const item = (raw || '').trim();
    if (!item) {
      continue;
    }
    if (item === 'then') {
      flush();
      continue;
    }
    current.push(item);
  }

  if (current.length === 0) {
    throw new Error('Suite.tests cannot end with "then"');
  }
  groups.push(current);
  return groups;
}
