import {runFile} from './runner';

describe('runner suite import base', () => {
  it('resolves imported paths relative to each suite item file', async () => {
    const fileLoader = async (p: string) => {
      const normalized = String(p).replace(/\\/g, '/');

      if (normalized.endsWith('/suite/suite.mmt')) {
        // suite file is in /root/suite, but it references a test in /root/other
        return `type: suite\ntests:\n  - ../other/test.mmt\n`;
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
});
