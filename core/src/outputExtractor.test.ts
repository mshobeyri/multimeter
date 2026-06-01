import { extractOutputs, buildBodyExprFromPath, ResponseData, DEFAULT_EXTRACTION_RULES, DEFAULT_OUTPUT_KEYS, mergeWithDefaultExtractionRules } from './outputExtractor';

describe('outputExtractor', () => {
  it('extracts with explicit regex prefix (legacy)', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"id": 123, "name": "mehrdad"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { id: 'regex "id":\\s*(\\d+)' });
    expect(res.id).toBe('123');
  });

  it('extracts using regex with capture group (legacy)', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"token":"abc-123-def"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { token: 'regex "token":"([^\\"]+)"' });
    expect(res.token).toBe('abc-123-def');
  });

  // --- New regex syntax: body[/REGEX/] and body./REGEX/ ---

  it('extracts from body with bracket regex syntax body[/pattern/]', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"id": 123, "name": "mehrdad"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { id: 'body[/"id":\\s*(\\d+)/]' });
    expect(res.id).toBe('123');
  });

  it('extracts from body with dot regex syntax body./pattern/', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"token":"abc-123-def"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { token: 'body./"token":"([^\\"]+)"/' });
    expect(res.token).toBe('abc-123-def');
  });

  it('extracts whole match when no capture group in body[/pattern/]', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"status":"active","id":42}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { status: 'body[/active/]' });
    expect(res.status).toBe('active');
  });

  it('extracts whole match when no capture group in body./pattern/', () => {
    const response: ResponseData = {
      type: 'json',
      body: 'order-12345-confirmed',
      headers: { 'Content-Type': 'text/plain' },
      cookies: {}
    };
    const res = extractOutputs(response, { order: 'body./order-\\d+-confirmed/' });
    expect(res.order).toBe('order-12345-confirmed');
  });

  it('extracts from headers with bracket regex syntax headers[/pattern/]', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{}',
      headers: { 'Authorization': 'Bearer abc123token', 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { token: 'headers[/Bearer (\\S+)/]' });
    expect(res.token).toBe('abc123token');
  });

  it('extracts from headers with dot regex syntax headers./pattern/', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{}',
      headers: { 'X-Request-Id': 'req-9876', 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { reqId: 'headers./req-\\d+/' });
    expect(res.reqId).toBe('req-9876');
  });

  it('extracts from cookies with bracket regex syntax cookies[/pattern/]', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{}',
      headers: {},
      cookies: { session: 'sess-abcdef-123' }
    };
    const res = extractOutputs(response, { sid: 'cookies[/sess-([a-f]+)-\\d+/]' });
    expect(res.sid).toBe('abcdef');
  });

  it('extracts whole match from headers when no capture group', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{}',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      cookies: {}
    };
    const res = extractOutputs(response, { ct: 'headers[/application\\/json/]' });
    expect(res.ct).toBe('application/json');
  });

  it('returns empty string when regex does not match', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"status":"ok"}',
      headers: { 'Content-Type': 'text/plain' },
      cookies: {}
    };
    const res = extractOutputs(response, { nope: 'body[/nomatch/]' });
    expect(res.nope).toBe('');
  });

  it('extracts using JSONPath-style bracket syntax with $ root', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { id: 7, profile: { name: 'mehrdad' } } },
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, {
      id: '$body[user][id]',
      name: '$body[user][profile][name]'
    });
    expect(res.id).toBe(7);
    expect(res.name).toBe('mehrdad');
  });

  it('extracts headers and cookies via bracket paths', () => {
    const response: ResponseData = {
      type: 'json',
      body: { ok: true },
      headers: { 'Content-Type': 'application/json', 'x-req-id': 'RID-9' },
      cookies: { sid: 'S-77' }
    };
    const res = extractOutputs(response, {
      ct: '$headers[Content-Type]',
      rid: 'headers[x-req-id]',
      sid: 'cookies[sid]'
    });
    expect(res.ct).toBe('application/json');
    expect(res.rid).toBe('RID-9');
    expect(res.sid).toBe('S-77');
  });

  it('auto-detects XML and flattens to extract values', () => {
    const response: ResponseData = {
      type: 'auto',
      body: '<root><name>John</name></root>',
      headers: { 'Content-Type': 'application/xml' },
      cookies: {}
    };
  const res = extractOutputs(response, { name: '$body[root][name]' });
    expect(res.name).toBe('John');
  });

  it('supports array indexing in bracket paths', () => {
    const response: ResponseData = {
      type: 'json',
      body: { items: [{ name: 'a' }, { name: 'b' }] },
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
  const res = extractOutputs(response, { second: '$body[items][1][name]' });
    expect(res.second).toBe('b');
  });

  it('extracts values via dot notation', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { id: 1, name: 'mehrdad' } },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, {
      id: 'body.user.id',
      name: 'body.user.name'
    });
    expect(res.id).toBe(1);
    expect(res.name).toBe('mehrdad');
  });

  it('extracts nested object via dot notation – preserves type', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { profile: { city: 'Tehran', zip: '12345' } } },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { profile: 'body.user.profile' });
    expect(typeof res.profile).toBe('object');
    expect(res.profile).toEqual({ city: 'Tehran', zip: '12345' });
  });

  it('extracts array element via dot notation with numeric index', () => {
    const response: ResponseData = {
      type: 'json',
      body: { items: [{ name: 'a' }, { name: 'b' }] },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { second: 'body.items.1.name' });
    expect(res.second).toBe('b');
  });

  it('extracts array via dot notation – preserves array type', () => {
    const response: ResponseData = {
      type: 'json',
      body: { tags: ['alpha', 'beta'] },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { tags: 'body.tags' });
    expect(Array.isArray(res.tags)).toBe(true);
    expect(res.tags).toEqual(['alpha', 'beta']);
  });

  it('extracts headers and cookies via dot notation', () => {
    const response: ResponseData = {
      type: 'json',
      body: {},
      headers: { 'Content-Type': 'application/json', 'x-req-id': 'RID-9' },
      cookies: { sid: 'S-77' }
    };
    const res = extractOutputs(response, {
      ct: 'headers.Content-Type',
      rid: 'headers.x-req-id',
      sid: 'cookies.sid'
    });
    expect(res.ct).toBe('application/json');
    expect(res.rid).toBe('RID-9');
    expect(res.sid).toBe('S-77');
  });

  it('returns null for missing dot notation path', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { id: 1 } },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { nope: 'body.user.missing.deep' });
    expect(res.nope).toBeNull();
  });

  it('returns null for missing JSONPath value', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { id: 1 } },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { nope: '$body[user][missing]' });
    expect(res.nope).toBeNull();
  });

  it('extracts primitives with correct types via dot notation', () => {
    const response: ResponseData = {
      type: 'json',
      body: { message: 'Hello', active: true, count: 42 },
      headers: {},
      cookies: {}
    };
    const res = extractOutputs(response, {
      msg: 'body.message',
      active: 'body.active',
      count: 'body.count'
    });
    expect(res.msg).toBe('Hello');
    expect(typeof res.msg).toBe('string');
    expect(res.active).toBe(true);
    expect(typeof res.active).toBe('boolean');
    expect(res.count).toBe(42);
    expect(typeof res.count).toBe('number');
  });

  it('extracts from JSON string body via dot notation', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"user":{"id":5,"role":"admin"}}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { role: 'body.user.role' });
    expect(res.role).toBe('admin');
  });

  it('extracts message and from with correct types', () => {
    const response: ResponseData = {
      type: 'json',
      body: { message: 'Hello', from: true, count: 42 },
      headers: {},
      cookies: {}
    };
    const res = extractOutputs(response, {
      message: '$body[message]',
      from: '$body[from]',
      count: '$body[count]'
    });
    expect(res.message).toBe('Hello');
    expect(typeof res.message).toBe('string');
    expect(res.from).toBe(true);
    expect(typeof res.from).toBe('boolean');
    expect(res.count).toBe(42);
    expect(typeof res.count).toBe('number');
  });

  it('extracts an object from a list body by index – preserves object type', () => {
    const response: ResponseData = {
      type: 'json',
      body: [{ id: 1, name: 'alice' }, { id: 2, name: 'bob' }],
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, { first: '$body[0]' });
    expect(typeof res.first).toBe('object');
    expect(res.first).toEqual({ id: 1, name: 'alice' });
  });

  it('extracts a nested object from a list – preserves object type', () => {
    const response: ResponseData = {
      type: 'json',
      body: [{ id: 1, address: { city: 'Tehran', zip: '12345' } }],
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, { addr: '$body[0][address]' });
    expect(typeof res.addr).toBe('object');
    expect(res.addr).toEqual({ city: 'Tehran', zip: '12345' });
  });

  it('extracts an array value from a list body – preserves array type', () => {
    const response: ResponseData = {
      type: 'json',
      body: { items: [10, 20, 30] },
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, { items: '$body[items]' });
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items).toEqual([10, 20, 30]);
  });

  it('extracts a primitive from a list body by index – preserves type', () => {
    const response: ResponseData = {
      type: 'json',
      body: ['alpha', 'beta', 'gamma'],
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, { second: '$body[1]' });
    expect(res.second).toBe('beta');
    expect(typeof res.second).toBe('string');
  });

  it('extracts a number from a list body by index – preserves number type', () => {
    const response: ResponseData = {
      type: 'json',
      body: [100, 200, 300],
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    } as any;
    const res = extractOutputs(response, { val: '$body[2]' });
    expect(res.val).toBe(300);
    expect(typeof res.val).toBe('number');
  });

  it('extracts object from JSON string list body – preserves object type', () => {
    const response: ResponseData = {
      type: 'json',
      body: '[{"id":5,"role":"admin"},{"id":6,"role":"user"}]',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { admin: '$body[0]' });
    expect(typeof res.admin).toBe('object');
    expect(res.admin).toEqual({ id: 5, role: 'admin' });
  });
});

