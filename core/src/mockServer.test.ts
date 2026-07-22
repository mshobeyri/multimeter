import {matchPath, autoDetectFormat, partialMatch, findEndpoint, buildResponse, buildFallbackResponse, createMockRouter, MockRequest, replaceRequestRefs, buildRequestContext, parseRequestBody, inferRequestBodyFormat, extractPathParamNames} from './mockServer';
import {MockEndpoint, MockData} from './MockData';
import {resolveEmbeddedTokens} from './variableReplacer';

describe('matchPath', () => {
  it('matches exact paths', () => {
    expect(matchPath('/users', '/users')).toEqual({});
  });

  it('returns null for non-matching paths', () => {
    expect(matchPath('/users', '/posts')).toBeNull();
  });

  it('returns null for different segment counts', () => {
    expect(matchPath('/users/:id', '/users')).toBeNull();
  });

  it('extracts path params', () => {
    expect(matchPath('/users/:id', '/users/42')).toEqual({id: '42'});
  });

  it('extracts multiple path params', () => {
    expect(matchPath('/users/:userId/posts/:postId', '/users/5/posts/99'))
        .toEqual({userId: '5', postId: '99'});
  });

  it('decodes percent-encoded segments', () => {
    expect(matchPath('/search/:q', '/search/hello%20world')).toEqual({q: 'hello world'});
  });

  it('strips query string from actual path', () => {
    expect(matchPath('/users', '/users?page=1')).toEqual({});
  });
});

describe('autoDetectFormat', () => {
  it('detects json for objects', () => {
    expect(autoDetectFormat({key: 'value'})).toBe('json');
  });

  it('detects json for arrays', () => {
    expect(autoDetectFormat([1, 2])).toBe('json');
  });

  it('detects xml for strings starting with <', () => {
    expect(autoDetectFormat('<root/>')).toBe('xml');
  });

  it('detects text for plain strings', () => {
    expect(autoDetectFormat('hello')).toBe('text');
  });

  it('detects text for null', () => {
    expect(autoDetectFormat(null)).toBe('text');
  });
});

describe('partialMatch', () => {
  it('matches when all expected keys exist in actual', () => {
    expect(partialMatch({a: '1'}, {a: '1', b: '2'})).toBe(true);
  });

  it('fails when a key is missing', () => {
    expect(partialMatch({a: '1', c: '3'}, {a: '1', b: '2'})).toBe(false);
  });

  it('matches nested objects', () => {
    expect(partialMatch({user: {name: 'Ali'}}, {user: {name: 'Ali', age: 30}})).toBe(true);
  });

  it('fails on nested mismatch', () => {
    expect(partialMatch({user: {name: 'Ali'}}, {user: {name: 'Bob'}})).toBe(false);
  });

  it('coerces values to string for comparison', () => {
    expect(partialMatch({count: 5 as any}, {count: '5'})).toBe(true);
  });
});

