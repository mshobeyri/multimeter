import YAML from 'yaml';
import {SuiteData} from './SuiteData';

function intoStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
      .map(v => (typeof v === 'string' ? v.trim() : String(v)))
      .filter(v => v.length > 0);
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

  const suite: SuiteData = {
    type: 'suite',
    title: typeof doc.title === 'string' ? doc.title : undefined,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    tags,
    servers: intoStringArray(doc.servers).length > 0 ? intoStringArray(doc.servers) : undefined,
    tests,
  };

  return suite;
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