describe('buildBodyExprFromPath', () => {
  it('builds dot notation for simple property path', () => {
    expect(buildBodyExprFromPath(['user', 'id'])).toBe('body.user.id');
  });

  it('builds dot notation for deeply nested path', () => {
    expect(buildBodyExprFromPath(['user', 'profile', 'address', 'city'])).toBe('body.user.profile.address.city');
  });

  it('builds dot notation with numeric array indices', () => {
    expect(buildBodyExprFromPath(['items', 0, 'name'])).toBe('body.items.0.name');
  });

  it('builds dot notation for single segment', () => {
    expect(buildBodyExprFromPath(['message'])).toBe('body.message');
  });

  it('returns empty string for empty path', () => {
    expect(buildBodyExprFromPath([])).toBe('');
  });

  it('handles mixed string and numeric segments', () => {
    expect(buildBodyExprFromPath(['data', 2, 'tags', 0])).toBe('body.data.2.tags.0');
  });
});

describe('DEFAULT_EXTRACTION_RULES', () => {
  it('contains body, headers, cookies, status, duration', () => {
    expect(DEFAULT_EXTRACTION_RULES).toEqual({
      body: 'body',
      headers: 'headers',
      cookies: 'cookies',
      status: 'status',
      duration: 'duration',
    });
  });
});

