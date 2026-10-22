import {
  mergeEnvVariableLists,
  removeEnvVariablesByNames,
} from './environmentUtils';
import type {EnvVariable} from './EnvironmentData';

function env(
    name: string,
    value: string|number,
    source: EnvVariable['source'] = 'file',
): EnvVariable {
  return {name, label: name, value, options: [], source};
}

describe('mergeEnvVariableLists', () => {
  it('upserts environment-layer by name and keeps other existing vars', () => {
    const existing = [
      env('api_url', 'http://old', 'file'),
      env('token', 'abc', 'manual'),
      env('session', 'xyz', 'runtime'),
    ];
    const incoming = [
      env('api_url', 'http://new', 'file'),
      env('mode', 'dev', 'file'),
    ];
    expect(mergeEnvVariableLists(existing, incoming)).toEqual([
      env('api_url', 'http://new', 'file'),
      env('mode', 'dev', 'file'),
      env('token', 'abc', 'manual'),
      env('session', 'xyz', 'runtime'),
    ]);
  });

  it('keeps runtime when incoming redefines the same name', () => {
    expect(mergeEnvVariableLists(
        [env('token', 'file', 'file'), env('token', 'rt', 'runtime')],
        [env('token', 'new', 'file')],
        )).toEqual([
      env('token', 'new', 'file'),
      env('token', 'rt', 'runtime'),
    ]);
  });

  it('handles empty sides', () => {
    expect(mergeEnvVariableLists([], [env('a', 1)])).toEqual([env('a', 1)]);
    expect(mergeEnvVariableLists([env('a', 1)], [])).toEqual([env('a', 1)]);
    expect(mergeEnvVariableLists(null, undefined)).toEqual([]);
  });
});

describe('removeEnvVariablesByNames', () => {
  it('removes only the named keys', () => {
    const existing = [
      env('api_url', 'http://x', 'file'),
      env('mode', 'dev', 'file'),
      env('token', 'abc', 'manual'),
    ];
    expect(removeEnvVariablesByNames(existing, ['api_url', 'mode'])).toEqual([
      env('token', 'abc', 'manual'),
    ]);
  });

  it('keeps runtime rows for cleared environment names', () => {
    expect(removeEnvVariablesByNames(
        [env('token', 'file', 'file'), env('token', 'rt', 'runtime')],
        ['token'],
        )).toEqual([env('token', 'rt', 'runtime')]);
  });

  it('no-ops when names are empty', () => {
    const existing = [env('a', 1)];
    expect(removeEnvVariablesByNames(existing, [])).toEqual(existing);
  });
});