describe('findEndpoint', () => {
  const endpoints: MockEndpoint[] = [
    {method: 'get', path: '/users', status: 200, body: []},
    {method: 'post', path: '/login', name: 'admin-login', match: {body: {username: 'admin'}}, status: 200, body: {role: 'admin'}},
    {method: 'post', path: '/login', status: 200, body: {role: 'user'}},
    {method: 'get', path: '/users/:id', status: 200, body: {id: '${url.id}'}},
    {method: 'post', path: '/echo', reflect: true, status: 200},
  ];

  function req(method: string, path: string, extra?: Partial<MockRequest>): MockRequest {
    return {method, path, headers: {}, query: {}, body: null, ...extra};
  }

  it('matches by method and path', () => {
    const result = findEndpoint(endpoints, req('get', '/users'));
    expect(result).not.toBeNull();
    expect(result!.endpoint.body).toEqual([]);
  });

  it('returns null for no match', () => {
    expect(findEndpoint(endpoints, req('get', '/nowhere'))).toBeNull();
  });

  it('returns null for wrong method', () => {
    expect(findEndpoint(endpoints, req('delete', '/users'))).toBeNull();
  });

  it('first match wins (conditional match)', () => {
    const result = findEndpoint(endpoints, req('post', '/login', {body: {username: 'admin'}}));
    expect(result!.endpoint.name).toBe('admin-login');
    expect(result!.endpoint.body).toEqual({role: 'admin'});
  });

  it('falls through to second match when condition fails', () => {
    const result = findEndpoint(endpoints, req('post', '/login', {body: {username: 'bob'}}));
    expect(result!.endpoint.body).toEqual({role: 'user'});
  });

  it('extracts path params', () => {
    const result = findEndpoint(endpoints, req('get', '/users/42'));
    expect(result!.pathParams).toEqual({id: '42'});
  });

  it('matches named endpoint via x-mock-example', () => {
    const result = findEndpoint(endpoints, req('post', '/login', {
      headers: {'x-mock-example': 'admin-login'},
      body: {}  // no body match needed when using name
    }));
    expect(result!.endpoint.name).toBe('admin-login');
  });

  it('matches header condition', () => {
    const eps: MockEndpoint[] = [
      {method: 'get', path: '/api', match: {headers: {'x-api-key': 'secret'}}, status: 200, body: 'ok'},
      {method: 'get', path: '/api', status: 401, body: 'unauthorized'},
    ];
    const result = findEndpoint(eps, req('get', '/api', {headers: {'x-api-key': 'secret'}}));
    expect(result!.endpoint.status).toBe(200);

    const result2 = findEndpoint(eps, req('get', '/api', {headers: {'x-api-key': 'wrong'}}));
    expect(result2!.endpoint.status).toBe(401);
  });

  it('matches query condition', () => {
    const eps: MockEndpoint[] = [
      {method: 'get', path: '/search', match: {query: {type: 'premium'}}, status: 200, body: 'premium'},
      {method: 'get', path: '/search', status: 200, body: 'all'},
    ];
    const result = findEndpoint(eps, req('get', '/search', {query: {type: 'premium'}}));
    expect(result!.endpoint.body).toBe('premium');

    const result2 = findEndpoint(eps, req('get', '/search', {query: {type: 'free'}}));
    expect(result2!.endpoint.body).toBe('all');
  });
});

