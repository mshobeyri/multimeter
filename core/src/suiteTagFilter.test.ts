import {
  decideTagRun,
  isEmptyTagFilter,
  mergeTagFilter,
  parseSuiteYamlFilter,
  tagFilterFromLists,
  tagFilterFromYaml,
} from './suiteTagFilter';

describe('suiteTagFilter', () => {
  it('parses object and list-shorthand YAML filter', () => {
    expect(parseSuiteYamlFilter({only: ['smoke', ' api '], skip: ['flaky', 'flaky']})).toEqual({
      only: ['smoke', 'api'],
      skip: ['flaky'],
    });
    expect(parseSuiteYamlFilter(['smoke', 'api'])).toEqual({only: ['smoke', 'api']});
    expect(parseSuiteYamlFilter({only: [], skip: []})).toBeUndefined();
    expect(parseSuiteYamlFilter(null)).toBeUndefined();
    expect(parseSuiteYamlFilter('smoke')).toBeUndefined();
    expect(parseSuiteYamlFilter({only: [1, 'smoke', 'smoke']})).toEqual({only: ['1', 'smoke']});
  });

  it('treats missing or empty filters as empty', () => {
    expect(isEmptyTagFilter(undefined)).toBe(true);
    expect(isEmptyTagFilter({})).toBe(true);
    expect(isEmptyTagFilter({only: [[]], skip: []})).toBe(true);
    expect(isEmptyTagFilter(tagFilterFromLists(['smoke']))).toBe(false);
    expect(isEmptyTagFilter(tagFilterFromLists(undefined, ['wip']))).toBe(false);
  });

  it('treats empty only as all and empty skip as none', () => {
    const filter = tagFilterFromYaml({});
    expect(decideTagRun('test', undefined, filter, false)).toBe('run');
    expect(decideTagRun('test', ['slow'], filter, false)).toBe('run');
  });

  it('applies only then skip', () => {
    const filter = tagFilterFromLists(['smoke'], ['wip']);
    expect(decideTagRun('test', ['smoke'], filter, false)).toBe('run');
    expect(decideTagRun('test', ['smoke', 'wip'], filter, false)).toBe('skip');
    expect(decideTagRun('test', ['other'], filter, false)).toBe('skip');
    expect(decideTagRun('test', undefined, filter, false)).toBe('skip');
  });

  it('ORs tags in one only list and descends unmatched suites', () => {
    const filter = tagFilterFromLists(['smoke', 'api']);
    expect(decideTagRun('test', ['api'], filter, false)).toBe('run');
    expect(decideTagRun('suite', undefined, filter, false)).toBe('descend');
    expect(decideTagRun('suite', ['smoke'], filter, false)).toBe('run');
  });

  it('runs untagged children when parent suite is selected', () => {
    const filter = tagFilterFromLists(['smoke'], ['slow']);
    expect(decideTagRun('test', undefined, filter, true)).toBe('run');
    expect(decideTagRun('test', ['slow'], filter, true)).toBe('skip');
  });

  it('ANDs nested only layers and ORs skip tags', () => {
    const parent = tagFilterFromLists(['smoke'], ['wip']);
    const nested = tagFilterFromLists(['api'], ['flaky']);
    const merged = mergeTagFilter(parent, nested);
    expect(decideTagRun('test', ['smoke', 'api'], merged, false)).toBe('run');
    expect(decideTagRun('test', ['smoke'], merged, false)).toBe('skip');
    expect(decideTagRun('test', ['smoke', 'api', 'wip'], merged, false)).toBe('skip');
    expect(decideTagRun('test', ['smoke', 'api', 'flaky'], merged, false)).toBe('skip');
    expect(mergeTagFilter({only: [[]]}, {only: [[]]}).only).toBeUndefined();
  });
});
