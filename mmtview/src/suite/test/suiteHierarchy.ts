import { SuiteImportDocType } from './suiteImportTree';

export type SuiteHierarchyNode =
  | { kind: 'group'; label: string; children: SuiteHierarchyNode[] }
  | { kind: 'suite'; path: string; groups: SuiteHierarchyNode[] }
  | { kind: 'test'; path: string }
  | { kind: 'other'; path: string; docType: SuiteImportDocType }
  | { kind: 'missing'; path: string }
  | { kind: 'error'; path: string; message: string }
  | { kind: 'cycle'; path: string };

export type SuiteImportLookup = Record<
  string,
  { docType: SuiteImportDocType; tests?: readonly string[]; cycle?: boolean; error?: string }
>;

const splitSuiteGroups = (tests: readonly string[]): string[][] => {
  const groups: string[][] = [];
  let current: string[] = [];
  const push = () => {
    if (current.length) {
      groups.push(current);
      current = [];
    }
  };
  for (const raw of tests) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed === 'then') {
      push();
      continue;
    }
    current.push(trimmed);
  }
  push();
  return groups;
};

export function buildSuiteHierarchy(params: {
  rootEntries: string[];
  lookup: SuiteImportLookup;
}): SuiteHierarchyNode[] {
  const { rootEntries, lookup } = params;

  const rootGroups = splitSuiteGroups(rootEntries);
  return rootGroups.map((entries, gi) => {
    const children: SuiteHierarchyNode[] = entries
      .filter((p) => typeof p === 'string' && p.trim())
      .map((p) => buildEntryNode(p, lookup));
    return { kind: 'group', label: `Group ${gi + 1}`, children };
  });
}

function buildEntryNode(path: string, lookup: SuiteImportLookup): SuiteHierarchyNode {
  const info = lookup[path];
  if (!info) {
    return { kind: 'other', path, docType: 'unknown' };
  }
  if (info.error) {
    return { kind: 'error', path, message: info.error };
  }
  if (info.cycle) {
    return { kind: 'cycle', path };
  }
  if (info.docType === 'missing') {
    return { kind: 'missing', path };
  }
  if (info.docType === 'test') {
    return { kind: 'test', path };
  }
  if (info.docType !== 'suite') {
    return { kind: 'other', path, docType: info.docType };
  }

  const groups = splitSuiteGroups(info.tests ?? []);
  const groupNodes: SuiteHierarchyNode[] = groups.map((entries, gi) => {
    const children = entries.map((p) => buildEntryNode(p, lookup));
    return { kind: 'group', label: `Group ${gi + 1}`, children };
  });

  return { kind: 'suite', path, groups: groupNodes };
}
