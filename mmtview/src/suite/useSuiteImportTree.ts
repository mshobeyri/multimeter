import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SuiteImportDocType, SuiteImportTreeNode, SuiteImportTreeResult, createNode } from './suiteImportTree';

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

const splitSuiteGroups = (tests: string[]): string[][] => {
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

  const buildChildNodes = useCallback(async (parent: SuiteImportTreeNode): Promise<SuiteImportTreeNode[]> => {
    const cached = cacheRef.current.get(parent.path);
    const docType = cached?.docType ?? parent.docType;

    if (docType !== 'suite') {
      return [];
    }

    const tests = cached?.tests ?? parent.tests ?? [];
    const groups = splitSuiteGroups(tests);

    const nodes: SuiteImportTreeNode[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const groupNode = createNode(`group:${parent.path}:${gi}`, 'unknown');
      groupNode.children = [];
      nodes.push({ ...groupNode, path: `Group ${gi + 1}`, docType: 'unknown' });

      const entries = groups[gi];
      if (!entries.length) {
        continue;
      }

      const res = await request(entries);
      for (const entryPath of entries) {
        const info = res.results[entryPath];
        const childDocType = info?.docType ?? 'unknown';
        cacheRef.current.set(entryPath, { docType: childDocType, tests: info?.tests, cycle: info?.cycle, error: info?.error });
        const child = createNode(entryPath, childDocType);
        if (info?.tests) {
          child.tests = info.tests;
        }
        if (info?.cycle) {
          child.cycle = true;
        }
        if (info?.error) {
          child.error = info.error;
        }
        (nodes[nodes.length - 1].children as SuiteImportTreeNode[]).push(child);
      }
    }

    return nodes;
  }, [request]);

  const expandNode = useCallback(async (node: SuiteImportTreeNode) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(node.id);
      return next;
    });

    if (node.children && node.children.length) {
      return;
    }

    const children = await buildChildNodes(node);
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
  }, [buildChildNodes]);

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
          cacheRef.current.set(p, { docType, tests: info?.tests, cycle: info?.cycle, error: info?.error });
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
  }, [enabled, request, rootEntries]);

  return useMemo(() => ({ rootNodes, expandedIds, expandNode, collapseNode }), [collapseNode, expandNode, expandedIds, rootNodes]);
};
