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

  it('coerces list display text to typed YAML scalars', () => {
    expect(boardsToVariables([
      {name: 'ports', type: 'list', value: ['8080', '"8080"', 'true', 'hello']},
    ])).toEqual({
      ports: [8080, '8080', true, 'hello'],
    });
  });

  it('drops unnamed boards and empty objects / lists', () => {
    expect(boardsToVariables([
      {name: '', type: 'object', value: {a: '1'}},
      {name: 'draft', type: 'object', value: {}},
      {name: 'tags', type: 'list', value: []},
      {name: 'api_url', type: 'object', value: {local: 'https://x'}},
    ])).toEqual({
      api_url: {local: 'https://x'},
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
