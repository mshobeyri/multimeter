import {hasApiRequestBody, resolveApiHttpMethod} from './apiMethod';

describe('hasApiRequestBody', () => {
  test('returns false for absent or empty values', () => {
    expect(hasApiRequestBody(undefined)).toBe(false);
    expect(hasApiRequestBody(null)).toBe(false);
    expect(hasApiRequestBody('')).toBe(false);
    expect(hasApiRequestBody('   ')).toBe(false);
    expect(hasApiRequestBody([])).toBe(false);
  });

  test('returns true for non-empty string or object body', () => {
    expect(hasApiRequestBody('hello')).toBe(true);
    expect(hasApiRequestBody('<<i:body>>')).toBe(true);
    expect(hasApiRequestBody({})).toBe(true);
    expect(hasApiRequestBody({a: 1})).toBe(true);
    expect(hasApiRequestBody([1])).toBe(true);
  });
});

describe('resolveApiHttpMethod', () => {
  test('uses explicit method when set', () => {
    expect(resolveApiHttpMethod('put', {a: 1})).toBe('put');
    expect(resolveApiHttpMethod('GET', 'payload')).toBe('get');
    expect(resolveApiHttpMethod('  PATCH  ', undefined)).toBe('patch');
  });

  test('defaults to post when body is present', () => {
    expect(resolveApiHttpMethod(undefined, {a: 1})).toBe('post');
    expect(resolveApiHttpMethod('', '{"x":1}')).toBe('post');
    expect(resolveApiHttpMethod(null, {})).toBe('post');
  });

  test('defaults to get when body is absent or empty', () => {
    expect(resolveApiHttpMethod(undefined, undefined)).toBe('get');
    expect(resolveApiHttpMethod('', '')).toBe('get');
    expect(resolveApiHttpMethod(undefined, null)).toBe('get');
  });
});
