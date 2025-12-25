import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';

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
});
