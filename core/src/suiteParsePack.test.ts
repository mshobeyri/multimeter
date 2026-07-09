import {splitSuiteGroups, suiteToYaml, yamlToSuite} from './suiteParsePack';

describe('suiteParsePack', () => {
  it('parses suite and keeps then tokens', () => {
    const raw = `type: suite\ntitle: X\nitems:\n  - a.mmt\n  - then\n  - b.mmt\n`;
    const suite = yamlToSuite(raw);
    expect(suite.type).toBe('suite');
    expect(suite.title).toBe('X');
    expect(suite.items).toEqual(['a.mmt', 'then', 'b.mmt']);
  });

  it('accepts legacy tests field as alias for items', () => {
    const raw = `type: suite\ntitle: Legacy\ntests:\n  - a.mmt\n  - then\n  - b.mmt\n`;
    const suite = yamlToSuite(raw);
    expect(suite.items).toEqual(['a.mmt', 'then', 'b.mmt']);
  });

  it('prefers items over legacy tests when both are present', () => {
    const raw = `type: suite\nitems:\n  - preferred.mmt\ntests:\n  - legacy.mmt\n`;
    const suite = yamlToSuite(raw);
    expect(suite.items).toEqual(['preferred.mmt']);
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
items:
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
items:
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
items:
  - test.mmt
`;
    const suite = yamlToSuite(raw);
    expect(suite.environment).toBeUndefined();
  });

  it('ignores empty export array', () => {
    const raw = `
type: suite
title: Empty Export
items:
  - test.mmt
export: []
`;
    const suite = yamlToSuite(raw);
    expect(suite.export).toBeUndefined();
  });

  it('suiteToYaml emits items', () => {
    const yaml = suiteToYaml({type: 'suite', items: ['test.mmt']});
    expect(yaml).toContain('type: suite');
    expect(yaml).toContain('items:');
    expect(yaml).not.toContain('title:');
    expect(yaml).not.toContain('tests:');
  });
});
