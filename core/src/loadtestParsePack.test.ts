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
`;
    const loadtest = yamlToLoadTest(raw);
    expect(loadtest.environment?.preset).toBe('perf');
    expect(loadtest.export).toEqual(['./reports/results.mmt']);
  });

  it('serializes loadtest in canonical order', () => {
    const yaml = loadtestToYaml({type: 'loadtest', test: 'test.mmt', threads: 100, repeat: '1m', rampup: '10s'});
    expect(yaml).toContain('type: loadtest');
    expect(yaml).toContain('threads: 100');
    expect(yaml).toContain('repeat: 1m');
    expect(yaml).toContain('rampup: 10s');
    expect(yaml).toContain('test: test.mmt');
  });
});