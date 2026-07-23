import {coerceYamlString, normalizeIncompleteYamlScalar} from './yamlIncompleteScalar';

describe('yamlIncompleteScalar', () => {
  it('recovers scheme-only nested maps from mid-typing', () => {
    expect(normalizeIncompleteYamlScalar({http: null})).toBe('http:');
    expect(normalizeIncompleteYamlScalar({https: undefined})).toBe('https:');
    expect(normalizeIncompleteYamlScalar({ws: null})).toBe('ws:');
    // Following keys can be swallowed into the same map while typing.
    expect(normalizeIncompleteYamlScalar({http: null, method: 'get'})).toBe('http:');
  });

  it('passes through normal scalars', () => {
    expect(normalizeIncompleteYamlScalar('https://example.com')).toBe('https://example.com');
    expect(normalizeIncompleteYamlScalar(42)).toBe('42');
    expect(normalizeIncompleteYamlScalar(true)).toBe('true');
  });

  it('returns undefined for real objects and coerce falls back', () => {
    expect(normalizeIncompleteYamlScalar({a: 1, b: 2})).toBeUndefined();
    expect(coerceYamlString({a: 1}, '')).toBe('');
    expect(coerceYamlString({http: null})).toBe('http:');
  });
});
