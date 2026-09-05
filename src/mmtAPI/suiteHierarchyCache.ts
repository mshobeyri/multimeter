import * as fs from 'fs';
import * as vscode from 'vscode';
import {suiteHierarchy} from 'mmt-core';

export type SuiteHierarchyTree =
    suiteHierarchy.SuiteHierarchyRootNode|{
      kind: 'test';
      id: string;
      path: string;
      title?: string;
    };

type CacheEntry = {
  tree: SuiteHierarchyTree;
  /** Absolute paths that affect this tree (root + nested imports). */
  depPaths: string[];
  /** Sorted stamps captured when `tree` was built. */
  stamps: string[];
};

const hierarchyCache = new Map<string, CacheEntry>();

function cacheKey(suiteFilePath: string, leafPrefix?: string): string {
  return `${suiteFilePath}\0${leafPrefix || ''}`;
}

/**
 * Cheap change detector for a path:
 * - open editor → document version (+ dirty bit)
 * - on disk → size + mtimeMs
 * - missing → sentinel
 *
 * Open docs matter because hierarchy loads use `openTextDocument` and can see
 * unsaved buffers; mtime alone would miss those edits.
 */
export async function stampFile(filePath: string): Promise<string> {
  if (!filePath) {
    return '';
  }
  const open = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.scheme === 'file' && doc.uri.fsPath === filePath);
  if (open) {
    return `${filePath}:doc:${open.version}:${open.isDirty ? 1 : 0}`;
  }
  try {
    const st = await fs.promises.stat(filePath);
    return `${filePath}:fs:${st.size}:${st.mtimeMs}`;
  } catch {
    return `${filePath}:missing`;
  }
}

export async function stampFiles(paths: Iterable<string>): Promise<string[]> {
  const unique = Array.from(new Set(
      Array.from(paths).filter((p): p is string => typeof p === 'string' && !!p)));
  const stamps = await Promise.all(unique.map((p) => stampFile(p)));
  stamps.sort();
  return stamps;
}

function stampsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

async function readCacheIfFresh(key: string): Promise<SuiteHierarchyTree|undefined> {
  const hit = hierarchyCache.get(key);
  if (!hit) {
    return undefined;
  }
  const now = await stampFiles(hit.depPaths);
  if (!stampsEqual(now, hit.stamps)) {
    hierarchyCache.delete(key);
    return undefined;
  }
  return hit.tree;
}

/** Return a fresh cached tree for path+prefix, or undefined if missing/stale. */
export async function peekFreshCachedHierarchy(
    suiteFilePath: string, leafPrefix?: string): Promise<SuiteHierarchyTree|undefined> {
  return readCacheIfFresh(cacheKey(suiteFilePath, leafPrefix));
}

function storeCache(
    key: string, tree: SuiteHierarchyTree, depPaths: string[],
    stamps: string[]): void {
  hierarchyCache.set(key, {
    tree,
    depPaths: [...depPaths],
    stamps,
  });
}

/** Cache a simple test leaf (used when the requested file is type: test). */
export async function getCachedTestHierarchyNode(params: {
  filePath: string;
  leafPrefix?: string;
  title?: string;
}): Promise<{tree: SuiteHierarchyTree; fromCache: boolean}> {
  const key = cacheKey(params.filePath, params.leafPrefix);
  const cached = await readCacheIfFresh(key);
  if (cached && cached.kind === 'test') {
    return {tree: cached, fromCache: true};
  }

  const tree: SuiteHierarchyTree = {
    kind: 'test',
    id: params.leafPrefix || 'test',
    path: params.filePath,
    title: params.title,
  };
  const depPaths = [params.filePath];
  const stamps = await stampFiles(depPaths);
  storeCache(key, tree, depPaths, stamps);
  return {tree, fromCache: false};
}

/**
 * Build (or reuse) a suite hierarchy. Nested imports are tracked via the
 * fileLoader; any mtime/open-doc stamp change among those paths forces rebuild.
 */
export async function getCachedSuiteHierarchy(params: {
  suiteFilePath: string;
  leafPrefix?: string;
  loadRootText: () => Promise<string>;
  fileLoader: (path: string) => Promise<string>;
}): Promise<{tree: SuiteHierarchyTree; fromCache: boolean}> {
  const key = cacheKey(params.suiteFilePath, params.leafPrefix);
  const cached = await readCacheIfFresh(key);
  if (cached) {
    return {tree: cached, fromCache: true};
  }

  const depPaths = new Set<string>([params.suiteFilePath]);
  const trackingLoader = async (requestedPath: string) => {
    if (requestedPath) {
      depPaths.add(requestedPath);
    }
    return params.fileLoader(requestedPath);
  };

  const suiteRawText = await params.loadRootText();
  const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
    suiteFilePath: params.suiteFilePath,
    suiteRawText,
    leafPrefix: params.leafPrefix,
    fileLoader: trackingLoader,
  });

  const paths = Array.from(depPaths);
  const stamps = await stampFiles(paths);
  storeCache(key, tree, paths, stamps);
  return {tree, fromCache: false};
}

/** Test helper / manual invalidation. */
export function clearSuiteHierarchyCache(): void {
  hierarchyCache.clear();
}
