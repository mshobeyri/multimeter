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

  it('uses expect equality (no string coercion)', () => {
    expect(partialMatch({count: 5 as any}, {count: '5'})).toBe(false);
    expect(partialMatch({count: 5 as any}, {count: 5})).toBe(true);
    expect(partialMatch({count: '=~ 5'}, {count: 5})).toBe(true);
  });

  it('supports dotted paths and operators', () => {
    expect(partialMatch({'user.name': 'Ali'}, {user: {name: 'Ali', age: 1}})).toBe(true);
    expect(partialMatch({'user.name': '!= Bob'}, {user: {name: 'Ali'}})).toBe(true);
    expect(partialMatch({'user.name': '=C Al'}, {user: {name: 'Ali'}})).toBe(true);
    expect(partialMatch({'user.name': '=C xx'}, {user: {name: 'Ali'}})).toBe(false);
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

  it('prefers conditional match over later catch-all', () => {
    const result = findEndpoint(endpoints, req('post', '/login', {body: {username: 'admin'}}));
    expect(result!.endpoint.name).toBe('admin-login');
    expect(result!.endpoint.body).toEqual({role: 'admin'});
  });

  it('falls through to catch-all when condition fails', () => {
    const result = findEndpoint(endpoints, req('post', '/login', {body: {username: 'bob'}}));
    expect(result!.endpoint.body).toEqual({role: 'user'});
  });

  it('prefers filtered match even when catch-all is listed first', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/health', status: 200, body: {message: 'mock 1'}},
      {
        method: 'post',
        path: '/health',
        match: {headers: {xxx: '1'}, body: {ddd: 'salam'}},
        status: 200,
        body: {message: 'mock 2'},
      },
    ];
    const hit = findEndpoint(eps, req('post', '/health', {
      headers: {xxx: '1'},
      body: {ddd: 'salam'},
    }));
    expect(hit!.endpoint.body).toEqual({message: 'mock 2'});

    const miss = findEndpoint(eps, req('post', '/health', {
      headers: {xxx: '1'},
      body: {ddd: 'other'},
    }));
    expect(miss!.endpoint.body).toEqual({message: 'mock 1'});
  });

  it('among multiple successful filters, first in file wins', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', match: {body: {a: '1'}}, status: 200, body: 'first'},
      {method: 'post', path: '/x', match: {body: {a: '1', b: '2'}}, status: 200, body: 'second'},
    ];
    const result = findEndpoint(eps, req('post', '/x', {body: {a: '1', b: '2'}}));
    expect(result!.endpoint.body).toBe('first');
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

