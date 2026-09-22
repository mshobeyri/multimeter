import type {FileLoader} from './JSerFileLoader';
import {detectDocType, resolveRelativeTo} from './runCommon';
import {
  SuiteHierarchyNode,
  SuiteHierarchyRootNode,
  SuiteServerItemNode,
} from './SuiteData';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';
import {createSuiteNodeId} from './suiteNodeId';
import {peekTestMetaFromYaml} from './testParsePack';
import {brunoToTest, isBrunoFilePath} from './brunoParsePack';
import {httpToTest, isHttpFilePath} from './httpParsePack';
import {yamlToMock} from './mockParsePack';

export type {
  SuiteHierarchyNode,
  SuiteHierarchyRootNode,
  SuiteServerItemNode,
} from './SuiteData';

export type SuiteHierarchyFileLoader = FileLoader;

function optionalTags(tags?: string[]): string[]|undefined {
  if (!Array.isArray(tags) || tags.length === 0) {
    return undefined;
  }
  const out = tags.map((t) => String(t).trim()).filter(Boolean);
  return out.length ? out : undefined;
}

export async function buildSuiteHierarchyFromSuiteFile(params: {
  suiteFilePath: string;
  suiteRawText: string;
  fileLoader: SuiteHierarchyFileLoader;
  leafPrefix?: string;
  projectRoot?: string;
}): Promise<SuiteHierarchyRootNode> {
  const {suiteFilePath, suiteRawText, fileLoader, leafPrefix, projectRoot} = params;

  const convertSuiteToHierarchy = async (
    targetFilePath: string,
    rawText: string,
    indexPath: number[],
    ancestors: ReadonlySet<string>,
  ): Promise<SuiteHierarchyRootNode> => {
    const suiteDoc = yamlToSuite(rawText);
    // Ancestry is per-branch so the same suite may appear twice as siblings
    // (e.g. suite1 / then / suite1). Only true A→…→A recursion is a cycle.
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(targetFilePath);
    const children = await buildNodesFromEntries(
        suiteDoc.items ?? [], targetFilePath, indexPath, nextAncestors);
    const node: SuiteHierarchyRootNode = {
      kind: 'suite',
      id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
      path: targetFilePath,
      title: typeof suiteDoc.title === 'string' && suiteDoc.title.trim() ?
          suiteDoc.title.trim() :
          undefined,
      children,
    };
    if (Array.isArray(suiteDoc.servers) && suiteDoc.servers.length > 0) {
      node.servers = suiteDoc.servers;
      const serverItems =
          (await Promise.all(suiteDoc.servers.map(
               (entry, idx) => buildNodeFromEntry(
                   entry, targetFilePath, [...indexPath, -1, idx], nextAncestors))))
              .filter((n): n is SuiteServerItemNode =>
                !!n && (n.kind === 'server' || n.kind === 'missing'));
      if (serverItems.length > 0) {
        node.serverItems = serverItems;
      }
    }
    if (suiteDoc.environment) {
      node.environment = suiteDoc.environment;
    }
    if (Array.isArray(suiteDoc.export) && suiteDoc.export.length > 0) {
      node.export = suiteDoc.export;
    }
    const suiteTags = optionalTags(suiteDoc.tags);
    if (suiteTags) {
      node.tags = suiteTags;
    }
    if (suiteDoc.filter) {
      node.filter = suiteDoc.filter;
    }
    return node;
  };

  const buildNodesFromEntries = async (
    entries: readonly string[],
    ownerFilePath: string,
    parentIndexPath: number[],
    ancestors: ReadonlySet<string>,
  ): Promise<SuiteHierarchyNode[]> => {
    const groups = splitSuiteGroups([...entries]);
    const groupNodes: Array<SuiteHierarchyNode | null> = await Promise.all(
      groups.map(async (g, gi) => {
        const groupIndexPath = [...parentIndexPath, gi];
        const children =
            (await Promise.all(
                 g.map(async (p, idx) => await buildNodeFromEntry(
                     p, ownerFilePath, [...groupIndexPath, idx], ancestors))))
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

  const buildNodeFromEntry = async (
      entry: string, ownerFilePath: string, indexPath: number[],
      ancestors: ReadonlySet<string>): Promise<SuiteHierarchyNode | null> => {
    const trimmed = String(entry ?? '').trim();
    if (!trimmed || trimmed === 'then') {
      return null;
    }

    const resolvedPath = resolveRelativeTo(trimmed, ownerFilePath, projectRoot) || trimmed;

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
      let tags: string[] | undefined;
      try {
        if (isHttpFilePath(resolvedPath)) {
          const testDoc = httpToTest(raw, resolvedPath);
          if (typeof testDoc?.title === 'string' && testDoc.title.trim()) {
            title = testDoc.title.trim();
          }
          tags = optionalTags(testDoc?.tags);
        } else if (isBrunoFilePath(resolvedPath)) {
          const testDoc = brunoToTest(raw, resolvedPath);
          if (typeof testDoc?.title === 'string' && testDoc.title.trim()) {
            title = testDoc.title.trim();
          }
          tags = optionalTags(testDoc?.tags);
        } else {
          const meta = peekTestMetaFromYaml(raw);
          title = meta.title;
          tags = optionalTags(meta.tags);
        }
      } catch {
        // ignore
      }
      const testNode: Extract<SuiteHierarchyNode, {kind: 'test'}> = {
        kind: 'test',
        id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
        path: resolvedPath,
        title,
      };
      if (tags) {
        testNode.tags = tags;
      }
      return testNode;
    }

    if (type === 'server') {
      let title: string|undefined;
      try {
        const mockDoc = yamlToMock(raw);
        if (typeof mockDoc?.title === 'string' && mockDoc.title.trim()) {
          title = mockDoc.title.trim();
        }
      } catch {
        // ignore
      }
      return {kind: 'server', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath, title};
    }

    if (type !== 'suite') {
      return null;
    }

    if (ancestors.has(resolvedPath)) {
      return {kind: 'cycle', id: createSuiteNodeId(indexPath, {prefix: leafPrefix}), path: resolvedPath};
    }

    return convertSuiteToHierarchy(resolvedPath, raw, indexPath, ancestors);
  };

  return convertSuiteToHierarchy(suiteFilePath, suiteRawText, [], new Set());
}