describe('buildResponse', () => {
  it('builds a json response', () => {
    const ep: MockEndpoint = {method: 'get', path: '/test', status: 200, format: 'json', body: {msg: 'hi'}};
    const resp = buildResponse(ep, {}, {method: 'get', path: '/test', headers: {}, query: {}, body: null}, undefined, 0);
    expect(resp.status).toBe(200);
    expect(resp.headers['content-type']).toBe('application/json');
    expect(JSON.parse(resp.body)).toEqual({msg: 'hi'});
  });

  it('builds a text response', () => {
    const ep: MockEndpoint = {method: 'get', path: '/test', status: 200, format: 'text', body: 'OK'};
    const resp = buildResponse(ep, {}, {method: 'get', path: '/test', headers: {}, query: {}, body: null}, undefined, 0);
    expect(resp.body).toBe('OK');
    expect(resp.headers['content-type']).toBe('text/plain');
  });

  it('replaces path params in body', () => {
    const ep: MockEndpoint = {method: 'get', path: '/users/:id', status: 200, format: 'json', body: {id: '${url.id}'}};
    const resp = buildResponse(ep, {id: '42'}, {method: 'get', path: '/users/42', headers: {}, query: {}, body: null}, undefined, 0);
    expect(JSON.parse(resp.body)).toEqual({id: '42'});
  });

  it('substitutes request body fields', () => {
    const ep: MockEndpoint = {method: 'post', path: '/users', status: 201, format: 'json', body: {name: '${body.name}', email: '${body.email}'}};
    const req: MockRequest = {method: 'post', path: '/users', headers: {}, query: {}, body: {name: 'Alice', email: 'a@b.com'}};
    const resp = buildResponse(ep, {}, req, undefined, 0);
    expect(JSON.parse(resp.body)).toEqual({name: 'Alice', email: 'a@b.com'});
  });

  it('substitutes request headers', () => {
    const ep: MockEndpoint = {method: 'get', path: '/api', status: 200, format: 'json', body: {key: '${header.x-api-key}'}};
    const req: MockRequest = {method: 'get', path: '/api', headers: {'x-api-key': 'secret'}, query: {}, body: null};
    const resp = buildResponse(ep, {}, req, undefined, 0);
    expect(JSON.parse(resp.body)).toEqual({key: 'secret'});
  });

  it('substitutes query parameters', () => {
    const ep: MockEndpoint = {method: 'get', path: '/search', status: 200, format: 'json', body: {q: '${query.q}'}};
    const req: MockRequest = {method: 'get', path: '/search', headers: {}, query: {q: 'hello'}, body: null};
    const resp = buildResponse(ep, {}, req, undefined, 0);
    expect(JSON.parse(resp.body)).toEqual({q: 'hello'});
  });

  it('uses endpoint delay if set, otherwise global', () => {
    const ep1: MockEndpoint = {method: 'get', path: '/a', status: 200, delay: 500};
    const resp1 = buildResponse(ep1, {}, {method: 'get', path: '/a', headers: {}, query: {}, body: null}, undefined, 100);
    expect(resp1.delay).toBe(500);

    const ep2: MockEndpoint = {method: 'get', path: '/b', status: 200};
    const resp2 = buildResponse(ep2, {}, {method: 'get', path: '/b', headers: {}, query: {}, body: null}, undefined, 100);
    expect(resp2.delay).toBe(100);
  });

  it('reflect mode echoes request', () => {
    const ep: MockEndpoint = {method: 'post', path: '/echo', reflect: true, status: 200};
    const req: MockRequest = {method: 'post', path: '/echo', headers: {a: '1'}, query: {}, body: {hello: 'world'}};
    const resp = buildResponse(ep, {}, req, undefined, 0);
    const parsed = JSON.parse(resp.body);
    expect(parsed.method).toBe('post');
    expect(parsed.body).toEqual({hello: 'world'});
  });

  it('merges global and endpoint headers', () => {
    const ep: MockEndpoint = {method: 'get', path: '/test', status: 200, format: 'text', body: 'ok', headers: {'X-Custom': 'val'}};
    const resp = buildResponse(ep, {}, {method: 'get', path: '/test', headers: {}, query: {}, body: null}, {'X-Global': 'g'}, 0);
    expect(resp.headers['X-Global']).toBe('g');
    expect(resp.headers['X-Custom']).toBe('val');
  });

  it('calls tokenResolver on body', () => {
    const ep: MockEndpoint = {method: 'get', path: '/test', status: 200, format: 'json', body: {token: 'r:uuid'}};
    const resolver = (v: any) => {
      if (typeof v === 'object' && v !== null) {
        const out: Record<string, any> = {};
        for (const [k, val] of Object.entries(v)) {
          out[k] = val === 'r:uuid' ? 'resolved-uuid' : val;
        }
        return out;
      }
      return v;
    };
    const resp = buildResponse(ep, {}, {method: 'get', path: '/test', headers: {}, query: {}, body: null}, undefined, 0, resolver);
    expect(JSON.parse(resp.body)).toEqual({token: 'resolved-uuid'});
  });

  it('resolves e: env tokens in body and headers via tokenResolver', () => {
    const env = {ADMIN_EMAIL: 'admin@example.com', API_KEY: 'secret-key'};
    const resolver = (v: any) => resolveEmbeddedTokens(v, env);
    const ep: MockEndpoint = {
      method: 'get',
      path: '/me',
      status: 200,
      format: 'json',
      headers: {'X-Api-Key': 'e:API_KEY'},
      body: {email: 'e:ADMIN_EMAIL', host: 'https://<<e:API_KEY>>.local'},
    };
    const resp = buildResponse(
        ep, {}, {method: 'get', path: '/me', headers: {}, query: {}, body: null},
        undefined, 0, resolver);
    expect(JSON.parse(resp.body)).toEqual({
      email: 'admin@example.com',
      host: 'https://secret-key.local',
    });
    expect(resp.headers['X-Api-Key']).toBe('secret-key');
  });
});

