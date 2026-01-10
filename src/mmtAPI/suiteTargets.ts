import {markupConvertor} from 'mmt-core';

const {parseYaml, packYaml} = markupConvertor as any;

const TEST_ID_PATTERN = /^\d+:\d+$/;

type ParsedSuite = {
  doc: any;
  groups: string[][];
};

function parseSuite(rawSuite: string): ParsedSuite|null {
  let doc: any;
  try {
    doc = parseYaml(rawSuite) || {};
  } catch {
    return null;
  }
  if (!doc || doc.type !== 'suite') {
    return null;
  }
  const rawTests = Array.isArray(doc.tests) ? doc.tests : [];
  if (!rawTests.length) {
    return null;
  }
  const groups: string[][] = [];
  let current: string[] = [];
  const flushGroup = () => {
    if (current.length === 0) {
      throw new Error('invalid suite group');
    }
    groups.push(current);
    current = [];
  };
  try {
    for (const raw of rawTests) {
      if (typeof raw !== 'string') {
        continue;
      }
      const entry = raw.trim();
      if (!entry) {
        continue;
      }
      if (entry === 'then') {
        flushGroup();
        continue;
      }
      current.push(entry);
    }
    if (current.length === 0) {
      throw new Error('suite cannot end with then');
    }
    groups.push(current);
  } catch {
    return null;
  }
  return {doc, groups};
}

export function buildFilteredSuiteYaml(
    rawSuite: string, targets: string[]): string {
  const normalized = Array.isArray(targets) ? targets : [];
  const allowed = normalized
                     .map(t => (typeof t === 'string' ? t.trim() : ''))
                     .filter(t => TEST_ID_PATTERN.test(t));
  if (!allowed.length) {
    return rawSuite;
  }
  const parsed = parseSuite(rawSuite);
  if (!parsed) {
    return rawSuite;
  }
  const uniqueTargets = new Set(allowed);
  const selectedGroups: Array<{index: number; entries: string[]}> = [];
  parsed.groups.forEach((group, gi) => {
    const entries: string[] = [];
    group.forEach((entry, ei) => {
      const testId = `${gi}:${ei}`;
      if (uniqueTargets.has(testId)) {
        entries.push(entry);
      }
    });
    if (entries.length) {
      selectedGroups.push({index: gi, entries});
    }
  });
  if (!selectedGroups.length) {
    return rawSuite;
  }
  const rebuilt: string[] = [];
  selectedGroups.sort((a, b) => a.index - b.index).forEach((group, idx) => {
    if (idx > 0) {
      rebuilt.push('then');
    }
    rebuilt.push(...group.entries);
  });
  const nextDoc = {...parsed.doc, tests: rebuilt};
  try {
    return packYaml(nextDoc);
  } catch {
    return rawSuite;
  }
}
