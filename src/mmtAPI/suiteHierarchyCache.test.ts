jest.mock('vscode', () => ({
  workspace: {
    textDocuments: [] as Array<{
      uri: {scheme: string; fsPath: string};
      version: number;
      isDirty: boolean;
    }>,
  },
}), {virtual: true});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  clearSuiteHierarchyCache,
  getCachedSuiteHierarchy,
  getCachedTestHierarchyNode,
  peekFreshCachedHierarchy,
  stampFile,
} from './suiteHierarchyCache';

describe('suiteHierarchyCache', () => {
  let tmpDir: string;

  beforeEach(() => {
    clearSuiteHierarchyCache();
    (vscode.workspace as any).textDocuments = [];
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-hier-cache-'));
  });

  afterEach(() => {
    clearSuiteHierarchyCache();
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  function write(rel: string, content: string): string {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content, 'utf8');
    // Ensure distinct mtimes across rapid writes on some filesystems.
    const now = Date.now() / 1000;
    fs.utimesSync(full, now, now);
    return full;
  }

  function touch(filePath: string): void {
    const next = Date.now() / 1000 + 5;
    fs.utimesSync(filePath, next, next);
  }

  function diskLoader() {
    return async (p: string) => {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    };
  }

  it('reuses hierarchy when nested files are unchanged', async () => {
    const child = write('child.mmt', [
      'type: test',
      'title: Child',
      'steps:',
      '  - print: hi',
      '',
    ].join('\n'));
    const root = write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - child.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const loadRootText = async () => fs.readFileSync(root, 'utf8');

    const first = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(first.fromCache).toBe(false);
    expect(first.tree.kind).toBe('suite');

    const second = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText: async () => {
        throw new Error('should not reload root on cache hit');
      },
      fileLoader: async () => {
        throw new Error('should not reload nested on cache hit');
      },
    });
    expect(second.fromCache).toBe(true);
    expect(second.tree).toBe(first.tree);
    expect(await peekFreshCachedHierarchy(root)).toBe(first.tree);

    touch(child);
    const third = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(third.fromCache).toBe(false);
  });

  it('invalidates when a deeply nested suite file changes', async () => {
    const leaf = write('tests/leaf.mmt', [
      'type: test',
      'title: Leaf',
      'steps:',
      '  - print: leaf',
      '',
    ].join('\n'));
    const mid = write('suites/mid.mmt', [
      'type: suite',
      'title: Mid',
      'items:',
      '  - ../tests/leaf.mmt',
      '',
    ].join('\n'));
    const root = write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - suites/mid.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const loadRootText = async () => fs.readFileSync(root, 'utf8');

    const first = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(first.fromCache).toBe(false);
    expect(first.tree.kind).toBe('suite');

    // Mid suite structure change must bust cache even if root mtime is untouched.
    write('suites/mid.mmt', [
      'type: suite',
      'title: Mid changed',
      'items:',
      '  - ../tests/leaf.mmt',
      '',
    ].join('\n'));
    touch(mid);

    const second = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(second.fromCache).toBe(false);
    if (second.tree.kind === 'suite') {
      const midNode = (second.tree.children?.[0] as any)?.children?.[0];
      expect(midNode?.title).toBe('Mid changed');
    }

    // Leaf test change must also bust cache.
    await getCachedSuiteHierarchy({suiteFilePath: root, loadRootText, fileLoader});
    write('tests/leaf.mmt', [
      'type: test',
      'title: Leaf v2',
      'steps:',
      '  - print: leaf2',
      '',
    ].join('\n'));
    touch(leaf);

    const third = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(third.fromCache).toBe(false);
  });

  it('invalidates when root suite content changes', async () => {
    write('a.mmt', [
      'type: test',
      'title: A',
      'steps:',
      '  - print: a',
      '',
    ].join('\n'));
    write('b.mmt', [
      'type: test',
      'title: B',
      'steps:',
      '  - print: b',
      '',
    ].join('\n'));
    const root = write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - a.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const first = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText: async () => fs.readFileSync(root, 'utf8'),
      fileLoader,
    });
    expect(first.fromCache).toBe(false);

    write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - a.mmt',
      '  - b.mmt',
      '',
    ].join('\n'));
    touch(root);

    const second = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText: async () => fs.readFileSync(root, 'utf8'),
      fileLoader,
    });
    expect(second.fromCache).toBe(false);
    if (second.tree.kind === 'suite') {
      const group = second.tree.children?.[0] as any;
      expect(group?.children?.length).toBe(2);
    }
  });

  it('invalidates when a previously missing nested file appears', async () => {
    const root = write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - missing.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const loadRootText = async () => fs.readFileSync(root, 'utf8');

    const first = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(first.fromCache).toBe(false);
    if (first.tree.kind === 'suite') {
      const child = (first.tree.children?.[0] as any)?.children?.[0];
      expect(child?.kind).toBe('missing');
    }

    // Cache hit while still missing.
    const hit = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(hit.fromCache).toBe(true);

    write('missing.mmt', [
      'type: test',
      'title: Found',
      'steps:',
      '  - print: found',
      '',
    ].join('\n'));

    const second = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText,
      fileLoader,
    });
    expect(second.fromCache).toBe(false);
    if (second.tree.kind === 'suite') {
      const child = (second.tree.children?.[0] as any)?.children?.[0];
      expect(child?.kind).toBe('test');
      expect(child?.title).toBe('Found');
    }
  });

  it('keeps separate cache entries per leafPrefix', async () => {
    write('child.mmt', [
      'type: test',
      'title: Child',
      'steps:',
      '  - print: hi',
      '',
    ].join('\n'));
    const root = write('root.mmt', [
      'type: suite',
      'title: Root',
      'items:',
      '  - child.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const loadRootText = async () => fs.readFileSync(root, 'utf8');

    const a = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      leafPrefix: 'entry-a',
      loadRootText,
      fileLoader,
    });
    const b = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      leafPrefix: 'entry-b',
      loadRootText,
      fileLoader,
    });
    expect(a.fromCache).toBe(false);
    expect(b.fromCache).toBe(false);
    expect(a.tree).not.toBe(b.tree);
    expect(a.tree.id).toContain('entry-a');
    expect(b.tree.id).toContain('entry-b');

    const a2 = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      leafPrefix: 'entry-a',
      loadRootText: async () => {
        throw new Error('entry-a should hit cache');
      },
      fileLoader: async () => {
        throw new Error('entry-a should hit cache');
      },
    });
    expect(a2.fromCache).toBe(true);
    expect(a2.tree).toBe(a.tree);
    expect(await peekFreshCachedHierarchy(root, 'entry-b')).toBe(b.tree);
  });

  it('caches test leaf nodes and peeks them without rebuild', async () => {
    const testFile = write('only-test.mmt', [
      'type: test',
      'title: Only',
      'steps:',
      '  - print: x',
      '',
    ].join('\n'));

    const first = await getCachedTestHierarchyNode({
      filePath: testFile,
      leafPrefix: 'leaf-1',
      title: 'Only',
    });
    expect(first.fromCache).toBe(false);
    expect(first.tree).toEqual({
      kind: 'test',
      id: 'leaf-1',
      path: testFile,
      title: 'Only',
    });

    const second = await getCachedTestHierarchyNode({
      filePath: testFile,
      leafPrefix: 'leaf-1',
      title: 'stale title ignored on hit',
    });
    expect(second.fromCache).toBe(true);
    expect(second.tree).toBe(first.tree);
    expect(await peekFreshCachedHierarchy(testFile, 'leaf-1')).toBe(first.tree);

    touch(testFile);
    expect(await peekFreshCachedHierarchy(testFile, 'leaf-1')).toBeUndefined();
  });

  it('invalidates when an open dirty document changes', async () => {
    write('child.mmt', [
      'type: test',
      'title: Child',
      'steps:',
      '  - print: hi',
      '',
    ].join('\n'));
    const root = write('solo.mmt', [
      'type: suite',
      'title: Solo',
      'items:',
      '  - child.mmt',
      '',
    ].join('\n'));

    const fileLoader = diskLoader();
    const first = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText: async () => fs.readFileSync(root, 'utf8'),
      fileLoader,
    });
    expect(first.fromCache).toBe(false);

    (vscode.workspace as any).textDocuments = [{
      uri: {scheme: 'file', fsPath: root},
      version: 2,
      isDirty: true,
    }];

    expect(await stampFile(root)).toContain(':doc:2:1');

    const second = await getCachedSuiteHierarchy({
      suiteFilePath: root,
      loadRootText: async () => fs.readFileSync(root, 'utf8'),
      fileLoader,
    });
    expect(second.fromCache).toBe(false);
  });

  it('stampFile reports missing for absent paths', async () => {
    expect(await stampFile(path.join(tmpDir, 'nope.mmt'))).toMatch(/:missing$/);
    expect(await stampFile('')).toBe('');
  });
});
