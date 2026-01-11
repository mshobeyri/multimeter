import {detectDocType, resolveRelativeTo} from './runCommon';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';
import {createSuiteNodeId} from './suiteNodeId';

export type SuiteHierarchyNode =
  | {kind: 'group'; id: string; label: string; children: SuiteHierarchyNode[]}
  | {kind: 'suite'; id: string; path: string; children: SuiteHierarchyNode[]}
  | {kind: 'test'; id: string; path: string}
  | {kind: 'missing'; id: string; path: string}
  | {kind: 'cycle'; id: string; path: string};

export type SuiteHierarchyFileLoader = (path: string) => Promise<string>;

export async function buildSuiteHierarchyFromSuiteFile(params: {
  suiteFilePath: string;
  suiteRawText: string;
  fileLoader: SuiteHierarchyFileLoader;
  leafPrefix?: string;
}): Promise<SuiteHierarchyNode[]> {
  const {suiteFilePath, suiteRawText, fileLoader, leafPrefix} = params;

  const suiteStack = new Set<string>();
  suiteStack.add(suiteFilePath);

  const buildNodesFromEntries = async (
    entries: readonly string[],
    ownerFilePath: string,
    parentIndexPath: number[],
  ): Promise<SuiteHierarchyNode[]> => {
    const groups = splitSuiteGroups([...entries]);
    if (groups.length === 1) {
      const nodes = await Promise.all(groups[0].map(async (p, idx) => await buildNodeFromEntry(p, ownerFilePath, [...parentIndexPath, idx])));
      return nodes.filter((n): n is SuiteHierarchyNode => n !== null);
    }

    const groupNodes: Array<SuiteHierarchyNode | null> = await Promise.all(
      groups.map(async (g, gi) => {
        const groupIndexPath = [...parentIndexPath, gi];
        const children =
            (await Promise.all(
                 g.map(async (p, idx) => await buildNodeFromEntry(p, ownerFilePath, [...groupIndexPath, idx]))))
                .filter((n): n is SuiteHierarchyNode => n !== null);
        if (!children.length) {
          return null;
        }
        return {
          kind: 'group',
          id: createSuiteNodeId(groupIndexPath, {prefix: leafPrefix}),
          label: `Group ${gi + 1}`,
          children,
        } as const;
      })
    );

    return groupNodes.filter((n): n is SuiteHierarchyNode => n !== null);
  };

  const buildNodeFromEntry = async (entry: string, ownerFilePath: string, indexPath: number[]): Promise<SuiteHierarchyNode | null> => {
    const trimmed = String(entry ?? '').trim();
    if (!trimmed || trimmed === 'then') {
      return null;
    }

    const resolvedPath = resolveRelativeTo(trimmed, ownerFilePath) || trimmed;

    let raw = '';
    try {
      raw = await fileLoader(resolvedPath);
    } catch {
      raw = '';
    }

    if (!raw) {
      return {kind: 'missing', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    const type = detectDocType(resolvedPath, raw);
    if (type === 'test') {
      return {kind: 'test', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    if (type !== 'suite') {
      return null;
    }

    if (suiteStack.has(resolvedPath)) {
      return {kind: 'cycle', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    suiteStack.add(resolvedPath);
    const childSuite = yamlToSuite(raw);
    const children = await buildNodesFromEntries(childSuite.tests ?? [], resolvedPath, indexPath);
    suiteStack.delete(resolvedPath);

    return {
      kind: 'suite',
      id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
      path: resolvedPath,
      children,
    };
  };

  const rootSuite = yamlToSuite(suiteRawText);
  return await buildNodesFromEntries(rootSuite.tests ?? [], suiteFilePath, []);
}