describe('DEFAULT_OUTPUT_KEYS', () => {
  it('contains all default key names', () => {
    expect(DEFAULT_OUTPUT_KEYS).toContain('body');
    expect(DEFAULT_OUTPUT_KEYS).toContain('headers');
    expect(DEFAULT_OUTPUT_KEYS).toContain('cookies');
    expect(DEFAULT_OUTPUT_KEYS).toContain('status');
    expect(DEFAULT_OUTPUT_KEYS).toContain('duration');
    expect(DEFAULT_OUTPUT_KEYS).toHaveLength(5);
  });
});

describe('mergeWithDefaultExtractionRules', () => {
  it('returns defaults when user outputs are undefined', () => {
    const result = mergeWithDefaultExtractionRules(undefined);
    expect(result).toEqual(DEFAULT_EXTRACTION_RULES);
  });

  it('returns defaults when user outputs are empty', () => {
    const result = mergeWithDefaultExtractionRules({});
    expect(result).toEqual(DEFAULT_EXTRACTION_RULES);
  });

  it('user outputs override defaults with same name', () => {
    const result = mergeWithDefaultExtractionRules({ body: 'body.data', status: 'body.statusCode' });
    expect(result.body).toBe('body.data');
    expect(result.status).toBe('body.statusCode');
    // other defaults remain
    expect(result.headers).toBe('headers');
    expect(result.cookies).toBe('cookies');
    expect(result.duration).toBe('duration');
  });

  it('user outputs add new keys alongside defaults', () => {
    const result = mergeWithDefaultExtractionRules({ token: 'body.token', userId: 'body.user.id' });
    expect(result.token).toBe('body.token');
    expect(result.userId).toBe('body.user.id');
    // defaults still present
    expect(result.body).toBe('body');
    expect(result.headers).toBe('headers');
    expect(result.cookies).toBe('cookies');
    expect(result.status).toBe('status');
    expect(result.duration).toBe('duration');
  });

  it('user outputs can override some defaults and add new keys', () => {
    const result = mergeWithDefaultExtractionRules({ status: 'body.code', message: 'body.message' });
    expect(result.status).toBe('body.code');
    expect(result.message).toBe('body.message');
    expect(result.body).toBe('body');
  });
});

