import {
  flowStagesToJsfunc,
  APIContext,
  TestContext,
  importTestToJsfunc,
  importCSVToJSObj,
  importsToJsfunc,
  setFileLoader,
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
  it('generates code for a test with only stages', async () => {
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
    const js = await importTestToJsfunc(ctx);
    (globalThis as any).flowStagesToJsfunc = originalFlowStagesToJsfunc;
    expect(js).toContain('const stage1Promise = (async () =>');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise]);');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });
});

describe('CSV import parsing', () => {
  it('parses simple CSV into array of objects with number coercion', async () => {
    const csv = `name,family,age\nmehrdad,shobeyri,35\nsahar,ghazeydi,34\n`;
    const code = await importCSVToJSObj(csv, 'users');
    const users = new Function(code + '\nreturn users;')();
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({ name: 'mehrdad', family: 'shobeyri', age: 35 });
    expect(users[1]).toEqual({ name: 'sahar', family: 'ghazeydi', age: 34 });
  });

  it('returns empty array when content looks like YAML not CSV', async () => {
    const yamlLike = `type: api\nprotocol: http\n`;
    const code = await importCSVToJSObj(yamlLike, 'users');
    const users = new Function(code + '\nreturn users;')();
    expect(users).toEqual([]);
  });

  it('wires through importsToJsfunc with a loader', async () => {
    const csv = `name,family,age\nmehrdad,shobeyri,35\n`;
    setFileLoader(async (p: string) => {
      if (p.endsWith('.csv')) { return csv; }
      return '';
    });
    const bundle = await importsToJsfunc({ users: 'users.csv' });
    const users = new Function(bundle + '\nreturn users;')();
    expect(users).toEqual([{ name: 'mehrdad', family: 'shobeyri', age: 35 }]);
  });
});
