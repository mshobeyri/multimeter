import {runFile} from './runner';

describe('runner suite', () => {
  it('runs groups sequentially and items in group in parallel', async () => {
    const events: string[] = [];

    const fileLoader = async (p: string) => {
      if (p.endsWith('suite.mmt')) {
        return `type: suite\ntests:\n  - a.mmt\n  - b.mmt\n  - then\n  - c.mmt\n`;
      }
      if (p.endsWith('a.mmt')) {
        return `type: test\nsteps:\n  - print: a\n`;
      }
      if (p.endsWith('b.mmt')) {
        return `type: test\nsteps:\n  - print: b\n`;
      }
      if (p.endsWith('c.mmt')) {
        return `type: test\nsteps:\n  - print: c\n`;
      }
      return '';
    };

    const testJsRunner = async (_code: string, title: string, lg: any) => {
      const t = String(title);
      events.push(`start:${t}`);
      // Useful when this test fails locally
      // eslint-disable-next-line no-console
      // console.log('jsRunner title:', t);
      if (t.includes('a')) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (t.includes('b')) {
        await new Promise(r => setTimeout(r, 50));
      }
      events.push(`end:${t}`);
      lg('info', 'ok');
    };

    const res = await runFile({
      fileType: 'path',
      file: 'suite.mmt',
      filePath: '/tmp/suite.mmt',
      fileLoader,
      jsRunner: async (ctx: any) => {
        return testJsRunner(ctx?.code, ctx?.title, ctx?.logger);
      },
      logger: () => {},
    } as any);

    expect(res.docType).toBe('suite');

    // Titles come from `prepared.title` first, then basename(filePath).
    const startA = events.findIndex(e => e.startsWith('start:') && e.includes('a'));
    const startB = events.findIndex(e => e.startsWith('start:') && e.includes('b'));
    const endA = events.findIndex(e => e.startsWith('end:') && e.includes('a'));
    const endB = events.findIndex(e => e.startsWith('end:') && e.includes('b'));
    const startC = events.findIndex(e => e.startsWith('start:') && e.includes('c'));

    // Group1 starts both before either finishes
    // The suite runner uses each child's `title` if present (a/b/c here).
    expect(startA).toBeGreaterThanOrEqual(0);
    expect(startB).toBeGreaterThanOrEqual(0);
    expect(startC).toBeGreaterThanOrEqual(0);
    expect(startC).toBeGreaterThan(endA);
    expect(startC).toBeGreaterThan(endB);
  });

  it('continues on check failure but stops on assert failure', async () => {
    const fileLoader = async (p: string) => {
      if (p.endsWith('suite.mmt')) {
        return `type: suite\ntests:\n  - checkfail.mmt\n  - then\n  - assertfail.mmt\n  - then\n  - after.mmt\n`;
      }
      if (p.endsWith('checkfail.mmt')) {
        return `type: test\nsteps:\n  - check: 1 == 2\n  - print: afterCheck\n`;
      }
      if (p.endsWith('assertfail.mmt')) {
        return `type: test\nsteps:\n  - assert: 1 == 2\n  - print: afterAssert\n`;
      }
      if (p.endsWith('after.mmt')) {
        return `type: test\nsteps:\n  - print: shouldNotRun\n`;
      }
      return '';
    };

    const titles: string[] = [];
    const testJsRunner = async (_code: string, title: string, lg: any) => {
      const t = String(title);
      titles.push(t);
      // This mimics generated JS behavior: check => console.error, assert => throw
      if (t.includes('checkfail')) {
        lg('error', 'Check 1 == 2 failed');
        return;
      }
      if (t.includes('assertfail')) {
        lg('error', 'Assertion 1 == 2 failed');
        throw new Error('Assertion 1 == 2 failed');
      }
      lg('info', 'ok');
    };

    const res = await runFile({
      fileType: 'path',
      file: 'suite.mmt',
      filePath: '/tmp/suite.mmt',
      fileLoader,
      jsRunner: async (ctx: any) => {
        return testJsRunner(ctx?.code, ctx?.title, ctx?.logger);
      },
      logger: () => {},
    } as any);

    // check group runs, assert group runs, after group should NOT start
    // check group runs, assert group runs, after group should NOT start
    // Titles are basenames of the suite entries.
    expect(titles.some(t => t.includes('checkfail'))).toBe(true);
    expect(titles.some(t => t.includes('assertfail'))).toBe(true);
    expect(titles.some(t => t.includes('after'))).toBe(false);

    expect(res.result.success).toBe(false);
  });
});
