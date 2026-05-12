import { useEffect, useState } from 'react';
import { TestData } from 'mmt-core/TestData';
import { yamlToTest } from 'mmt-core/testParsePack';
import { SuiteTreeNode } from '../suite/test/suiteHierarchy';
import { SuiteGroup } from '../suite/types';
import { readFile } from '../vsAPI';

/**
 * Load and parse every test file referenced by the suite. Returns a stable
 * map keyed by absolute path. Sub-suites are walked recursively via the
 * provided hierarchy map.
 */
export function useSuiteTestData(
  groups: SuiteGroup[],
  hierarchyByEntryPath: Record<string, SuiteTreeNode | undefined> | undefined,
  enabled: boolean,
): Record<string, TestData | undefined> {
  const [data, setData] = useState<Record<string, TestData | undefined>>({});

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const testPaths = collectTestPaths(groups, hierarchyByEntryPath);
    if (testPaths.length === 0) {
      return;
    }

    let cancelled = false;
    (async () => {
      const results: Record<string, TestData | undefined> = {};
      // readFile uses a single shared resolver in vsAPI, so requests must be
      // serialized to avoid losing responses.
      for (const entry of testPaths) {
        if (cancelled) {
          return;
        }
        try {
          const raw = await readFile(entry.readPath, { silent: true });
          if (raw) {
            const parsed = yamlToTest(raw);
            for (const key of entry.keys) {
              results[key] = parsed;
            }
          }
        } catch {
          // ignore missing/unreadable files; the header node still renders.
        }
      }
      if (!cancelled) {
        setData(results);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groups, hierarchyByEntryPath, enabled]);

  return data;
}

interface TestPathSpec {
  /** Path to pass to readFile (relative is fine; vsAPI resolves it). */
  readPath: string;
  /** All keys the parsed result should be stored under (entry path + hierarchy path). */
  keys: string[];
}

function collectTestPaths(
  groups: SuiteGroup[],
  hierarchyByEntryPath: Record<string, SuiteTreeNode | undefined> | undefined,
): TestPathSpec[] {
  const seen = new Map<string, TestPathSpec>();
  const add = (readPath: string, extraKey?: string) => {
    const existing = seen.get(readPath);
    if (existing) {
      if (extraKey && !existing.keys.includes(extraKey)) {
        existing.keys.push(extraKey);
      }
      return;
    }
    const keys = [readPath];
    if (extraKey && extraKey !== readPath) {
      keys.push(extraKey);
    }
    seen.set(readPath, { readPath, keys });
  };
  const walk = (node: SuiteTreeNode | undefined, entryPath: string) => {
    if (!node) {
      add(entryPath);
      return;
    }
    if (node.kind === 'test') {
      // Use the entry (suite-relative) path for reading so vsAPI can resolve it,
      // but also store under the hierarchy's absolute path so nested suites work.
      add(entryPath, node.path);
      return;
    }
    if (node.kind === 'suite' || node.kind === 'group') {
      const children = (node as any).children as SuiteTreeNode[] | undefined;
      if (Array.isArray(children)) {
        for (const child of children) {
          if ('path' in child && child.path) {
            walk(child, child.path);
          }
        }
      }
    }
  };

  for (const group of groups ?? []) {
    for (const entry of group.entries ?? []) {
      walk(hierarchyByEntryPath?.[entry.path], entry.path);
    }
  }
  return Array.from(seen.values());
}
