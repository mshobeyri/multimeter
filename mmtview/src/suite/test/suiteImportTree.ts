export type SuiteImportDocType = 'suite' | 'test' | 'api' | 'env' | 'doc' | 'unknown' | 'missing';

export type SuiteImportTreeNode = {
  id: string;
  path: string;
  docType: SuiteImportDocType;
  cycle?: boolean;
  error?: string;
  children?: SuiteImportTreeNode[];
  kind?: 'suite-file' | 'group' | 'suite-info';
  // Only on suite nodes.
  tests?: string[];
  groups?: string[][];
};

export type SuiteImportTreeResult = {
  results: Record<string, { path: string; docType: SuiteImportDocType; tests?: string[]; cycle?: boolean; error?: string }>;
};

const stableIdFor = (kind: string, key: string) => `suite-import-node:${kind}:${key}`;

export const createNode = (path: string, docType: SuiteImportDocType): SuiteImportTreeNode => ({
  id: stableIdFor('path', path),
  path,
  docType,
});

export const createGroupNode = (parentPath: string, groupIndex: number): SuiteImportTreeNode => ({
  id: stableIdFor('group', `${parentPath}#${groupIndex}`),
  path: `Group ${groupIndex + 1}`,
  docType: 'unknown',
  children: [],
});

export const splitSuiteGroups = (tests: string[]): string[][] => {
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

export const buildSuiteInfoChildren = (suitePath: string, groups: string[][]): SuiteImportTreeNode[] => {
  const suiteInfoNode: SuiteImportTreeNode = {
    id: `suite-import-node:suite-info:${suitePath}`,
    path: 'Suite info',
    docType: 'unknown',
    kind: 'suite-info',
  };
  const groupNodes = groups.map((_, gi) => {
    const n = createGroupNode(suitePath, gi);
    n.kind = 'group';
    return n;
  });
  return [suiteInfoNode, ...groupNodes];
};
