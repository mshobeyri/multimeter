import { yamlToTest, testToYaml, getTestFlowStepType, quoteExpectOperators } from './testParsePack';
import { TestData, TestFlowStep } from './TestData';

describe('testParsePack', () => {
  it('yamlToTest parses minimal and migrates legacy flow to steps', () => {
    const yaml = `
type: test
title: T1
flow:
  - { call: 'api.login' }
`;
    const t = yamlToTest(yaml);
    expect(t.type).toBe('test');
    expect(t.title).toBe('T1');
    expect(Array.isArray((t as any).steps)).toBe(true);
    expect((t as any).steps?.[0]).toHaveProperty('call');
  });

  it('testToYaml serializes only present fields', () => {
    const td: TestData = {
      type: 'test',
      title: 'T2',
      tags: ['a'],
      description: 'd',
      inputs: { a: 1 },
      outputs: { b: 'x' },
      steps: [ { call: 'api.user' } as any ]
    } as any;
    const y = testToYaml(td);
    expect(y).toContain('type: test');
    expect(y).toContain('title: T2');
    expect(y).toContain('tags:');
    expect(y).toContain('steps:');
    expect(y).not.toContain('stages:');
  });

  it('testToYaml drops empty maps', () => {
    const td: TestData = {
      type: 'test',
      title: 'T3',
      import: {},
      inputs: {},
      outputs: {},
      metrics: {},
    } as any;
    const y = testToYaml(td);
    expect(y).toContain('type: test');
    expect(y).not.toContain('import:');
    expect(y).not.toContain('inputs:');
  });

  it('getTestFlowStepType detects each known type including data', () => {
    const samples: Array<[TestFlowStep, string]> = [
      [{ stage: { id: 's', steps: [] } } as any, 'stage'],
      [{ step: { steps: [] } } as any, 'step'],
      [{ call: 'api.x' } as any, 'call'],
      [{ check: 'a==b' } as any, 'check'],
      [{ assert: 'a==b' } as any, 'assert'],
      [{ if: 'a==b', then: [], else: [] } as any, 'if'],
      [{ repeat: { times: '3s' }, steps: [] } as any, 'repeat'],
      [{ for: { name: 'i', from: 0, to: 1 }, steps: [] } as any, 'for'],
      [{ js: 'let a=1' } as any, 'js'],
      [{ print: 'x' } as any, 'print'],
      [{ data: 'users' } as any, 'data'],
      [{ set: { a: 1 } } as any, 'set'],
      [{ var: { a: 1 } } as any, 'var'],
      [{ const: { a: 1 } } as any, 'const'],
      [{ let: { a: 1 } } as any, 'let'],
      [{ stages: [] } as any, 'stages'],
      [{ steps: [] } as any, 'steps'],
    ];
    for (const [step, expected] of samples) {
      expect(getTestFlowStepType(step)).toBe(expected);
    }
    expect(getTestFlowStepType({} as any)).toBe('unknown');
  });
});

describe('quoteExpectOperators', () => {
  it('quotes != operator in expect block', () => {
    const yaml = 'expect:\n  status: != 200';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('status: "!= 200"');
  });

  it('quotes > operator in expect block', () => {
    const yaml = 'expect:\n  count: > 0';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('count: "> 0"');
  });

  it('quotes >= operator in expect block', () => {
    const yaml = 'expect:\n  count: >= 1';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('count: ">= 1"');
  });

  it('quotes !@ operator in expect block', () => {
    const yaml = 'expect:\n  body: !@ error';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('body: "!@ error"');
  });

  it('quotes !~ operator in expect block', () => {
    const yaml = 'expect:\n  msg: !~ /fail/';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('msg: "!~ /fail/"');
  });

  it('quotes !$ operator in expect block', () => {
    const yaml = 'expect:\n  path: !$ /end';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('path: "!$ /end"');
  });

  it('quotes !^ operator in expect block', () => {
    const yaml = 'expect:\n  path: !^ /start';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('path: "!^ /start"');
  });

  it('does not quote safe operators (==, <, <=, =@, =~, =^, =$)', () => {
    const yaml = 'expect:\n  a: == 200\n  b: < 100\n  c: <= 50\n  d: =@ ok\n  e: =~ /x/\n  f: =^ start\n  g: =$ end';
    const result = quoteExpectOperators(yaml);
    expect(result).toBe(yaml);
  });

  it('does not quote plain values (default equality)', () => {
    const yaml = 'expect:\n  status: 200\n  name: hello';
    const result = quoteExpectOperators(yaml);
    expect(result).toBe(yaml);
  });

  it('does not quote already-quoted values', () => {
    const yaml = 'expect:\n  status: "!= 200"\n  name: \'> 5\'';
    const result = quoteExpectOperators(yaml);
    expect(result).toBe(yaml);
  });

  it('quotes array items in expect block', () => {
    const yaml = 'expect:\n  status:\n    - != 500\n    - > 0';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('- "!= 500"');
    expect(result).toContain('- "> 0"');
  });

  it('does not modify lines outside expect block', () => {
    const yaml = 'type: test\nsteps:\n  - call: login\n    expect:\n      status: != 200\n    check:\n      - token != null';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('status: "!= 200"');
    expect(result).toContain('- token != null');
  });

  it('handles multiple expect blocks', () => {
    const yaml = 'steps:\n  - call: a\n    expect:\n      x: != 1\n  - call: b\n    expect:\n      y: > 5';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('x: "!= 1"');
    expect(result).toContain('y: "> 5"');
  });

  it('handles deeply indented expect blocks', () => {
    const yaml = '    expect:\n      status: != 200';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('status: "!= 200"');
  });

  it('escapes double quotes inside values', () => {
    const yaml = 'expect:\n  msg: != "salam"';
    const result = quoteExpectOperators(yaml);
    expect(result).toContain('msg: "!= \\"salam\\""');
  });
});

describe('yamlToTest with expect operators', () => {
  it('correctly parses != operator in expect', () => {
    const yaml = `
type: test
steps:
  - call: echo
    expect:
      statusCode_: != 200
      echoed_message: != salam
`;
    const t = yamlToTest(yaml);
    const step = (t as any).steps[0];
    expect(step.expect.statusCode_).toBe('!= 200');
    expect(step.expect.echoed_message).toBe('!= salam');
  });

  it('correctly parses > and >= operators in expect', () => {
    const yaml = `
type: test
steps:
  - call: api
    expect:
      count: > 0
      total: >= 10
`;
    const t = yamlToTest(yaml);
    const step = (t as any).steps[0];
    expect(step.expect.count).toBe('> 0');
    expect(step.expect.total).toBe('>= 10');
  });

  it('correctly parses array form with unsafe operators', () => {
    const yaml = `
type: test
steps:
  - call: api
    expect:
      status:
        - != 500
        - > 0
`;
    const t = yamlToTest(yaml);
    const step = (t as any).steps[0];
    expect(step.expect.status).toEqual(['!= 500', '> 0']);
  });

  it('preserves safe operators without quoting', () => {
    const yaml = `
type: test
steps:
  - call: api
    expect:
      status: == 200
      count: < 100
`;
    const t = yamlToTest(yaml);
    const step = (t as any).steps[0];
    expect(step.expect.status).toBe('== 200');
    expect(step.expect.count).toBe('< 100');
  });

  it('preserves plain values (default equality)', () => {
    const yaml = `
type: test
steps:
  - call: api
    expect:
      status: 200
      name: hello
`;
    const t = yamlToTest(yaml);
    const step = (t as any).steps[0];
    expect(step.expect.status).toBe(200);
    expect(step.expect.name).toBe('hello');
  });
});
