import {runFile} from './runner';

describe('runner suite import base', () => {
  it('resolves imported paths relative to each suite item file', async () => {
    const fileLoader = async (p: string) => {
      const normalized = String(p).replace(/\\/g, '/');

      if (normalized.endsWith('/suite/suite.mmt')) {
        // suite file is in /root/suite, but it references a test in /root/other
        return `type: suite\nitems:\n  - ../other/test.mmt\n`;
      }

      if (normalized.endsWith('/other/test.mmt')) {
        // This import is relative to /root/other, not /root/suite
        return `type: test\nimport:\n  dep: ./dep.mmt\nsteps:\n  - print: ok\n`;
      }

      if (normalized.endsWith('/other/dep.mmt')) {
        return `type: test\nsteps:\n  - print: dep\n`;
      }

      return '';
    };

    const jsRuns: Array<{title: string; js: string}> = [];
    const jsRunner = async (ctx: any) => {
      jsRuns.push({title: String(ctx?.title ?? ''), js: String(ctx?.js ?? '')});
    };

    const res = await runFile({
      fileType: 'path',
      file: '/root/suite/suite.mmt',
      filePath: '/root/suite/suite.mmt',
      fileLoader,
      jsRunner,
      logger: () => {},
    } as any);

    expect(res.docType).toBe('suite');

    const testRun = jsRuns.find(r => r.title.includes('test.mmt'));
    expect(testRun).toBeTruthy();

    // The generated JS should include the imported dependency function.
    expect(testRun?.js.includes('dep_')).toBe(true);
  });

  it('resolves generated +/suites and +/tests items via projectRoot', async () => {
    const files: Record<string, string> = {
      '/project/suites/collection.mmt': [
        'type: suite',
        'items:',
        '  - +/suites/auth.mmt',
      ].join('\n'),
      '/project/suites/auth.mmt': [
        'type: suite',
        'title: Auth',
        'items:',
        '  - +/tests/auth.mmt',
      ].join('\n'),
      '/project/tests/auth.mmt': [
        'type: test',
        'title: Auth test',
        'import:',
        '  login: +/api/login.mmt',
        'steps:',
        '  - print: ok',
      ].join('\n'),
      '/project/api/login.mmt': [
        'type: api',
        'url: https://example.com/login',
        'method: GET',
      ].join('\n'),
    };
    const loaded: string[] = [];
    const fileLoader = async (p: string) => {
      const normalized = String(p).replace(/\\/g, '/');
      loaded.push(normalized);
      return files[normalized] ?? '';
    };
    const jsRuns: Array<{title: string; js: string}> = [];

    const res = await runFile({
      fileType: 'raw',
      file: files['/project/suites/collection.mmt'],
      filePath: '/project/suites/collection.mmt',
      fileLoader,
      projectRoot: '/project',
      jsRunner: async (ctx: any) => {
        jsRuns.push({title: String(ctx?.title ?? ''), js: String(ctx?.js ?? '')});
      },
      logger: () => {},
    } as any);

    expect(res.docType).toBe('suite');
    expect(res.result.success).toBe(true);
    expect(loaded).toContain('/project/suites/auth.mmt');
    expect(loaded).toContain('/project/tests/auth.mmt');
    expect(jsRuns.some((r) => r.title.includes('Auth test') || r.title.includes('auth.mmt'))).toBe(true);
    expect(jsRuns.some((r) => r.js.includes('login_'))).toBe(true);
  });
});
