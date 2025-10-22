import { yamlToTest, testToYaml, getTestFlowStepType } from './testParsePack';
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
