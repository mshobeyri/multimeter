import { useEffect, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { TestData } from 'mmt-core/TestData';
import { readFile } from '../vsAPI';

export type CallTitleMap = Record<string, string>;
export type CallTitleMapByTestPath = Record<string, CallTitleMap | undefined>;

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

    let cancelled = false;
    (async () => {
      const next: CallTitleMapByTestPath = {};
      // readFile uses a single shared resolver in vsAPI, so keep requests serialized.
      for (const spec of specs) {
        if (cancelled) {
          return;
        }
        const imports = sanitizeImports((spec.test as any).import);
        const map: CallTitleMap = {};
        for (const [alias, requested] of Object.entries(imports)) {
          if (cancelled) {
            return;
          }
          try {
            const raw = await readFile(resolveImportForWebview(spec.filePath, requested), { silent: true });
            const doc = parseYaml(raw) as any;
            if (!doc || doc.type !== 'api') {
              continue;
            }
            if (typeof doc.title === 'string' && doc.title.trim()) {
              map[alias] = doc.title.trim();
            }
          } catch {
            // Best-effort display metadata; fall back to the alias if unreadable.
          }
        }
        next[spec.key] = map;
        if (spec.filePath && spec.filePath !== spec.key) {
          next[spec.filePath] = map;
        }
      }
      if (!cancelled) {
        setTitles(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, specs, refreshKey]);

  return titles;
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
