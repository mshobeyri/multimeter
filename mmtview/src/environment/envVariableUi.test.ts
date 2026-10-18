import {
  boardsToVariables,
  coerceEnvChoiceValue,
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

  it('preserves nested object choice values and JSON object literals', () => {
    expect(boardsToVariables([
      {
        name: 'city',
        type: 'object',
        value: {
          berlin: {latitude: 52.52, longitude: 13.41},
          tokyo: '{"latitude":35.68,"longitude":139.69}',
          url: 'https://x',
          port: '8080',
        },
      },
    ])).toEqual({
      city: {
        berlin: {latitude: 52.52, longitude: 13.41},
        tokyo: {latitude: 35.68, longitude: 139.69},
        url: 'https://x',
        port: 8080,
      },
    });
    expect(coerceEnvChoiceValue({a: 1} as any)).toEqual({a: 1});
    expect(coerceEnvChoiceValue([1, 2] as any)).toEqual([1, 2]);
    expect(coerceEnvChoiceValue('{"a":1}')).toEqual({a: 1});
    expect(coerceEnvChoiceValue('[1,2]')).toEqual([1, 2]);
    // Lists still reject nested values.
    expect(coerceEnvScalar({a: 1} as any)).toBeUndefined();
    expect(coerceEnvScalar([1, 2] as any)).toBeUndefined();
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
    expect(envVariableChoices('https://test.mmt.dev', 'base_url')).toEqual([
      {label: 'base_url', value: 'https://test.mmt.dev'},
    ]);
    expect(envVariableChoices({local: 10, quoted: '10'})).toEqual([
      {label: 'local', value: 10},
      {label: 'quoted', value: '10'},
    ]);
    expect(envVariableChoices({local: 10, quoted: '10'}, 'base_url')).toEqual([
      {label: 'local', value: 10},
      {label: 'quoted', value: '10'},
    ]);
    const nested = envVariableChoices({
      berlin: {latitude: 52.52, longitude: 13.41},
    });
    expect(nested).toEqual([
      {label: 'berlin', value: {latitude: 52.52, longitude: 13.41}},
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

  it('keeps nested values when loading boards from YAML', () => {
    const boards = variablesToBoards({
      api_url: {local: 'https://x', prod: 'https://y'},
      timeouts: [1000, 2000],
      city: {berlin: {latitude: 52.52, longitude: 13.41}, plain: 'ok'},
    });
    expect(boardsToVariables(boards)).toEqual({
      api_url: {local: 'https://x', prod: 'https://y'},
      timeouts: [1000, 2000],
      city: {berlin: {latitude: 52.52, longitude: 13.41}, plain: 'ok'},
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
