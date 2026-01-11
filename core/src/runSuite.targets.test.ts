import {runFile} from './runner';

describe('runSuite partial targets', () => {
  it('runs only selected suite items when suiteTargets provided', async () => {
    const fileLoader = async (p: string) => {
      const normalized = String(p).replace(/\\/g, '/');
      if (normalized.endsWith('/root/suite.mmt')) {
        return `type: suite\n` +
            `tests:\n` +
            `  - ./a.test.mmt\n` +
            `  - ./b.test.mmt\n`;
      }
      if (normalized.endsWith('/root/a.test.mmt')) {
        return `type: test\nsteps:\n  - print: a\n`;
      }
      if (normalized.endsWith('/root/b.test.mmt')) {
        return `type: test\nsteps:\n  - print: b\n`;
      }
      return '';
    };

    const ranTitles: string[] = [];
    const jsRunner = async (ctx: any) => {
      ranTitles.push(String(ctx?.title ?? ''));
    };

    const res = await runFile({
      fileType: 'path',
      file: '/root/suite.mmt',
      filePath: '/root/suite.mmt',
      fileLoader,
      jsRunner,
      logger: () => {},
      reporter: () => {},
      suiteTargets: ['0:1'],
    } as any);

    expect(res.docType).toBe('suite');
    expect(ranTitles.some(t => t.includes('b.test.mmt'))).toBe(true);
    expect(ranTitles.some(t => t.includes('a.test.mmt'))).toBe(false);
  });
});
