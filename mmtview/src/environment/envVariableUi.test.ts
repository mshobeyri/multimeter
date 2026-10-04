import {
  boardsToVariables,
  coerceEnvScalar,
  envListValueToInputBox,
  envScalarChoices,
  envVariableChoices,
  envVariablesSignature,
  pickEnvChoice,
  variablesToBoards,
} from './envVariableUi';

describe('envVariableUi', () => {
  it('preserves number / bool / null object fields', () => {
    const boards = variablesToBoards({
      port: {local: 8080, flag: true, empty: null},
    });
    expect(boards).toEqual([
      {
        name: 'port',
        type: 'object',
        value: {local: 8080, flag: true, empty: null},
      },
    ]);
    expect(boardsToVariables(boards)).toEqual({
      port: {local: 8080, flag: true, empty: null},
    });
  });

  it('ignores nested object and list field values', () => {
    expect(boardsToVariables([
      {
        name: 'config',
        type: 'object',
        value: {
          local: {host: 'localhost', port: 8080},
          tags: ['a', 'b'],
          raw: '{"x":1}',
          listLit: '[1,2]',
          url: 'https://x',
          port: '8080',
        },
      },
    ])).toEqual({
      config: {
        url: 'https://x',
        port: 8080,
      },
    });
    expect(coerceEnvScalar({a: 1} as any)).toBeUndefined();
    expect(coerceEnvScalar([1, 2] as any)).toBeUndefined();
    expect(coerceEnvScalar('{"a":1}')).toBeUndefined();
    expect(coerceEnvScalar('[1,2]')).toBeUndefined();
  });

  it('keeps number 10 and string "10" as different list values', () => {
    expect(envListValueToInputBox(10)).toBe('10');
    expect(envListValueToInputBox('10')).toBe('"10"');
    expect(envScalarChoices([10, '10', true, null])).toEqual([
      {label: '10', value: 10},
      {label: '"10"', value: '10'},
      {label: 'true', value: true},
      {label: 'null', value: null},
    ]);
    expect(envVariableChoices(10)).toEqual([{label: '10', value: 10}]);
    expect(envVariableChoices('10')).toEqual([{label: '"10"', value: '10'}]);
    expect(envVariableChoices({local: 10, quoted: '10'})).toEqual([
      {label: 'local', value: 10},
      {label: 'quoted', value: '10'},
    ]);
    const choices = envVariableChoices([10, '10']);
    expect(pickEnvChoice(choices, {label: '10', value: '10'})).toEqual({
      label: '10',
      value: 10,
    });
    expect(pickEnvChoice(choices, {label: '"10"', value: '10'})).toEqual({
      label: '"10"',
      value: '10',
    });
    expect(boardsToVariables([
      {name: 'n', type: 'list', value: ['10', '"10"', 'true', 'null']},
    ])).toEqual({
      n: [10, '10', true, null],
    });
  });

  it('coerces list display text to scalars and drops object/list items', () => {
    expect(boardsToVariables([
      {
        name: 'ports',
        type: 'list',
        value: ['8080', '"8080"', 'true', 'hello', '[1,2]', '{"a":1}'],
      },
    ])).toEqual({
      ports: [8080, '8080', true, 'hello'],
    });
  });

  it('keeps named empty object/list shells and drops unnamed drafts', () => {
    expect(boardsToVariables([
      {name: '', type: 'object', value: {a: '1'}},
      {name: 'draft', type: 'object', value: {}},
      {name: 'tags', type: 'list', value: []},
      {name: 'api_url', type: 'object', value: {local: 'https://x'}},
    ])).toEqual({
      draft: {},
      tags: [],
      api_url: {local: 'https://x'},
    });
  });

  it('strips nested values when loading boards from YAML', () => {
    const boards = variablesToBoards({
      api_url: {local: 'https://x', prod: 'https://y'},
      timeouts: [1000, 2000],
      nested: {dev: {port: 8080} as any, plain: 'ok'},
    } as any);
    expect(boardsToVariables(boards)).toEqual({
      api_url: {local: 'https://x', prod: 'https://y'},
      timeouts: [1000, 2000],
      nested: {plain: 'ok'},
    });
  });

  it('keeps signature stable for equal maps', () => {
    const a = {port: {local: 8080}};
    const b = {port: {local: 8080}};
    expect(envVariablesSignature(a)).toBe(envVariablesSignature(b));
    expect(envVariablesSignature(a)).not.toBe(
        envVariablesSignature({port: {local: '8080'}}),
    );
  });
});