describe('findEndpoint match priority', () => {
  function req(method: string, path: string, extra?: Partial<MockRequest>): MockRequest {
    return {method, path, headers: {}, query: {}, body: null, ...extra};
  }

  it('requires all match sections (body + headers + query)', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/pay', status: 200, body: 'default'},
      {
        method: 'post',
        path: '/pay',
        match: {
          headers: {authorization: 'Bearer x'},
          query: {mode: 'live'},
          body: {amount: '10'},
        },
        status: 200,
        body: 'filtered',
      },
    ];

    expect(findEndpoint(eps, req('post', '/pay', {
      headers: {authorization: 'Bearer x'},
      query: {mode: 'live'},
      body: {amount: '10'},
    }))!.endpoint.body).toBe('filtered');

    expect(findEndpoint(eps, req('post', '/pay', {
      headers: {authorization: 'Bearer x'},
      query: {mode: 'live'},
      body: {amount: '99'},
    }))!.endpoint.body).toBe('default');

    expect(findEndpoint(eps, req('post', '/pay', {
      headers: {authorization: 'Bearer x'},
      query: {mode: 'sandbox'},
      body: {amount: '10'},
    }))!.endpoint.body).toBe('default');

    expect(findEndpoint(eps, req('post', '/pay', {
      headers: {authorization: 'Bearer y'},
      query: {mode: 'live'},
      body: {amount: '10'},
    }))!.endpoint.body).toBe('default');
  });

  it('partial body match ignores extra request fields', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/users', status: 200, body: 'default'},
      {
        method: 'post',
        path: '/users',
        match: {body: {role: 'admin'}},
        status: 200,
        body: 'admin',
      },
    ];
    const hit = findEndpoint(eps, req('post', '/users', {
      body: {role: 'admin', name: 'Ada', extra: {nested: true}},
    }));
    expect(hit!.endpoint.body).toBe('admin');
  });

  it('matches nested body fields with catch-all listed first', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/users', status: 200, body: 'default'},
      {
        method: 'post',
        path: '/users',
        match: {body: {user: {role: 'admin'}}},
        status: 200,
        body: 'admin',
      },
    ];
    expect(findEndpoint(eps, req('post', '/users', {
      body: {user: {role: 'admin', id: 1}},
    }))!.endpoint.body).toBe('admin');
    expect(findEndpoint(eps, req('post', '/users', {
      body: {user: {role: 'user'}},
    }))!.endpoint.body).toBe('default');
  });

  it('header match is case-insensitive on header names', () => {
    const eps: MockEndpoint[] = [
      {method: 'get', path: '/api', status: 401, body: 'no'},
      {
        method: 'get',
        path: '/api',
        match: {headers: {'X-Api-Key': 'secret'}},
        status: 200,
        body: 'ok',
      },
    ];
    expect(findEndpoint(eps, req('get', '/api', {
      headers: {'x-api-key': 'secret'},
    }))!.endpoint.body).toBe('ok');
  });

  it('skips failed filters and uses a later successful filter', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'default'},
      {method: 'post', path: '/x', match: {body: {kind: 'a'}}, status: 200, body: 'a'},
      {method: 'post', path: '/x', match: {body: {kind: 'b'}}, status: 200, body: 'b'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: {kind: 'b'}}))!.endpoint.body).toBe('b');
    expect(findEndpoint(eps, req('post', '/x', {body: {kind: 'a'}}))!.endpoint.body).toBe('a');
    expect(findEndpoint(eps, req('post', '/x', {body: {kind: 'c'}}))!.endpoint.body).toBe('default');
  });

  it('returns null when only filters exist and none succeed', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', match: {body: {kind: 'a'}}, status: 200, body: 'a'},
      {method: 'post', path: '/x', match: {body: {kind: 'b'}}, status: 200, body: 'b'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: {kind: 'c'}}))).toBeNull();
  });

  it('does not treat string body as matching object body rules', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'default'},
      {method: 'post', path: '/x', match: {body: {ddd: 'salam'}}, status: 200, body: 'filtered'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: 'salam'}))!.endpoint.body).toBe('default');
    expect(findEndpoint(eps, req('post', '/x', {body: null}))!.endpoint.body).toBe('default');
  });

  it('uses expect equality for body match (no string coercion)', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'default'},
      {method: 'post', path: '/x', match: {body: {n: 5}}, status: 200, body: 'num'},
      {method: 'post', path: '/x', match: {body: {n: '=~ 5'}}, status: 200, body: 'as-string'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: {n: 5}}))!.endpoint.body).toBe('num');
    expect(findEndpoint(eps, req('post', '/x', {body: {n: '5'}}))!.endpoint.body).toBe('as-string');
  });

  it('matches body path operators when catch-all is first', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'default'},
      {
        method: 'post',
        path: '/x',
        match: {body: {'user.role': 'admin', 'user.name': '=C Ada'}},
        status: 200,
        body: 'admin',
      },
      {
        method: 'post',
        path: '/x',
        match: {body: {'user.role': '!= admin'}},
        status: 200,
        body: 'other',
      },
    ];
    expect(findEndpoint(eps, req('post', '/x', {
      body: {user: {role: 'admin', name: 'Ada Lovelace'}},
    }))!.endpoint.body).toBe('admin');
    expect(findEndpoint(eps, req('post', '/x', {
      body: {user: {role: 'user', name: 'Bob'}},
    }))!.endpoint.body).toBe('other');
  });

  it('matches header and query operators', () => {
    const eps: MockEndpoint[] = [
      {method: 'get', path: '/x', status: 200, body: 'default'},
      {
        method: 'get',
        path: '/x',
        match: {
          headers: {authorization: '=C Bearer'},
          query: {mode: '!= sandbox'},
        },
        status: 200,
        body: 'filtered',
      },
    ];
    expect(findEndpoint(eps, req('get', '/x', {
      headers: {Authorization: 'Bearer secret'},
      query: {mode: 'live'},
    }))!.endpoint.body).toBe('filtered');
    expect(findEndpoint(eps, req('get', '/x', {
      headers: {Authorization: 'Basic x'},
      query: {mode: 'live'},
    }))!.endpoint.body).toBe('default');
  });

  it('keeps method and path gates before match priority', () => {
    const eps: MockEndpoint[] = [
      {method: 'get', path: '/health', status: 200, body: 'get-default'},
      {
        method: 'post',
        path: '/health',
        match: {headers: {xxx: '1'}, body: {ddd: 'salam'}},
        status: 200,
        body: 'post-filtered',
      },
      {method: 'post', path: '/health', status: 200, body: 'post-default'},
      {method: 'post', path: '/other', match: {body: {ddd: 'salam'}}, status: 200, body: 'other'},
    ];
    expect(findEndpoint(eps, req('post', '/health', {
      headers: {xxx: '1'},
      body: {ddd: 'salam'},
    }))!.endpoint.body).toBe('post-filtered');
    expect(findEndpoint(eps, req('get', '/health', {
      headers: {xxx: '1'},
      body: {ddd: 'salam'},
    }))!.endpoint.body).toBe('get-default');
    expect(findEndpoint(eps, req('post', '/other', {
      body: {ddd: 'salam'},
    }))!.endpoint.body).toBe('other');
  });

  it('uses first bare catch-all when several have no match', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'first'},
      {method: 'post', path: '/x', status: 200, body: 'second'},
      {method: 'post', path: '/x', match: {body: {a: '1'}}, status: 200, body: 'filtered'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: {}}))!.endpoint.body).toBe('first');
    expect(findEndpoint(eps, req('post', '/x', {body: {a: '1'}}))!.endpoint.body).toBe('filtered');
  });

  it('x-mock-example still overrides match priority', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/login', name: 'default', status: 200, body: 'default'},
      {
        method: 'post',
        path: '/login',
        name: 'admin',
        match: {body: {username: 'admin'}},
        status: 200,
        body: 'admin',
      },
    ];
    const forced = findEndpoint(eps, req('post', '/login', {
      headers: {'x-mock-example': 'admin'},
      body: {username: 'not-admin'},
    }));
    expect(forced!.endpoint.body).toBe('admin');
  });

  it('prefers an earlier filtered match over a later more-specific filter', () => {
    const eps: MockEndpoint[] = [
      {method: 'post', path: '/x', status: 200, body: 'default'},
      {method: 'post', path: '/x', match: {body: {a: '1'}}, status: 200, body: 'broad'},
      {method: 'post', path: '/x', match: {body: {a: '1', b: '2'}}, status: 200, body: 'narrow'},
    ];
    expect(findEndpoint(eps, req('post', '/x', {body: {a: '1', b: '2'}}))!.endpoint.body).toBe('broad');
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
