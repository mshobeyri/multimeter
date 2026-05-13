import { useEffect, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { TestData } from 'mmt-core/TestData';
import { yamlToTest } from 'mmt-core/testParsePack';
import { readFile } from '../vsAPI';
import { FlowCallImportMap } from './graph/types';

export type CallTitleMap = FlowCallImportMap;
export type CallTitleMapByTestPath = Record<string, FlowCallImportMap | undefined>;

interface TestTitleSpec {
  key: string;
  test: TestData;
  filePath?: string;
}

export function useFlowchartCallTitles(specs: TestTitleSpec[], enabled: boolean, refreshKey = 0): CallTitleMapByTestPath {
  const [titles, setTitles] = useState<CallTitleMapByTestPath>({});

  useEffect(() => {
    if (!enabled || specs.length === 0) {
      setTitles({});
      return;
    }

    const cancelState = { cancelled: false };
    (async () => {
      const next: CallTitleMapByTestPath = {};
      for (const spec of specs) {
        if (cancelState.cancelled) {
          return;
        }
        const map = await loadCallImports(spec.test, spec.filePath, cancelState, new Set<string>());
        next[spec.key] = map;
        if (spec.filePath && spec.filePath !== spec.key) {
          next[spec.filePath] = map;
        }
      }
      if (!cancelState.cancelled) {
        setTitles(next);
      }
    })();

    return () => {
      cancelState.cancelled = true;
    };
  }, [enabled, specs, refreshKey]);

  return titles;
}

async function loadCallImports(
  test: TestData,
  filePath: string | undefined,
  cancelState: { cancelled: boolean },
  visited: Set<string>,
): Promise<FlowCallImportMap> {
  const imports = sanitizeImports((test as any).import);
  const map: FlowCallImportMap = {};
  for (const [alias, requested] of Object.entries(imports)) {
    if (cancelState.cancelled) {
      return map;
    }
    const resolved = resolveImportForWebview(filePath, requested);
    try {
      const raw = await readFile(resolved, { silent: true });
      const doc = parseYaml(raw) as any;
      const title = typeof doc?.title === 'string' && doc.title.trim() ? doc.title.trim() : undefined;
      if (doc?.type === 'api') {
        map[alias] = { kind: 'api', title, filePath: resolved };
      } else if (doc?.type === 'test') {
        const parsed = yamlToTest(raw);
        const nextVisited = new Set(visited);
        nextVisited.add(resolved);
        const nestedImports = visited.has(resolved)
          ? {}
          : await loadCallImports(parsed, resolved, cancelState, nextVisited);
        map[alias] = { kind: 'test', title, filePath: resolved, test: parsed, callImportByAlias: nestedImports };
      }
    } catch {
      // Best-effort display metadata; fall back to the alias if unreadable.
    }
  }
  return map;
}

export function buildSingleTestTitleSpecs(test: TestData | undefined, filePath?: string): TestTitleSpec[] {
  if (!test) {
    return [];
  }
  return [{ key: filePath || '__current__', filePath, test }];
}

export function buildSuiteTitleSpecs(testDataByPath: Record<string, TestData | undefined>): TestTitleSpec[] {
  const specs: TestTitleSpec[] = [];
  for (const [path, test] of Object.entries(testDataByPath)) {
    if (!test) {
      continue;
    }
    specs.push({ key: path, filePath: path, test });
  }
  return specs;
}

function sanitizeImports(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [alias, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof alias === 'string' && typeof value === 'string' && alias.trim() && value.trim()) {
      result[alias] = value;
    }
  }
  return result;
}

function resolveImportForWebview(baseFilePath: string | undefined, requested: string): string {
  if (!baseFilePath || requested.startsWith('+/') || requested.startsWith('/')) {
    return requested;
  }
  if (/^[a-zA-Z]+:/.test(requested)) {
    return requested;
  }
  const normalizedBase = baseFilePath.replace(/\\/g, '/');
  const slash = normalizedBase.lastIndexOf('/');
  if (slash < 0) {
    return requested;
  }
  return normalizePath(`${normalizedBase.slice(0, slash + 1)}${requested}`);
}

function normalizePath(path: string): string {
  const absolute = path.startsWith('/');
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') {
        parts.pop();
      } else if (!absolute) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }
  return `${absolute ? '/' : ''}${parts.join('/')}`;
}
