import { SuiteImportDocType } from './suiteImportTree';

export type SuiteFileReader = (path: string) => string | undefined;

export type SuiteHierarchyNode =
  | { kind: 'group'; label: string; children: SuiteHierarchyNode[] }
  | { kind: 'suite'; path: string; groups: SuiteHierarchyNode[] }
  | { kind: 'test'; path: string }
  | { kind: 'ignore' }
  | { kind: 'missing'; path: string }
  | { kind: 'error'; path: string; message: string }
  | { kind: 'cycle'; path: string };

export type SuiteImportLookup = Record<
  string,
  { type: SuiteImportDocType; tests?: readonly string[]; cycle?: boolean; error?: string }
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
  resolve?: (path: string) => { type: SuiteImportDocType; tests?: readonly string[]; cycle?: boolean; error?: string } | undefined;
}): SuiteHierarchyNode[] {
  const { rootEntries, lookup, resolve } = params;

  const rootGroups = splitSuiteGroups(rootEntries);

  // Rule: if a suite has only one group, don't return a group wrapper.
  if (rootGroups.length === 1) {
    return rootGroups[0]
      .filter((p) => typeof p === 'string' && p.trim())
      .map((p) => buildEntryNode(p, lookup, resolve, new Set()))
      .filter((n) => n.kind !== 'ignore');
  }

  return rootGroups.map((entries, gi) => {
    const children: SuiteHierarchyNode[] = entries
      .filter((p) => typeof p === 'string' && p.trim())
      .map((p) => buildEntryNode(p, lookup, resolve, new Set()));
    return { kind: 'group', label: `Group ${gi + 1}`, children: children.filter((n) => n.kind !== 'ignore') };
  });
}

export function buildSuiteHierarchyFromYaml(params: {
  suitePath: string;
  suiteYaml: string;
  readFile: SuiteFileReader;
}): SuiteHierarchyNode[] {
  const { suitePath, suiteYaml, readFile } = params;

  const parseSuiteEntries = (yaml: string): string[] => {
    const lines = String(yaml ?? '').split(/\r?\n/);
    const entries: string[] = [];
    let inTests = false;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\t/g, '    ');
      const trimmed = line.trim();

      if (!inTests) {
        if (/^tests\s*:/.test(trimmed)) {
          inTests = true;
        }
        continue;
      }

      if (!trimmed) {
        continue;
      }
      if (!/^\s*-\s+/.test(line)) {
        break;
      }

      const item = trimmed.replace(/^[-]\s+/, '').trim();
      if (!item) {
        continue;
      }
      entries.push(item);
    }

    return entries;
  };

  const detectDocType = (yaml: string): SuiteImportDocType => {
    const firstLine = String(yaml ?? '').split(/\r?\n/)[0]?.trim() ?? '';
    const m = firstLine.match(/^type\s*:\s*(\w+)/);
    return (m?.[1] ?? 'unknown') as SuiteImportDocType;
  };

  const suiteYamlByPath = new Map<string, string>();
  suiteYamlByPath.set(suitePath, suiteYaml);

  const suiteStack = new Set<string>();
  suiteStack.add(suitePath);

  const normalizeEntry = (raw: string) => String(raw ?? '').trim();

  const buildNodesFromEntries = (entries: string[]): SuiteHierarchyNode[] => {
    const groups = splitSuiteGroups(entries);
    if (groups.length === 1) {
      return groups[0]
        .map((p) => buildNodeFromPath(normalizeEntry(p)))
        .filter((n) => n.kind !== 'ignore');
    }
    return groups.map((g, gi) => {
      const children = g
        .map((p) => buildNodeFromPath(normalizeEntry(p)))
        .filter((n) => n.kind !== 'ignore');
      return { kind: 'group', label: `Group ${gi + 1}`, children };
    });
  };

  const buildNodeFromPath = (path: string): SuiteHierarchyNode => {
    if (!path) {
      return { kind: 'ignore' };
    }
    if (path === 'then') {
      return { kind: 'ignore' };
    }

    const raw = readFile(path);
    if (raw === undefined) {
      return { kind: 'missing', path };
    }

    const type = detectDocType(raw);
    if (type === 'test') {
      return { kind: 'test', path };
    }

    if (type !== 'suite') {
      return { kind: 'ignore' };
    }

    if (suiteStack.has(path)) {
      return { kind: 'cycle', path };
    }

    suiteStack.add(path);
    suiteYamlByPath.set(path, raw);
    const childEntries = parseSuiteEntries(raw);
    const groups = buildNodesFromEntries(childEntries);
    suiteStack.delete(path);

    return { kind: 'suite', path, groups };
  };

  const rootEntries = parseSuiteEntries(suiteYaml);
  return buildNodesFromEntries(rootEntries);
}

function buildEntryNode(
  path: string,
  lookup: SuiteImportLookup,
  resolve?: (path: string) => { type: SuiteImportDocType; tests?: readonly string[]; cycle?: boolean; error?: string } | undefined
  ,
  suiteStack?: Set<string>
): SuiteHierarchyNode {
  const info = resolve?.(path) ?? lookup[path];
  if (!info) {
    return { kind: 'ignore' };
  }
  if (info.error) {
    return { kind: 'error', path, message: info.error };
  }
  if (info.cycle) {
    return { kind: 'cycle', path };
  }
  if (info.type === 'missing') {
    return { kind: 'missing', path };
  }
  if (info.type === 'test') {
    return { kind: 'test', path };
  }
  if (info.type !== 'suite') {
    return { kind: 'ignore' };
  }

  const nextStack = suiteStack ?? new Set<string>();
  if (nextStack.has(path)) {
    return { kind: 'cycle', path };
  }
  const childStack = new Set(nextStack);
  childStack.add(path);

  const groups = splitSuiteGroups(info.tests ?? []);

  // Rule: if the imported suite has only one group, don't wrap in group nodes.
  const groupNodes: SuiteHierarchyNode[] =
    groups.length === 1
      ? groups[0]
          .map((p) => buildEntryNode(p, lookup, resolve, childStack))
          .filter((n) => n.kind !== 'ignore')
      : groups.map((entries, gi) => {
          const children = entries
            .map((p) => buildEntryNode(p, lookup, resolve, childStack))
            .filter((n) => n.kind !== 'ignore');
          return { kind: 'group', label: `Group ${gi + 1}`, children };
        });

  return { kind: 'suite', path, groups: groupNodes };
}
