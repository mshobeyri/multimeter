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
  it('upserts by name and keeps other existing vars', () => {
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

  it('no-ops when names are empty', () => {
    const existing = [env('a', 1)];
    expect(removeEnvVariablesByNames(existing, [])).toEqual(existing);
  });
});
