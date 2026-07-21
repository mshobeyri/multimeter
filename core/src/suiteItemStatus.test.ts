import {
  classifySuiteItemStatus,
  isValidationErrorMessage,
  worstSuiteItemStatus,
} from './suiteItemStatus';
import {runFile} from './runner';
import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';
import {createSuiteBundle} from './suiteBundle';
import {runGeneratedJs} from './runCommon';
import {AssertionFailedError} from './testHelper';

describe('suiteItemStatus', () => {
  it('detects validation messages', () => {
    expect(isValidationErrorMessage('Invalid test file: missing type')).toBe(true);
    expect(isValidationErrorMessage('Import error: circular')).toBe(true);
    expect(isValidationErrorMessage('Check 1 == 2 failed')).toBe(false);
  });

  it('classifies passed / invalid / failed', () => {
    expect(classifySuiteItemStatus({success: true, durationMs: 1, errors: []})).toBe('passed');
    expect(classifySuiteItemStatus({
      success: false, durationMs: 1, errors: [], syntaxError: true,
    })).toBe('invalid');
    expect(classifySuiteItemStatus({
      success: false, durationMs: 1, errors: ['Invalid test file: bad'],
    })).toBe('invalid');
    expect(classifySuiteItemStatus({
      success: false, durationMs: 1, errors: [], threw: true,
      executionError: 'x is not defined',
    })).toBe('invalid');
    expect(classifySuiteItemStatus({
      success: false, durationMs: 1, errors: ['check failed'],
    })).toBe('failed');
  });

  it('prefers itemStatus when present', () => {
    expect(classifySuiteItemStatus({
      success: false, durationMs: 1, errors: ['x is not defined'], itemStatus: 'invalid',
    })).toBe('invalid');
  });

  it('aggregates worst status as failed > invalid', () => {
    expect(worstSuiteItemStatus(['invalid', 'failed'])).toBe('failed');
    expect(worstSuiteItemStatus(['invalid', 'passed'])).toBe('invalid');
    expect(worstSuiteItemStatus(['passed'])).toBe('passed');
  });
});

describe('assertion abort is not an execution error', () => {
  it('does not set executionError for AssertionFailedError', async () => {
    const result = await runGeneratedJs(
        'run-assert',
        'throw new Error("unused");',
        'Assert Test',
        () => undefined,
        async () => {
          throw new AssertionFailedError();
        },
    );
    expect(result.success).toBe(false);
    expect(result.executionError).toBeUndefined();
    expect(result.threw).toBe(false);
  });
});

async function runSuiteWithEvents(
    files: Record<string, string>,
    suitePath: string,
    jsRunner: (ctx: any) => Promise<any>,
    options?: {target?: string; includeRunning?: boolean},
): Promise<Array<Record<string, any>>> {
  const fileLoader = async (p: string) => {
    const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
    if (!(normalized in files)) {
      throw new Error(`ENOENT: ${normalized}`);
    }
    return files[normalized];
  };
  const tree = await buildSuiteHierarchyFromSuiteFile({
    suiteFilePath: suitePath,
    suiteRawText: files[suitePath],
    fileLoader,
  });
  const bundle = createSuiteBundle({
    rootSuitePath: suitePath,
    hierarchy: tree,
    target: options?.target,
  });
  const events: Array<Record<string, any>> = [];
  await runFile({
    file: files[suitePath],
    fileType: 'raw' as any,
    filePath: suitePath,
    manualInputs: {},
    envvar: {},
    manualEnvvars: {},
    fileLoader,
    suiteBundle: bundle,
    jsRunner,
    logger: () => undefined,
    reporter: (event: any) => {
      events.push(event);
    },
  } as any);
  return events.filter(e =>
    e.scope === 'suite-item' &&
    e.status &&
    (options?.includeRunning || e.status !== 'running'));
}

