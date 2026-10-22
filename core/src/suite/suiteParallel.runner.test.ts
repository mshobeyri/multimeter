import {createSuiteBundle} from './suiteBundle';
import {executeSuiteBundle} from './suiteBundleRunner';

describe('suite parallel limit in executeSuiteBundle', () => {
  it('caps overlapping test/api starts at suiteParallel', async () => {
    const childPaths = Array.from({length: 6}, (_, i) => `/root/t${i}.mmt`);
    const hierarchy = {
      kind: 'suite' as const,
      id: 'root',
      path: '/root/suite.mmt',
      title: 'Parallel Cap',
      children: childPaths.map((p, i) => ({
        kind: 'test' as const,
        id: `t${i}`,
        path: p,
        title: `T${i}`,
      })),
    };
    const bundle = createSuiteBundle({
      rootSuitePath: '/root/suite.mmt',
      hierarchy,
    } as any);

    let inFlight = 0;
    let peak = 0;
    const runFile = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 25));
      inFlight -= 1;
      return {
        docType: 'test' as const,
        displayName: 't',
        identifier: 't',
        js: '',
        result: {success: true, durationMs: 1, errors: [], logs: []},
        inputsUsed: {},
        envVarsUsed: {},
      };
    };

    const outcome = await executeSuiteBundle({
      bundle,
      options: {
        file: '',
        fileType: 'raw',
        filePath: '/root/suite.mmt',
        fileLoader: async (p: string) =>
          childPaths.includes(p) ? 'type: test\nsteps:\n  - print: ok\n' : '',
        jsRunner: async () => {},
        logger: () => {},
        reporter: () => {},
        suiteParallel: 2,
      },
      preLogs: [],
      runFile,
    });

    expect(outcome.result.success).toBe(true);
    expect(peak).toBe(2);
    expect(inFlight).toBe(0);
  });
});
