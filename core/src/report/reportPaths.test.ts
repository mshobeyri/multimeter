import {applyProjectRootPaths, toProjectRootPath} from '../reportPaths';
import type {CollectedResults, TestRunResult} from '../reportCollector';

function makeRun(overrides: Partial<TestRunResult> = {}): TestRunResult {
  return {
    runId: 'r1',
    result: 'passed',
    steps: [],
    ...overrides,
  };
}

describe('toProjectRootPath', () => {
  it('rewrites absolute paths under the project root to +/', () => {
    expect(toProjectRootPath(
      '/proj/examples/a/test/foo.mmt',
      '/proj/examples/a',
    )).toBe('+/test/foo.mmt');
  });

  it('leaves +/ paths unchanged', () => {
    expect(toProjectRootPath('+/test/foo.mmt', '/proj')).toBe('+/test/foo.mmt');
  });

  it('leaves absolute paths outside the project root unchanged', () => {
    expect(toProjectRootPath('/other/foo.mmt', '/proj')).toBe('/other/foo.mmt');
  });

  it('leaves relative paths unchanged when project root is missing', () => {
    expect(toProjectRootPath('/proj/a.mmt')).toBe('/proj/a.mmt');
    expect(toProjectRootPath('test/a.mmt', '/proj')).toBe('test/a.mmt');
  });
});

describe('applyProjectRootPaths', () => {
  it('rewrites test run and suite paths', () => {
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 's',
        suitePath: '/proj/suite.mmt',
        startedAt: 1,
        success: true,
        totalRunnable: 1,
        testRuns: [
          makeRun({filePath: '/proj/test/a.mmt'}),
        ],
      },
      testRuns: [
        makeRun({filePath: '/proj/test/a.mmt'}),
        makeRun({filePath: '/proj/test/b.mmt'}),
      ],
    };

    const next = applyProjectRootPaths(results, '/proj');
    expect(next.suiteRun?.suitePath).toBe('+/suite.mmt');
    expect(next.suiteRun?.testRuns?.[0].filePath).toBe('+/test/a.mmt');
    expect(next.testRuns.map(r => r.filePath)).toEqual([
      '+/test/a.mmt',
      '+/test/b.mmt',
    ]);
    // Original unchanged
    expect(results.testRuns[0].filePath).toBe('/proj/test/a.mmt');
  });
});
