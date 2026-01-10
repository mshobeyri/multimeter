import {buildFilteredSuiteYaml} from './suiteTargets';
import {markupConvertor} from 'mmt-core';

const {parseYaml} = markupConvertor as any;

describe('buildFilteredSuiteYaml', () => {
  const baseSuite = `type: suite
title: Demo
tests:
  - a.mmt
  - b.mmt
  - then
  - c.mmt
  - d.mmt
`;

  it('keeps only targeted entries and preserves group order', () => {
    const filtered = buildFilteredSuiteYaml(baseSuite, ['0:1', '1:0']);
    expect(filtered).not.toBe(baseSuite);
    const parsed = parseYaml(filtered);
    expect(parsed.tests).toEqual(['b.mmt', 'then', 'c.mmt']);
  });

  it('returns original text when targets empty or invalid', () => {
    expect(buildFilteredSuiteYaml(baseSuite, [])).toBe(baseSuite);
    expect(buildFilteredSuiteYaml(baseSuite, ['invalid'])).toBe(baseSuite);
  });

  it('returns original when suite structure invalid or type mismatch', () => {
    const notSuite = 'type: test\nsteps: []\n';
    expect(buildFilteredSuiteYaml(notSuite, ['0:0'])).toBe(notSuite);

    const badSuite = `type: suite\ntests:\n  - then\n  - a.mmt\n`;
    expect(buildFilteredSuiteYaml(badSuite, ['0:0'])).toBe(badSuite);
  });
});
