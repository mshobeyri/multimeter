import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SuiteImportDocType,
  SuiteImportTreeNode,
  SuiteImportTreeResult,
  buildSuiteInfoChildren,
  createNode,
  splitSuiteGroups,
} from './suiteImportTree';

type SuiteImportTreeRequest = {
  command: 'getSuiteImportTree';
  requestId: string;
  entries: string[];
  maxDepth?: number;
};

type SuiteImportTreeResponse = {
  command: 'suiteImportTreeResult';
  requestId?: string;
  results?: Record<string, { path: string; docType: SuiteImportDocType; tests?: string[]; cycle?: boolean; error?: string }>;
};


export const useSuiteImportTree = (rootEntries: string[], enabled: boolean) => {
  const [rootNodes, setRootNodes] = useState<SuiteImportTreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const cacheRef = useRef(new Map<string, { docType: SuiteImportDocType; tests?: string[]; cycle?: boolean; error?: string }>());

  const request = useCallback(async (entries: string[]) => {
    if (!window?.vscode) {
      return {} as SuiteImportTreeResult;
    }
    const requestId = `suite-import-tree-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const msg: SuiteImportTreeRequest = { command: 'getSuiteImportTree', requestId, entries, maxDepth: 25 };

    return await new Promise<SuiteImportTreeResult>((resolve) => {
      const handler = (event: MessageEvent) => {
        const data = event.data as SuiteImportTreeResponse;
        if (!data || data.command !== 'suiteImportTreeResult' || data.requestId !== requestId) {
          return;
        }
        window.removeEventListener('message', handler);
        resolve({ results: data.results || {} });
      };
      window.addEventListener('message', handler);
      window.vscode?.postMessage(msg);
    });
  }, []);

  const getCachedInfo = useCallback((path: string) => cacheRef.current.get(path), []);

  const cacheEntry = useCallback(
    (path: string, info: { docType: SuiteImportDocType; tests?: string[]; cycle?: boolean; error?: string }) => {
      cacheRef.current.set(path, info);
    },
    []
  );

  const buildChildrenForSuiteNode = useCallback(
    async (suiteNode: SuiteImportTreeNode): Promise<SuiteImportTreeNode[]> => {
      const cached = getCachedInfo(suiteNode.path);
      const docType = cached?.docType ?? suiteNode.docType;
      const cycle = cached?.cycle ?? suiteNode.cycle;

      if (docType !== 'suite' || cycle) {
        return [];
      }

      const tests = cached?.tests ?? suiteNode.tests ?? [];
      const groups = splitSuiteGroups(tests);
      suiteNode.groups = groups;

      // If the suite has immediate tests (no `then` splits), show them directly
      // under the suite node as boxes, and also include group nodes if present.
      if (groups.length === 1) {
        const entries = groups[0] ?? [];
        if (!entries.length) {
          return [];
        }
        const res = await request(entries);
        return entries.map((entryPath) => {
          const info = res.results[entryPath];
          const docType = info?.docType ?? 'unknown';
          cacheEntry(entryPath, { docType, tests: info?.tests, cycle: info?.cycle, error: info?.error });

          const child = createNode(entryPath, docType);
          if (info?.tests) {
            child.tests = info.tests;
          }
          if (info?.cycle) {
            child.cycle = true;
          }
          if (info?.error) {
            child.error = info.error;
          }
          return child;
        });
      }

      return buildSuiteInfoChildren(suiteNode.path, groups);
    },
    [cacheEntry, getCachedInfo, request]
  );

  const buildChildrenForGroupNode = useCallback(
    async (groupNode: SuiteImportTreeNode): Promise<SuiteImportTreeNode[]> => {
      // groupNode.id format: suite-import-node:group:<parentPath>#<index>
      const raw = groupNode.id;
      const idx = raw.lastIndexOf('#');
      const parentKey = raw.startsWith('suite-import-node:group:') ? raw.slice('suite-import-node:group:'.length) : '';
      const parentPath = idx >= 0 ? parentKey.slice(0, idx) : '';
      const groupIndex = idx >= 0 ? Number(parentKey.slice(idx + 1)) : NaN;
      if (!parentPath || Number.isNaN(groupIndex)) {
        return [];
      }

      const cached = getCachedInfo(parentPath);
      if (!cached || cached.docType !== 'suite' || cached.cycle) {
        return [];
      }

      const groups = splitSuiteGroups(cached.tests ?? []);
      const entries = groups[groupIndex] ?? [];
      if (!entries.length) {
        return [];
      }

      const res = await request(entries);
      return entries.map((entryPath) => {
        const info = res.results[entryPath];
        const docType = info?.docType ?? 'unknown';
        cacheEntry(entryPath, { docType, tests: info?.tests, cycle: info?.cycle, error: info?.error });

        const child = createNode(entryPath, docType);
        if (info?.tests) {
          child.tests = info.tests;
        }
        if (info?.cycle) {
          child.cycle = true;
        }
        if (info?.error) {
          child.error = info.error;
        }
        return child;
      });
    },
    [cacheEntry, getCachedInfo, request]
  );

  const expandNode = useCallback(async (node: SuiteImportTreeNode) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(node.id);
      return next;
    });

    if (node.children && node.children.length) {
      return;
    }

    let children: SuiteImportTreeNode[] = [];
    if (node.id.startsWith('suite-import-node:group:')) {
      children = await buildChildrenForGroupNode(node);
    } else {
      children = await buildChildrenForSuiteNode(node);
    }
    if (!children.length) {
      return;
    }

    const patch = (nodes: SuiteImportTreeNode[]): SuiteImportTreeNode[] => {
      return nodes.map((n) => {
        if (n.id === node.id) {
          return { ...n, children };
        }
        if (n.children && n.children.length) {
          return { ...n, children: patch(n.children) };
        }
        return n;
      });
    };

    setRootNodes((prev) => patch(prev));
  }, [buildChildrenForGroupNode, buildChildrenForSuiteNode]);

  const collapseNode = useCallback((node: SuiteImportTreeNode) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(node.id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRootNodes([]);
      setExpandedIds(new Set());
      cacheRef.current.clear();
      return;
    }
    const init = async () => {
      if (!rootEntries.length) {
        setRootNodes([]);
        return;
      }
      const res = await request(rootEntries);
      const nodes = rootEntries
        .filter((p) => typeof p === 'string' && p.trim())
        .map((p) => {
          const info = res.results[p];
          const docType = info?.docType ?? 'unknown';
          cacheEntry(p, { docType, tests: info?.tests, cycle: info?.cycle, error: info?.error });
          const n = createNode(p, docType);
          if (info?.tests) {
            n.tests = info.tests;
          }
          if (info?.cycle) {
            n.cycle = true;
          }
          if (info?.error) {
            n.error = info.error;
          }
          return n;
        });
      setRootNodes(nodes);
    };
    init();
  }, [cacheEntry, enabled, request, rootEntries]);

  return useMemo(() => ({ rootNodes, expandedIds, expandNode, collapseNode }), [collapseNode, expandNode, expandedIds, rootNodes]);
};
