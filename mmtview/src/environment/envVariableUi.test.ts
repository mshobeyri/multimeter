import {
  boardsToVariables,
  envVariablesSignature,
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

  it('preserves nested object and list field values', () => {
    expect(boardsToVariables([
      {
        name: 'config',
        type: 'object',
        value: {
          local: {host: 'localhost', port: 8080},
          tags: ['a', 'b'],
          raw: '{"x":1}',
          listLit: '[1,2]',
        },
      },
    ])).toEqual({
      config: {
        local: {host: 'localhost', port: 8080},
        tags: ['a', 'b'],
        raw: {x: 1},
        listLit: [1, 2],
      },
    });
  });

  it('coerces list display text to typed YAML scalars and structures', () => {
    expect(boardsToVariables([
      {
        name: 'ports',
        type: 'list',
        value: ['8080', '"8080"', 'true', 'hello', '[1,2]', '{"a":1}'],
      },
    ])).toEqual({
      ports: [8080, '8080', true, 'hello', [1, 2], {a: 1}],
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

  it('round-trips object and list variable shapes', () => {
    const vars = {
      api_url: {local: 'https://x', prod: 'https://y'},
      timeouts: [1000, 2000],
      nested: {dev: {port: 8080, headers: {a: 'b'}}},
    } as unknown as Record<string, import('mmt-core/EnvData').EnvVariableValue>;
    expect(boardsToVariables(variablesToBoards(vars))).toEqual(vars);
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
