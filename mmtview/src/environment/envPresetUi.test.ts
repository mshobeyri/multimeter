import {boardsToPresets, presetsToBoards} from './envPresetUi';

describe('envPresetUi', () => {
  it('preserves typed preset scalars', () => {
    const boards = presetsToBoards({
      runner: {
        dev: {port: 8080, secure: true, token: null},
      },
    });
    expect(boardsToPresets(boards)).toEqual({
      runner: {
        dev: {port: 8080, secure: true, token: null},
      },
    });
  });

  it('coerces string display values and drops empty env maps', () => {
    expect(boardsToPresets([
      {
        name: 'runner',
        values: [
          {env: 'dev', kv: {port: '8080', name: 'local'}},
          {env: 'empty', kv: {}},
          {env: '', kv: {x: 1}},
        ],
      },
      {name: '', values: [{env: 'dev', kv: {a: 1}}]},
    ])).toEqual({
      runner: {
        dev: {port: 8080, name: 'local'},
      },
    });
  });

  it('ignores object and list preset values', () => {
    expect(boardsToPresets([
      {
        name: 'runner',
        values: [
          {
            env: 'dev',
            kv: {
              port: '8080',
              nested: {a: 1} as any,
              list: [1, 2] as any,
              json: '{"x":1}',
            },
          },
        ],
      },
    ])).toEqual({
      runner: {
        dev: {port: 8080},
      },
    });
  });
});
