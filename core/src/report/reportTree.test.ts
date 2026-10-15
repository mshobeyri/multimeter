import { buildReportTree, parentSuiteNodeId, isGroupRun } from '../reportTree';
import type { TestRunResult } from '../reportCollector';

function makeRun(overrides: Partial<TestRunResult> = {}): TestRunResult {
  return {
    runId: 'run-1',
    result: 'passed',
    steps: [],
    ...overrides,
  };
}

describe('parentSuiteNodeId', () => {
  it('walks suite-node paths', () => {
    expect(parentSuiteNodeId('suite-node:0.1.2')).toBe('suite-node:0.1');
    expect(parentSuiteNodeId('suite-node:0')).toBe('suite-node:root');
    expect(parentSuiteNodeId('suite-node:root')).toBeUndefined();
    expect(parentSuiteNodeId('custom')).toBeUndefined();
  });
});

describe('buildReportTree', () => {
  it('omits group nodes and promotes their children', () => {
    const tree = buildReportTree([
      makeRun({ id: 'suite-node:0', displayName: 'Group 1', docType: 'group' }),
      makeRun({
        id: 'suite-node:0.0',
        displayName: 'pass.mmt',
        docType: 'test',
        steps: [{ stepIndex: 0, stepType: 'check', status: 'passed', expects: [], timestamp: 1 }],
      }),
      makeRun({
        id: 'suite-node:0.1',
        displayName: 'fail.mmt',
        docType: 'test',
        result: 'failed',
        steps: [{ stepIndex: 0, stepType: 'check', status: 'failed', expects: [], timestamp: 1 }],
      }),
    ]);

    expect(tree).toHaveLength(2);
    expect(tree.map(n => n.run.displayName)).toEqual(['pass.mmt', 'fail.mmt']);
    expect(tree.every(n => !isGroupRun(n.run))).toBe(true);
  });

  it('keeps nested suites under parents', () => {
    const tree = buildReportTree([
      makeRun({ id: 'suite-node:0', displayName: 'Group 1', docType: 'group' }),
      makeRun({ id: 'suite-node:0.0', displayName: 'nested.mmt', docType: 'suite', result: 'passed' }),
      makeRun({
        id: 'suite-node:0.0.0',
        displayName: 'child.mmt',
        docType: 'test',
        steps: [{ stepIndex: 0, stepType: 'check', status: 'passed', expects: [], timestamp: 1 }],
      }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].run.displayName).toBe('nested.mmt');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].run.displayName).toBe('child.mmt');
  });
});
