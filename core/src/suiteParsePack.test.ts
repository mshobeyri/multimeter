import {splitSuiteGroups, suiteToYaml, yamlToSuite} from './suiteParsePack';

describe('suiteParsePack', () => {
  it('parses suite and keeps then tokens', () => {
    const raw = `type: suite\ntitle: X\ntests:\n  - a.mmt\n  - then\n  - b.mmt\n`;
    const suite = yamlToSuite(raw);
    expect(suite.type).toBe('suite');
    expect(suite.title).toBe('X');
    expect(suite.tests).toEqual(['a.mmt', 'then', 'b.mmt']);
  });

  it('splits into groups by then', () => {
    expect(splitSuiteGroups(['a', 'then', 'b', 'c', 'then', 'd']))
        .toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('rejects leading then', () => {
    expect(() => splitSuiteGroups(['then', 'a']))
        .toThrow(/empty group/i);
  });

  it('rejects trailing then', () => {
    expect(() => splitSuiteGroups(['a', 'then']))
        .toThrow(/cannot end/i);
  });

  it('parses environment config with preset and variables', () => {
    const raw = `
type: suite
title: With Environment
environment:
  preset: staging
  file: ./envs/custom.mmt
  variables:
    API_URL: http://localhost:8080
    DEBUG: true
tests:
  - test.mmt
`;
    const suite = yamlToSuite(raw);
    expect(suite.environment).toBeDefined();
    expect(suite.environment?.preset).toBe('staging');
    expect(suite.environment?.file).toBe('./envs/custom.mmt');
    expect(suite.environment?.variables).toEqual({
      API_URL: 'http://localhost:8080',
      DEBUG: true,
    });
  });

  it('parses export paths', () => {
    const raw = `
type: suite
title: With Exports
tests:
  - test.mmt
export:
  - ./reports/results.xml
  - +/reports/summary.html
`;
    const suite = yamlToSuite(raw);
    expect(suite.export).toEqual([
      './reports/results.xml',
      '+/reports/summary.html',
    ]);
  });

  it('ignores empty environment config', () => {
    const raw = `
type: suite
title: Empty Env
environment: {}
tests:
  - test.mmt
`;
    const suite = yamlToSuite(raw);
    expect(suite.environment).toBeUndefined();
  });

  it('ignores empty export array', () => {
    const raw = `
type: suite
title: Empty Export
tests:
  - test.mmt
export: []
`;
    const suite = yamlToSuite(raw);
    expect(suite.export).toBeUndefined();
  });

  it('suiteToYaml does not add title when missing', () => {
    const yaml = suiteToYaml({type: 'suite', tests: ['test.mmt']});
    expect(yaml).toContain('type: suite');
    expect(yaml).not.toContain('title:');
  });
});
