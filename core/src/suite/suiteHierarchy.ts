import type {FileLoader} from '../JSerFileLoader';
import {detectDocType, resolveRelativeTo} from '../runCommon';
import {
  SuiteHierarchyNode,
  SuiteHierarchyRootNode,
  SuiteServerItemNode,
} from '../SuiteData';
import {splitSuiteGroups, yamlToSuite} from '../suiteParsePack';
import {createSuiteNodeId} from '../suiteNodeId';
import {peekTestMetaFromYaml} from '../testParsePack';
import {peekApiMetaFromYaml} from '../apiParsePack';
import {brunoToTest, isBrunoFilePath} from '../brunoParsePack';
import {httpToTest, isHttpFilePath} from '../httpParsePack';
import {yamlToMock} from '../mockParsePack';

export type {
  SuiteHierarchyNode,
  SuiteHierarchyRootNode,
  SuiteServerItemNode,
} from '../SuiteData';

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
  /**
   * Limit how deep nested suites are expanded.
   * Requested suite is depth 0.
   * - `maxDepth: 0` — title/meta only, no item walk (`children: []`)
   * - `maxDepth: 1` — direct children only; nested suites are title stubs
   * Omit for full recursive expansion.
   */
  maxDepth?: number;
}): Promise<SuiteHierarchyRootNode> {
  const {suiteFilePath, suiteRawText, fileLoader, leafPrefix, projectRoot, maxDepth} = params;

  const convertSuiteToHierarchy = async (
    targetFilePath: string,
    rawText: string,
    indexPath: number[],
    ancestors: ReadonlySet<string>,
    depth: number,
  ): Promise<SuiteHierarchyRootNode> => {
    const suiteDoc = yamlToSuite(rawText);
    const title = typeof suiteDoc.title === 'string' && suiteDoc.title.trim() ?
        suiteDoc.title.trim() :
        undefined;
    const suiteTags = optionalTags(suiteDoc.tags);

    // Title-only node: used for open-time shallow loads (maxDepth: 0).
    if (typeof maxDepth === 'number' && depth >= maxDepth) {
      const stub: SuiteHierarchyRootNode = {
        kind: 'suite',
        id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
        path: targetFilePath,
        title,
        children: [],
      };
      if (Array.isArray(suiteDoc.servers) && suiteDoc.servers.length > 0) {
        stub.servers = suiteDoc.servers;
      }
      if (suiteDoc.environment) {
        stub.environment = suiteDoc.environment;
      }
      if (Array.isArray(suiteDoc.export) && suiteDoc.export.length > 0) {
        stub.export = suiteDoc.export;
      }
      if (suiteTags) {
        stub.tags = suiteTags;
      }
      if (suiteDoc.filter) {
        stub.filter = suiteDoc.filter;
      }
      return stub;
    }

    // Ancestry is per-branch so the same suite may appear twice as siblings
    // (e.g. suite1 / then / suite1). Only true A→…→A recursion is a cycle.
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(targetFilePath);
    const children = await buildNodesFromEntries(
        suiteDoc.items ?? [], targetFilePath, indexPath, nextAncestors, depth);
    const node: SuiteHierarchyRootNode = {
      kind: 'suite',
      id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
      path: targetFilePath,
      title,
      children,
    };
    if (Array.isArray(suiteDoc.servers) && suiteDoc.servers.length > 0) {
      node.servers = suiteDoc.servers;
      const serverItems =
          (await Promise.all(suiteDoc.servers.map(
               (entry, idx) => buildNodeFromEntry(
                   entry, targetFilePath, [...indexPath, -1, idx], nextAncestors, depth))))
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
    parentDepth: number,
  ): Promise<SuiteHierarchyNode[]> => {
    const groups = splitSuiteGroups([...entries]);
    const groupNodes: Array<SuiteHierarchyNode | null> = await Promise.all(
      groups.map(async (g, gi) => {
        const groupIndexPath = [...parentIndexPath, gi];
        const children =
            (await Promise.all(
                 g.map(async (p, idx) => await buildNodeFromEntry(
                     p, ownerFilePath, [...groupIndexPath, idx], ancestors, parentDepth))))
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

  const buildSuiteStub = (
      resolvedPath: string, raw: string, indexPath: number[]): SuiteHierarchyNode => {
    let title: string|undefined;
    let tags: string[]|undefined;
    try {
      const suiteDoc = yamlToSuite(raw);
      if (typeof suiteDoc.title === 'string' && suiteDoc.title.trim()) {
        title = suiteDoc.title.trim();
      }
      tags = optionalTags(suiteDoc.tags);
    } catch {
      // ignore
    }
    const stub: Extract<SuiteHierarchyNode, {kind: 'suite'}> = {
      kind: 'suite',
      id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
      path: resolvedPath,
      title,
      children: [],
    };
    if (tags) {
      stub.tags = tags;
    }
    return stub;
  };

  const buildNodeFromEntry = async (
      entry: string, ownerFilePath: string, indexPath: number[],
      ancestors: ReadonlySet<string>,
      parentDepth: number): Promise<SuiteHierarchyNode | null> => {
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

    if (type === 'api') {
      let title: string | undefined;
      let tags: string[] | undefined;
      try {
        const meta = peekApiMetaFromYaml(raw);
        title = meta.title;
        tags = optionalTags(meta.tags);
      } catch {
        // ignore
      }
      const apiNode: Extract<SuiteHierarchyNode, {kind: 'api'}> = {
        kind: 'api',
        id: createSuiteNodeId(indexPath, {prefix: leafPrefix}),
        path: resolvedPath,
        title,
      };
      if (tags) {
        apiNode.tags = tags;
      }
      return apiNode;
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

    // Expanding this nested suite would be depth parentDepth+1. With maxDepth:1,
    // children of the requested root stay as title stubs (no further walk).
    if (typeof maxDepth === 'number' && parentDepth + 1 >= maxDepth) {
      return buildSuiteStub(resolvedPath, raw, indexPath);
    }

    return convertSuiteToHierarchy(
        resolvedPath, raw, indexPath, ancestors, parentDepth + 1);
  };

  return convertSuiteToHierarchy(suiteFilePath, suiteRawText, [], new Set(), 0);
}
