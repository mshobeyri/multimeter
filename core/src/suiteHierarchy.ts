import {detectDocType, resolveRelativeTo} from './runCommon';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';

export type SuiteHierarchyNode =
  | {kind: 'group'; label: string; children: SuiteHierarchyNode[]}
  | {kind: 'suite'; path: string; leafId?: string; children: SuiteHierarchyNode[]}
  | {kind: 'test'; path: string; leafId?: string}
  | {kind: 'missing'; path: string}
  | {kind: 'cycle'; path: string};

export type SuiteHierarchyFileLoader = (path: string) => Promise<string>;

export async function buildSuiteHierarchyFromSuiteFile(params: {
  suiteFilePath: string;
  suiteRawText: string;
  fileLoader: SuiteHierarchyFileLoader;
}): Promise<SuiteHierarchyNode[]> {
  const {suiteFilePath, suiteRawText, fileLoader} = params;

  const suiteStack = new Set<string>();
  suiteStack.add(suiteFilePath);

  const buildNodesFromEntries = async (
    entries: readonly string[],
    ownerFilePath: string,
    leafPrefix: string
  ): Promise<SuiteHierarchyNode[]> => {
    const groups = splitSuiteGroups([...entries]);
    if (groups.length === 1) {
      const nodes = await Promise.all(groups[0].map(async (p, idx) => await buildNodeFromEntry(p, ownerFilePath, `${leafPrefix}/${idx}`)));
      return nodes.filter((n): n is SuiteHierarchyNode => n !== null);
    }

    const groupNodes: Array<SuiteHierarchyNode | null> = await Promise.all(
      groups.map(async (g, gi) => {
        const children =
            (await Promise.all(
                 g.map(async (p, idx) => await buildNodeFromEntry(p, ownerFilePath, `${leafPrefix}/g${gi}/${idx}`))))
                .filter((n): n is SuiteHierarchyNode => n !== null);
        if (!children.length) {
          return null;
        }
        return {kind: 'group', label: `Group ${gi + 1}`, children} as const;
      })
    );

    return groupNodes.filter((n): n is SuiteHierarchyNode => n !== null);
  };

  const buildNodeFromEntry = async (entry: string, ownerFilePath: string, leafId: string): Promise<SuiteHierarchyNode | null> => {
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
      return {kind: 'missing', path: resolvedPath};
    }

    const type = detectDocType(resolvedPath, raw);
    if (type === 'test') {
      return {kind: 'test', path: resolvedPath, leafId};
    }

    if (type !== 'suite') {
      return null;
    }

    if (suiteStack.has(resolvedPath)) {
      return {kind: 'cycle', path: resolvedPath};
    }

    suiteStack.add(resolvedPath);
    const childSuite = yamlToSuite(raw);
    const children = await buildNodesFromEntries(childSuite.tests ?? [], resolvedPath, `${leafId}/s`);
    suiteStack.delete(resolvedPath);

    return {kind: 'suite', path: resolvedPath, leafId, children};
  };

  const rootSuite = yamlToSuite(suiteRawText);
  return await buildNodesFromEntries(rootSuite.tests ?? [], suiteFilePath, 'root');
}
