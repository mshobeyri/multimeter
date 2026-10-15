import {applyEnvVarLastUpdates, asEnvVarList} from './envVarLastUpdate';

describe('asEnvVarList', () => {
  it('returns arrays as-is', () => {
    const vars = [{name: 'A', value: 1}];
    expect(asEnvVarList(vars)).toBe(vars);
  });

  it('flattens object maps and empty/invalid input', () => {
    expect(asEnvVarList({A: {name: 'A', value: 1}})).toEqual([
      {name: 'A', value: 1},
    ]);
    expect(asEnvVarList(undefined)).toEqual([]);
    expect(asEnvVarList(null)).toEqual([]);
    expect(asEnvVarList('nope')).toEqual([]);
  });
});

describe('applyEnvVarLastUpdates', () => {
  const now = 1_700_000_000_000;

  it('stamps new vars with now', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'abc'}],
        [],
        now,
    )).toEqual([{name: 'TOKEN', value: 'abc', lastUpdate: now}]);
  });

  it('keeps previous lastUpdate when the value is unchanged', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'abc', label: 'prod'}],
        [{name: 'TOKEN', value: 'abc', lastUpdate: 111}],
        now,
    )).toEqual([{name: 'TOKEN', value: 'abc', label: 'prod', lastUpdate: 111}]);
  });

  it('stamps now when the value changes', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'xyz'}],
        [{name: 'TOKEN', value: 'abc', lastUpdate: 111}],
        now,
    )).toEqual([{name: 'TOKEN', value: 'xyz', lastUpdate: now}]);
  });

  it('backfills now when the value is unchanged but previous has no stamp', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'abc'}],
        [{name: 'TOKEN', value: 'abc'}],
        now,
    )).toEqual([{name: 'TOKEN', value: 'abc', lastUpdate: now}]);
  });

  it('ignores lastUpdate on the incoming vars', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'abc', lastUpdate: 999}],
        [{name: 'TOKEN', value: 'abc', lastUpdate: 111}],
        now,
    )).toEqual([{name: 'TOKEN', value: 'abc', lastUpdate: 111}]);
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'xyz', lastUpdate: 999}],
        [{name: 'TOKEN', value: 'abc', lastUpdate: 111}],
        now,
    )).toEqual([{name: 'TOKEN', value: 'xyz', lastUpdate: now}]);
  });

  it('treats 1 and "1" as different values', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'N', value: '1'}],
        [{name: 'N', value: 1, lastUpdate: 111}],
        now,
    )).toEqual([{name: 'N', value: '1', lastUpdate: now}]);
  });

  it('compares object values by JSON content', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'CFG', value: {a: 1}}],
        [{name: 'CFG', value: {a: 1}, lastUpdate: 111}],
        now,
    )).toEqual([{name: 'CFG', value: {a: 1}, lastUpdate: 111}]);
    expect(applyEnvVarLastUpdates(
        [{name: 'CFG', value: {a: 2}}],
        [{name: 'CFG', value: {a: 1}, lastUpdate: 111}],
        now,
    )).toEqual([{name: 'CFG', value: {a: 2}, lastUpdate: now}]);
  });

  it('accepts object-map previous storage', () => {
    expect(applyEnvVarLastUpdates(
        [{name: 'TOKEN', value: 'abc'}],
        {TOKEN: {name: 'TOKEN', value: 'abc', lastUpdate: 111}},
        now,
    )).toEqual([{name: 'TOKEN', value: 'abc', lastUpdate: 111}]);
  });

  it('returns an empty list for non-array next', () => {
    expect(applyEnvVarLastUpdates(undefined as any, [], now)).toEqual([]);
  });
});
