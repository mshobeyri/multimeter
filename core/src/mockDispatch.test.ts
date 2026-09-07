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

  test('resolveMockResponseHeaders resolves tokens', () => {
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
