import { extractOutputs, ResponseData } from './outputExtractor';

describe('outputExtractor', () => {
  it('extracts with explicit regex prefix', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"id": 123, "name": "mehrdad"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { id: 'regex "id":\\s*(\\d+)' });
    expect(res.id).toBe('123');
  });

  it('extracts using regex with capture group', () => {
    const response: ResponseData = {
      type: 'json',
      body: '{"token":"abc-123-def"}',
      headers: { 'Content-Type': 'application/json' },
      cookies: {}
    };
    const res = extractOutputs(response, { token: 'regex "token":"([^\\"]+)"' });
    expect(res.token).toBe('abc-123-def');
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

  it('returns empty string for unsupported/dot notation', () => {
    const response: ResponseData = {
      type: 'json',
      body: { user: { id: 1 } },
      headers: {},
      cookies: {}
    } as any;
    const res = extractOutputs(response, { nope: 'body.user.id' });
    expect(res.nope).toBe('');
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
});
