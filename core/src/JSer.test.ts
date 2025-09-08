import {
  flowStagesToJsfunc,
  testToJsfunc,
  APIContext,
  TestContext,
} from './JSer';

describe('flowStagesToJsfunc', () => {
  it('generates parallel execution for independent stages', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          { type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a'] },
        ],
      },
      {
        id: 'stage2',
        steps: [
          { type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b'] },
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any);
    expect(js).toContain('const stage1Promise = (async () =>');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });

  it('generates dependency handling for dependent stages', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          { type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a'] },
        ],
      },
      {
        id: 'stage2',
        dependencies: ['stage1'],
        steps: [
          { type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b'] },
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any);
    expect(js).toContain('await Promise.all([stage1Promise]);');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });

  it('handles multiple dependencies', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          { type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a'] },
        ],
      },
      {
        id: 'stage2',
        steps: [
          { type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b'] },
        ],
      },
      {
        id: 'stage3',
        dependencies: ['stage1', 'stage2'],
        steps: [
          { type: 'call', id: 'step3', target: 'apiFunc3', inputs: ['c'] },
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any);
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
    expect(js).toContain('const stage3Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise, stage3Promise]);');
  });
});

describe('testToJsfunc (multi-stage)', () => {
  it('generates code for a test with only stages', () => {
    const ctx: TestContext = {
      name: 'multiStageTest',
      test: {
        stages: [
          {
            id: 'stage1',
            steps: [
              { type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a'] },
            ],
          },
          {
            id: 'stage2',
            dependencies: ['stage1'],
            steps: [
              { type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b'] },
            ],
          },
        ],
      } as any,
      inputs: { a: '', b: '' },
      envVars: {},
    };
    // Patch testToJsfunc to use flowStagesToJsfunc for this test
    const originalFlowStagesToJsfunc = (globalThis as any).flowStagesToJsfunc;
    (globalThis as any).flowStagesToJsfunc = flowStagesToJsfunc;
    const js = testToJsfunc(ctx);
    (globalThis as any).flowStagesToJsfunc = originalFlowStagesToJsfunc;
    expect(js).toContain('const stage1Promise = (async () =>');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise]);');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });
});