describe('suite item status reporting', () => {
  it('emits invalid for malformed test files', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Invalid Child',
        'items:',
        '  - bad.mmt',
      ].join('\n'),
      '/root/bad.mmt': [
        'type: test',
        'title: Bad',
        'not_a_real_key: true',
        'steps:',
        '  - check: 1 == 1',
      ].join('\n'),
    };

    const itemEvents = await runSuiteWithEvents(files, '/root/parent.mmt', async () => ({}));
    expect(itemEvents.some(e => e.status === 'invalid')).toBe(true);
    expect(itemEvents.every(e => e.status !== 'failed')).toBe(true);
  });

  it('emits failed for check failures', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Fail Child',
        'items:',
        '  - fail.mmt',
      ].join('\n'),
      '/root/fail.mmt': [
        'type: test',
        'title: Fail',
        'steps:',
        '  - check: 1 == 2',
      ].join('\n'),
    };

    const itemEvents = await runSuiteWithEvents(files, '/root/parent.mmt', async (ctx: any) => {
      ctx.logger('error', '× Check fail');
      if (typeof ctx.reporter === 'function') {
        ctx.reporter({
          scope: 'test-step',
          status: 'failed',
          stepType: 'check',
          title: 'check',
        });
      }
    });
    expect(itemEvents.some(e => e.status === 'failed')).toBe(true);
  });

  it('emits invalid for unexpected runtime exceptions', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Error Child',
        'items:',
        '  - boom.mmt',
      ].join('\n'),
      '/root/boom.mmt': [
        'type: test',
        'title: Boom',
        'steps:',
        '  - check: 1 == 1',
      ].join('\n'),
    };

    const itemEvents = await runSuiteWithEvents(files, '/root/parent.mmt', async () => {
      throw new ReferenceError('pm is not defined');
    });
    expect(itemEvents.some(e => e.status === 'invalid')).toBe(true);
    expect(itemEvents.every(e => e.status !== 'failed')).toBe(true);
  });

  it('emits failed for AssertionFailedError', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Assert Child',
        'items:',
        '  - assert.mmt',
      ].join('\n'),
      '/root/assert.mmt': [
        'type: test',
        'title: Assert',
        'steps:',
        '  - assert: 1 == 2',
      ].join('\n'),
    };

    const itemEvents = await runSuiteWithEvents(files, '/root/parent.mmt', async (ctx: any) => {
      if (typeof ctx.reporter === 'function') {
        ctx.reporter({
          scope: 'test-step',
          status: 'failed',
          stepType: 'assert',
          title: 'assert',
        });
      }
      throw new AssertionFailedError();
    });
    expect(itemEvents.some(e => e.status === 'failed')).toBe(true);
    expect(itemEvents.every(e => e.status !== 'invalid')).toBe(true);
  });

  it('partial run of one duplicate suite path does not emit status for the other instance', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Basic Suite M',
        'items:',
        '  - suite2.mmt',
        '  - then',
        '  - suite1.mmt',
        '  - suite2.mmt',
      ].join('\n'),
      '/root/suite1.mmt': [
        'type: suite',
        'title: Suite 1',
        'items:',
        '  - t1.mmt',
      ].join('\n'),
      '/root/suite2.mmt': [
        'type: suite',
        'title: Suite 2',
        'items:',
        '  - t2.mmt',
      ].join('\n'),
      '/root/t1.mmt': [
        'type: test',
        'title: T1',
        'steps:',
        '  - check: 1 == 1',
      ].join('\n'),
      '/root/t2.mmt': [
        'type: test',
        'title: T2',
        'steps:',
        '  - check: 1 == 1',
      ].join('\n'),
    };

    const fileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      return files[normalized];
    };
    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/parent.mmt',
      suiteRawText: files['/root/parent.mmt'],
      fileLoader,
    });
    const firstSuite2 = (tree.children[0] as any).children[0];
    const secondSuite2 = (tree.children[1] as any).children[1];
    expect(firstSuite2.id).toBe('suite-node:0.0');
    expect(secondSuite2.id).toBe('suite-node:1.1');

    const itemEvents = await runSuiteWithEvents(
        files,
        '/root/parent.mmt',
        async () => ({success: true}),
        {target: firstSuite2.id, includeRunning: true},
    );

    const touched = new Set(itemEvents.map(e => e.id));
    expect(touched.has(firstSuite2.id)).toBe(true);
    expect(touched.has(secondSuite2.id)).toBe(false);
    expect([...touched].every(
        id => id === firstSuite2.id || String(id).startsWith(`${firstSuite2.id}.`),
    )).toBe(true);
    // Parent group must not receive status when a child suite is the target.
    expect(touched.has('suite-node:0')).toBe(false);
  });
});
