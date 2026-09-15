import {createMockRouter} from './mockServer';
import {
  dispatchMockHttpRequest,
  parseMockUrl,
  resolveMockResponseHeaders,
  serializeMockResponseBody,
} from './mockDispatch';
import {MockData} from './MockData';

describe('mockDispatch', () => {
  test('parseMockUrl extracts path and query', () => {
    expect(parseMockUrl('/api/x?a=1&b=two')).toEqual({
      pathname: '/api/x',
      query: {a: '1', b: 'two'},
    });
    expect(parseMockUrl('/plain')).toEqual({pathname: '/plain', query: {}});
  });

  test('serializeMockResponseBody', () => {
    expect(serializeMockResponseBody(undefined)).toBe('');
    expect(serializeMockResponseBody('raw')).toBe('raw');
    expect(serializeMockResponseBody({ok: true})).toBe('{"ok":true}');
  });

  test('parseMockUrl treats empty input as root', () => {
    expect(parseMockUrl('')).toEqual({pathname: '/', query: {}});
  });

  test('resolveMockResponseHeaders resolves tokens', () => {
    expect(resolveMockResponseHeaders(undefined)).toEqual({});
    expect(resolveMockResponseHeaders({n: 1 as any})).toEqual({n: '1'});
    expect(resolveMockResponseHeaders(
        {a: 'hello', b: 'x'},
        (v) => v === 'hello' ? 'world' : v,
        )).toEqual({a: 'world', b: 'x'});
  });

  test('dispatchMockHttpRequest routes JSON body and query', () => {
    const data: MockData = {
      type: 'server',
      port: 0,
      endpoints: [{
        path: '/echo',
        method: 'post',
        match: {query: {token: 'abc'}, body: {name: 'Ada'}},
        status: 201,
        body: {ok: true},
        headers: {'x-echo': 'e:ENV'},
      }],
    };
    const router = createMockRouter(data);
    const result = dispatchMockHttpRequest(router, {
      method: 'POST',
      url: '/echo?token=abc',
      headers: {'content-type': 'application/json'},
      rawBody: JSON.stringify({name: 'Ada'}),
      resolveHeaderToken: (v) => v === 'e:ENV' ? 'prod' : v,
    });
    expect(result.status).toBe(201);
    expect(JSON.parse(result.body)).toEqual({ok: true});
    expect(result.headers['x-echo']).toBe('prod');
    expect(result.query).toEqual({token: 'abc'});
    expect(result.delay).toBe(0);
  });

  test('dispatchMockHttpRequest keeps positive delay and empty method', () => {
    const result = dispatchMockHttpRequest(
        () => ({status: 200, body: 'ok', delay: 25, headers: {x: 'y'}}),
        {method: '', url: '/z', headers: {}, rawBody: ''},
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe('ok');
    expect(result.delay).toBe(25);
    expect(result.pathname).toBe('/z');
  });

  test('dispatchMockHttpRequest propagates router errors', () => {
    expect(() => dispatchMockHttpRequest(
        () => {
          throw new Error('boom');
        },
        {method: 'GET', url: '/', headers: {}, rawBody: ''},
        )).toThrow('boom');
  });
});
