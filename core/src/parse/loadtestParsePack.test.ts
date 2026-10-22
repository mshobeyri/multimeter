import {loadtestToYaml, yamlToLoadTest} from './loadtestParsePack';

describe('loadtestParsePack', () => {
  it('parses loadtest with single test and load fields', () => {
    const raw = `type: loadtest\ntitle: X\nthreads: 100\nrepeat: 1m\nrampup: 10s\ntest: login.mmt\n`;
    const loadtest = yamlToLoadTest(raw);
    expect(loadtest.type).toBe('loadtest');
    expect(loadtest.title).toBe('X');
    expect(loadtest.threads).toBe(100);
    expect(loadtest.repeat).toBe('1m');
    expect(loadtest.rampup).toBe('10s');
    expect(loadtest.test).toBe('login.mmt');
  });

  it('parses environment and exports', () => {
    const raw = `
type: loadtest
environment:
  preset: perf
export:
  - ./reports/results.mmt
test: test.mmt
repeat: 10
`;
    const loadtest = yamlToLoadTest(raw);
    expect(loadtest.environment?.preset).toBe('perf');
    expect(loadtest.export).toEqual(['./reports/results.mmt']);
    expect(loadtest.repeat).toBe(10);
  });

  it('serializes loadtest in canonical order', () => {
    const yaml = loadtestToYaml({type: 'loadtest', test: 'test.mmt', threads: 100, repeat: '1m', rampup: '10s'});
    expect(yaml).toContain('type: loadtest');
    expect(yaml).toContain('threads: 100');
    expect(yaml).toContain('repeat: 1m');
    expect(yaml).toContain('rampup: 10s');
    expect(yaml).toContain('test: test.mmt');
  });

  it('parses tags import env file and serializes them', () => {
    const loadtest = yamlToLoadTest(`
type: loadtest
title: T
description: D
tags:
  - smoke
  - ''
import:
  login: ./login.mmt
environment:
  file: env.mmt
  variables:
    k: v
export:
  - out.html
test: t.mmt
repeat: 5
`);
    expect(loadtest.tags).toEqual(['smoke']);
    expect(loadtest.import).toEqual({login: './login.mmt'});
    expect(loadtest.environment?.file).toBe('env.mmt');
    expect(loadtest.environment?.variables).toEqual({k: 'v'});
    const yaml = loadtestToYaml(loadtest);
    expect(yaml).toContain('description: D');
    expect(yaml).toContain('smoke');
    expect(yaml).toContain('file: env.mmt');
  });

  it('rejects invalid loadtest documents', () => {
    expect(() => yamlToLoadTest('type: test\n')).toThrow(/Not a loadtest/);
    expect(() => yamlToLoadTest('type: loadtest\nrepeat: 1\n')).toThrow(/non-empty string/);
    expect(() => yamlToLoadTest('type: loadtest\ntest: t.mmt\n')).toThrow(/repeat is required/);
    expect(yamlToLoadTest('type: loadtest\ntest: t.mmt\nrepeat: 1\n').threads).toBe(1);
    expect(yamlToLoadTest('type: loadtest\ntest: t.mmt\nrepeat: 1\nenvironment: {}\n').environment)
        .toBeUndefined();
  });
});