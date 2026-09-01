import {
  parseYamlSectionEntries,
  parseYamlSectionKeys,
  parseYamlSectionMap,
} from './autocompleteYamlSection';

describe('parseYamlSectionKeys', () => {
  it('reads top-level inputs keys and skips nested fields', () => {
    const raw = [
      'type: test',
      'inputs:',
      '  userId: 123',
      '  obj:',
      '    inner: 1',
      '  foo-bar: hi',
      'steps:',
      '  - call: api',
    ].join('\n');
    expect(parseYamlSectionKeys(raw, 'inputs')).toEqual(['foo-bar', 'obj', 'userId']);
  });
});

describe('parseYamlSectionMap', () => {
  it('reads root import aliases and paths', () => {
    const raw = [
      'type: test',
      'import:',
      '  login: ./login.mmt',
      '  data: "./users.json"',
      '  empty:',
      'steps:',
    ].join('\n');
    expect(parseYamlSectionMap(raw, 'import', {rootOnly: true, requireValue: true})).toEqual({
      login: './login.mmt',
      data: './users.json',
    });
  });

  it('ignores a nested import when rootOnly is set', () => {
    const raw = [
      'type: test',
      'steps:',
      '  - call: x',
      '    import:',
      '      nested: ./no.mmt',
    ].join('\n');
    expect(parseYamlSectionMap(raw, 'import', {rootOnly: true, requireValue: true})).toEqual({});
  });
});

describe('parseYamlSectionEntries', () => {
  it('keeps empty values when requireValue is off', () => {
    const raw = 'outputs:\n  token:\n  status: status\n';
    expect(parseYamlSectionEntries(raw, 'outputs', {rootOnly: true})).toEqual([
      {key: 'token', value: ''},
      {key: 'status', value: 'status'},
    ]);
  });
});