describe('findEndpoint with env tokens', () => {
  it('resolves e: tokens in match rules', () => {
    const env = {API_KEY: 'secret'};
    const resolver = (v: any) => resolveEmbeddedTokens(v, env);
    const endpoints: MockEndpoint[] = [
      {
        method: 'get',
        path: '/secure',
        match: {headers: {'x-api-key': 'e:API_KEY'}},
        status: 200,
        body: 'ok',
      },
    ];
    const hit = findEndpoint(
        endpoints,
        {method: 'get', path: '/secure', headers: {'x-api-key': 'secret'}, query: {}, body: null},
        resolver);
    expect(hit).not.toBeNull();

    const miss = findEndpoint(
        endpoints,
        {method: 'get', path: '/secure', headers: {'x-api-key': 'wrong'}, query: {}, body: null},
        resolver);
    expect(miss).toBeNull();
  });

  it('resolves e: tokens in path patterns', () => {
    const env = {BASE_PATH: '/api/v1'};
    const resolver = (v: any) => resolveEmbeddedTokens(v, env);
    const endpoints: MockEndpoint[] = [
      {method: 'get', path: '<<e:BASE_PATH>>/health', status: 200, body: 'ok'},
    ];
    const hit = findEndpoint(
        endpoints,
        {method: 'get', path: '/api/v1/health', headers: {}, query: {}, body: null},
        resolver);
    expect(hit).not.toBeNull();
  });
});

describe('buildFallbackResponse', () => {
  it('returns 404 with default body when no fallback', () => {
    const resp = buildFallbackResponse(undefined, {method: 'get', path: '/x', headers: {}, query: {}, body: null}, undefined, 0);
    expect(resp.status).toBe(404);
  });

  it('uses fallback body and status', () => {
    const resp = buildFallbackResponse(
        {status: 503, format: 'json', body: {error: 'Maintenance'}},
        {method: 'get', path: '/x', headers: {}, query: {}, body: null},
        undefined, 0);
    expect(resp.status).toBe(503);
    expect(JSON.parse(resp.body)).toEqual({error: 'Maintenance'});
  });

  it('replaces ${url.path} in fallback body', () => {
    const resp = buildFallbackResponse(
        {status: 404, format: 'json', body: {error: 'Not found', path: '${url.path}'}},
        {method: 'get', path: '/missing/route', headers: {}, query: {}, body: null},
        undefined, 0);
    expect(JSON.parse(resp.body).path).toBe('/missing/route');
  });
});

describe('parseRequestBody', () => {
  it('parses JSON bodies', () => {
    expect(parseRequestBody('{"name":"Alice"}', {'content-type': 'application/json'}))
        .toEqual({name: 'Alice'});
  });

  it('parses XML bodies', () => {
    const parsed = parseRequestBody('<user><name>Alice</name></user>', {'content-type': 'application/xml'});
    expect(parsed).toEqual({user: {name: 'Alice'}});
  });

  it('infers JSON without content-type', () => {
    expect(parseRequestBody('{"x":1}', {})).toEqual({x: 1});
  });
});

describe('replaceRequestRefs', () => {
  it('supports inline substitution in strings', () => {
    const ctx = buildRequestContext(
        {method: 'get', path: '/users/5', headers: {}, query: {}, body: null},
        {id: '5'});
    expect(replaceRequestRefs('user-${url.id}', ctx)).toBe('user-5');
  });
});

describe('extractPathParamNames', () => {
  it('collects unique param names from paths', () => {
    expect(extractPathParamNames(['/users/:id', '/files/:folder/:name']))
        .toEqual(expect.arrayContaining(['id', 'folder', 'name']));
  });
});

describe('createMockRouter', () => {
  const data: MockData = {
    type: 'server',
    port: 8081,
    cors: false,
    delay: 0,
    endpoints: [
      {method: 'get', path: '/users', status: 200, format: 'json', body: [{id: 1}]},
      {method: 'get', path: '/health', status: 200, format: 'text', body: 'OK'},
    ],
    fallback: {status: 404, format: 'json', body: {error: 'Not found'}}
  };

  it('routes to matching endpoint', () => {
    const router = createMockRouter(data);
    const resp = router({method: 'get', path: '/users', headers: {}, query: {}, body: null});
    expect(resp.status).toBe(200);
    expect(JSON.parse(resp.body)).toEqual([{id: 1}]);
  });

  it('routes to fallback for unmatched', () => {
    const router = createMockRouter(data);
    const resp = router({method: 'get', path: '/unknown', headers: {}, query: {}, body: null});
    expect(resp.status).toBe(404);
  });
});
