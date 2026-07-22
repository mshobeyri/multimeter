import {runFile} from './runner';
import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';
import {createSuiteBundle} from './suiteBundle';

describe('suite missing file reporting', () => {
  it('emits invalid suite-item status for missing files', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Missing File Suite',
        'items:',
        '  - missing-test.mmt',
        '  - ok.mmt',
      ].join('\n'),
      '/root/ok.mmt': [
        'type: test',
        'title: OK',
        'steps:',
        '  - check: 1 == 1',
      ].join('\n'),
    };

    const fileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      if (!(normalized in files)) {
        throw new Error(`ENOENT: ${normalized}`);
      }
      return files[normalized];
    };

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/parent.mmt',
      suiteRawText: files['/root/parent.mmt'],
      fileLoader,
    });

    const missing = (tree.children[0] as any).children.find((n: any) => n.kind === 'missing');
    expect(missing).toBeTruthy();

    const bundle = createSuiteBundle({
      rootSuitePath: '/root/parent.mmt',
      hierarchy: tree,
    });

    const events: Array<Record<string, any>> = [];
    const logs: string[] = [];

    const result = await runFile({
      file: files['/root/parent.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/parent.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader,
      suiteBundle: bundle,
      jsRunner: async () => ({}),
      logger: (_level: string, msg: string) => {
        logs.push(msg);
      },
      reporter: (event: any) => {
        events.push(event);
      },
    } as any);

    expect(result.result.success).toBe(false);
    expect(logs.some(l => l.includes('File not found'))).toBe(true);

    const missingEvents = events.filter(
        e => e.scope === 'suite-item' && e.id === missing.id);
    expect(missingEvents.some(e => e.status === 'running')).toBe(true);
    expect(missingEvents.some(e => e.status === 'invalid')).toBe(true);
  });
});
