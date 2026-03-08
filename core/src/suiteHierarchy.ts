import {detectDocType, resolveRelativeTo} from './runCommon';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';
import {createSuiteNodeId} from './suiteNodeId';
import {yamlToTest} from './testParsePack';

export type SuiteHierarchyNode =
  | {kind: 'group'; id: string; label: string; children: SuiteHierarchyNode[]}
  | {kind: 'suite'; id: string; path: string; title?: string; children: SuiteHierarchyNode[]}
  | {kind: 'test'; id: string; path: string; title?: string}
  | {kind: 'server'; id: string; path: string; title?: string}
  | {kind: 'missing'; id: string; path: string}
  | {kind: 'cycle'; id: string; path: string};

export type SuiteHierarchyFileLoader = (path: string) => Promise<string>;

export type SuiteHierarchyRootNode = Extract<SuiteHierarchyNode, {kind: 'suite'}>;

export async function buildSuiteHierarchyFromSuiteFile(params: {
  suiteFilePath: string;
  suiteRawText: string;
  fileLoader: SuiteHierarchyFileLoader;
  leafPrefix?: string;
}): Promise<SuiteHierarchyRootNode> {
  const {suiteFilePath, suiteRawText, fileLoader, leafPrefix} = params;

  const suiteStack = new Set<string>();
  suiteStack.add(suiteFilePath);

  const convertSuiteToHierarchy = async (
    targetFilePath: string,
    rawText: string,
    indexPath: number[],
  ): Promise<SuiteHierarchyRootNode> => {
    const suiteDoc = yamlToSuite(rawText);
    const children = await buildNodesFromEntries(suiteDoc.tests ?? [], targetFilePath, indexPath);
    return {
      kind: 'suite',
      id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
      path: targetFilePath,
      title: suiteDoc.title,
      children,
    };
  };

  const buildNodesFromEntries = async (
    entries: readonly string[],
    ownerFilePath: string,
    parentIndexPath: number[],
  ): Promise<SuiteHierarchyNode[]> => {
    const groups = splitSuiteGroups([...entries]);
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
      let title: string | undefined;
      try {
        const testDoc = yamlToTest(raw);
        if (typeof testDoc?.title === 'string' && testDoc.title.trim()) {
          title = testDoc.title.trim();
        }
      } catch {
        // ignore
      }
      return {kind: 'test', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath, title};
    }

    if (type === 'server') {
      // Server files can be included in suites to start mock servers
      return {kind: 'server', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    if (type !== 'suite') {
      return null;
    }

    if (suiteStack.has(resolvedPath)) {
      return {kind: 'cycle', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    suiteStack.add(resolvedPath);
    const suiteNode = await convertSuiteToHierarchy(resolvedPath, raw, indexPath);
    suiteStack.delete(resolvedPath);

    return suiteNode;
  };

  const rootNode = await convertSuiteToHierarchy(suiteFilePath, suiteRawText, []);
  return rootNode;
}
