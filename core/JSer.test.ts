import {APIContext, apiToJSfunc, checkToJSfunc, conditionalStatementToJSfunc, flowStepsToJsfunc, forToJSfunc, ifToJSfunc, importsToJsfunc, repeatToJSfunc, TestContext, testToJsfunc,} from './JSer';

describe('apiToJSfunc', () => {
  it('generates a function with correct input parameters', () => {
    const ctx: APIContext = {
      name: 'myApi',
      api: {
        type: 'api',
        protocol: 'http',
        format: 'json',
        url: 'http://example.com',
        inputs: {foo: '', bar: ''},
        outputs: {result: ''}
      },
      inputs: {},
      envVars: {}
    };
    const fnStr = apiToJSfunc(ctx);
    expect(fnStr).toContain('async function myApi(foo, bar)');
    expect(fnStr).toContain('return finalOutputs;');
  });
});

describe('importsToJsfunc', () => {
  it('returns empty string for empty imports', () => {
    expect(importsToJsfunc({})).toBe('');
  });
});

describe('conditionalStatementToJSfunc', () => {
  it('returns correct JS for < operator', () => {
    expect(conditionalStatementToJSfunc('a < b')).toBe('less(a, b)');
  });
  it('throws on invalid format', () => {
    expect(() => conditionalStatementToJSfunc('a <')).toThrow();
  });
});

describe('ifToJSfunc', () => {
  it('generates if block without else', () => {
    const cond = { if: 'a < b', steps: [{type: 'check', check: 'x == y'}] };
    const js = ifToJSfunc(cond as any);
    expect(js).toContain('if (less(a, b))');
    expect(js).toContain('throw new Error');
  });
  it('generates if-else block', () => {
    const cond = {
      if: 'a < b',
      steps: [{type: 'check', check: 'x == y'}],
      else: [{type: 'check', check: 'x != y'}]
    };
    const js = ifToJSfunc(cond as any);
    expect(js).toContain('else');
    expect(js).toContain('notEquals(x, y)');
  });
});

describe('repeatToJSfunc', () => {
  it('generates repeat loop', () => {
    const loop = {repeat: 3, steps: [{type: 'check', check: 'a == b'}]};
    const js = repeatToJSfunc(loop as any);
    expect(js).toContain('for (let i = 0; i < 3; i++)');
    expect(js).toContain('throw new Error');
  });
});

describe('forToJSfunc', () => {
  it('generates for loop', () => {
    const loop = {
      for: 'let i = 0; i < 5; i++',
      steps: [{type: 'check', check: 'a == b'}]
    };
    const js = forToJSfunc(loop as any);
    expect(js).toContain('for (let i = 0; i < 5; i++)');
    expect(js).toContain('throw new Error');
  });
});

describe('checkToJSfunc', () => {
  it('generates check statement', () => {
    const js = checkToJSfunc('a == b');
    expect(js).toContain('if (!equals(a, b))');
    expect(js).toContain('throw new Error');
  });
});

describe('flowStepsToJsfunc', () => {
  it('handles call, check, if, repeat, for', () => {
    const flow = [
      {type: 'call', id: 'step1', target: 'apiFunc', inputs: ['x', 'y', 'z']},
      {type: 'check', check: 'a == b'},
      {
        type: 'if', if: 'a < b', steps: [{type: 'check', check: 'x == y'}],
            else: [{type: 'check', check: 'x != y'}]
      },
      {type: 'repeat', repeat: 2, steps: [{type: 'check', check: 'a == b'}]},
      {
        type: 'for', for: 'let i = 0; i < 3; i++',
            steps: [{type: 'check', check: 'a == b'}]
      }
    ];
    const js = flowStepsToJsfunc(flow as any);
    expect(js).toContain('const step1 = await apiFunc(x, y, z);');
    expect(js).toContain('throw new Error');
    expect(js).toContain('if (less(a, b))');
    expect(js).toContain('for (let i = 0; i < 2; i++)');
    expect(js).toContain('for (let i = 0; i < 3; i++)');
  });
});

describe('testToJsfunc', () => {
  it('generates a test function', () => {
    const ctx: TestContext = {
      name: 'myTest',
      inputs: {x: '', y: ''},
      test: {
        flow:
            [{type: 'call', id: 'step1', target: 'apiFunc', inputs: ['x', 'y']}]
      } as any,
      envVars: {ENV1: ''}
    };
    const js = testToJsfunc(ctx);
    expect(js).toContain('const myTest = async(x, y)');
    expect(js).toContain('const step1 = await apiFunc(x, y);');
    expect(js).toContain('return result;');
  });

  it('generates a test function', () => {
    const ctx: TestContext = {
      name: 'myTest',
      inputs: {x: '', y: ''},
      test: {
        flow: [
          {type: 'call', id: 'step1', target: 'apiFunc', inputs: ['x', 'y']},
          {
            type: 'call',
            id: 'step2',
            target: 'apiFunc',
            inputs: ['x', 'y', 'z']
          },
          {type: 'check', check: 'step1.output == step2.output'},
          {
            type: 'if', if: 'a < b', steps: [{type: 'check', check: 'x == y'}],
                else: [{type: 'check', check: 'x != y'}]
          },
          {
            type: 'repeat',
            repeat: 2,
            steps: [{type: 'check', check: 'a == b'}]
          },
          {
            type: 'for', for: 'let i = 0; i < 3; i++',
                steps: [{type: 'check', check: 'a == b'}]
          }
        ]
      } as any,
      envVars: {ENV1: ''}
    };
    const js = testToJsfunc(ctx);
    expect(js).toContain('const myTest = async(x, y)');
    expect(js).toContain('const step1 = await apiFunc(x, y);');
    expect(js).toContain('return result;');
  });
});