describe('extractOutputs with default rules', () => {
  it('extracts body, headers, cookies, status, duration with default rules', () => {
    const response: ResponseData = {
      type: 'json',
      body: { message: 'hello', id: 42 },
      headers: { 'Content-Type': 'application/json' },
      cookies: { session: 'abc123' },
      status: 200,
      duration: 150,
    } as any;
    const result = extractOutputs(response, DEFAULT_EXTRACTION_RULES);
    expect(result.body).toEqual({ message: 'hello', id: 42 });
    expect(result.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(result.cookies).toEqual({ session: 'abc123' });
    expect(result.status).toBe(200);
    expect(result.duration).toBe(150);
  });

  it('extracts defaults plus user-defined outputs', () => {
    const response: ResponseData = {
      type: 'json',
      body: { message: 'success', token: 'xyz' },
      headers: { 'Content-Type': 'application/json' },
      cookies: {},
      status: 201,
      duration: 80,
    } as any;
    const rules = mergeWithDefaultExtractionRules({ token: 'body.token', msg: 'body.message' });
    const result = extractOutputs(response, rules);
    expect(result.body).toEqual({ message: 'success', token: 'xyz' });
    expect(result.status).toBe(201);
    expect(result.duration).toBe(80);
    expect(result.token).toBe('xyz');
    expect(result.msg).toBe('success');
  });

  it('user override replaces default extraction for same key', () => {
    const response: ResponseData = {
      type: 'json',
      body: { data: { items: [1, 2, 3] }, raw: 'test' },
      headers: { 'X-Custom': 'val' },
      cookies: {},
      status: 200,
      duration: 50,
    } as any;
    // User overrides body to extract only body.data
    const rules = mergeWithDefaultExtractionRules({ body: 'body.data' });
    const result = extractOutputs(response, rules);
    expect(result.body).toEqual({ items: [1, 2, 3] });
    expect(result.status).toBe(200);
  });

  it('status defaults to 0 when not present in response', () => {
    const response: ResponseData = {
      type: 'json',
      body: {},
      headers: {},
      cookies: {},
    };
    const result = extractOutputs(response, DEFAULT_EXTRACTION_RULES);
    expect(result.status).toBe(0);
    expect(result.duration).toBe(0);
  });

  it('supports dot-notation paths for nested body access', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { name: 'mehrdad', age: 30 } },
      headers: {},
      cookies: {},
      status: 200,
      duration: 100,
    } as any;
    const rules = mergeWithDefaultExtractionRules({ 'userName': 'body.user.name' });
    const result = extractOutputs(response, rules);
    expect(result.userName).toBe('mehrdad');
    expect(result.body).toEqual({ user: { name: 'mehrdad', age: 30 } });
    expect(result.status).toBe(200);
  });
});
