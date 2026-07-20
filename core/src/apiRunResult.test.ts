import {buildApiTesterResponse, parseSetCookieHeader} from './apiRunResult';

describe('parseSetCookieHeader', () => {
  it('parses a single Set-Cookie string', () => {
    expect(parseSetCookieHeader('session=abc; Path=/')).toEqual({session: 'abc'});
  });

  it('parses an array of Set-Cookie values', () => {
    expect(parseSetCookieHeader(['a=1', 'b=2; Secure'])).toEqual({a: '1', b: '2'});
  });

  it('returns empty object for missing input', () => {
    expect(parseSetCookieHeader(undefined)).toEqual({});
  });
});

describe('buildApiTesterResponse', () => {
  it('returns null for missing outputs', () => {
    expect(buildApiTesterResponse(undefined)).toBeNull();
    expect(buildApiTesterResponse(null)).toBeNull();
    expect(buildApiTesterResponse({})).toBeNull();
  });

  it('prefers the HTTP response embedded in _.details', () => {
    const response = buildApiTesterResponse({
      _: {
        status: 200,
        duration: 99.7,
        cookies: {fromMeta: 'x'},
        details: JSON.stringify({
          request: {url: 'https://example.com'},
          response: {
            status: 201,
            statusText: 'Created',
            body: '{"ok":true}',
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'token=xyz; Path=/',
            },
            duration: 42.4,
          },
        }),
      },
    });

    expect(response).toEqual({
      body: '{"ok":true}',
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'token=xyz; Path=/',
      },
      cookies: {token: 'xyz'},
      errorMessage: 'Created',
      status: 201,
      errorCode: '',
      duration: 42,
      warning: undefined,
    });
  });

  it('falls back to meta fields when details is missing', () => {
    const response = buildApiTesterResponse({
      _: {
        body: 'hi',
        headers: {a: 'b'},
        cookies: {c: 'd'},
        status: 200,
        duration: 12,
      },
    });

    expect(response).toEqual({
      body: 'hi',
      headers: {a: 'b'},
      cookies: {c: 'd'},
      errorMessage: '',
      status: 200,
      errorCode: '',
      duration: 12,
    });
  });

  it('uses meta cookies when Set-Cookie is absent', () => {
    const response = buildApiTesterResponse({
      _: {
        cookies: {session: '1'},
        details: JSON.stringify({
          response: {
            status: 200,
            body: '',
            headers: {'content-type': 'text/plain'},
            duration: 5,
          },
        }),
      },
    });

    expect(response?.cookies).toEqual({session: '1'});
    expect(response?.duration).toBe(5);
  });
});
