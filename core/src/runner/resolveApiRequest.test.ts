import {APIData} from '../data/APIData';
import {formatBody} from '../parse/markupConvertor';
import {resolveApiRequest} from './resolveApiRequest';

describe('resolveApiRequest', () => {
  const api = {
    type: 'api',
    url: 'https://example.com/echo',
    method: 'post',
    format: 'json',
    inputs: {},
    body: {
      id: 'r:uuid',
      count: 'r:int(10,20)',
      created: 'c:date',
    },
  } as APIData;

  it('resolves runtime tokens into concrete request values', () => {
    const request = resolveApiRequest(api, {}, {}, {refreshRuntimeTokens: true});
    const body = JSON.parse(String(request.body));
    expect(body.id).toEqual(expect.not.stringMatching(/^r:/));
    expect(body.count).toEqual(expect.any(Number));
    expect(body.created).toEqual(expect.not.stringMatching(/^c:/));
    expect(body.count).toBeGreaterThanOrEqual(10);
    expect(body.count).toBeLessThanOrEqual(20);
  });

  it('refreshes runtime tokens on each send-style resolve', () => {
    const first = resolveApiRequest(api, {}, {}, {refreshRuntimeTokens: true});
    const second = resolveApiRequest(api, {}, {}, {refreshRuntimeTokens: true});
    const firstId = JSON.parse(String(first.body)).id;
    const secondId = JSON.parse(String(second.body)).id;
    expect(firstId).not.toBe('r:uuid');
    expect(secondId).not.toBe('r:uuid');
    expect(firstId).not.toBe(secondId);
  });

  it('keeps multipart parts as an array instead of a JSON preview string', () => {
    const request = resolveApiRequest({
      type: 'api',
      url: 'https://example.com/upload',
      method: 'post',
      format: 'multipart',
      body: [
        {name: 'meta', value: 'hello'},
        {name: 'file', file: './payload.bin'},
      ],
    } as APIData, {}, {});
    expect(Array.isArray(request.body)).toBe(true);
    expect(request.body).toEqual([
      {name: 'meta', value: 'hello'},
      {name: 'file', file: './payload.bin'},
    ]);
  });

  it('resolves i: tokens in structured urlencoded bodies for UI preview', () => {
    const urlencodedApi = {
      type: 'api',
      url: 'https://example.com/echo',
      method: 'post',
      format: 'urlencoded',
      inputs: {username: 'demo', role: 'admin'},
      body: {username: 'i:username', role: 'i:role'},
    } as APIData;
    const preview = resolveApiRequest(urlencodedApi, {}, {}, {preserveStructuredBody: true});
    expect(preview.body).toEqual({username: 'demo', role: 'admin'});
    expect(formatBody('urlencoded', preview.body, false)).toBe('username=demo&role=admin');
  });

  it('keeps e: tokens when env value is a ./…mmt file path (runtime getter)', () => {
    const fileBackedApi = {
      type: 'api',
      url: 'https://example.com/echo',
      method: 'post',
      format: 'json',
      body: {
        session_api: 'e:session_api',
        host: 'e:host',
      },
    } as APIData;
    const request = resolveApiRequest(fileBackedApi, {}, {
      session_api: './create_session_api.mmt',
      host: 'https://example.com',
    }, {preserveStructuredBody: true});
    expect(request.body).toEqual({
      session_api: 'e:session_api',
      host: 'https://example.com',
    });
  });

  it('preserves structured bodies while resolving all tokens for UI preview', () => {
    const request = resolveApiRequest(api, {}, {}, {preserveStructuredBody: true});
    expect(typeof request.body).toBe('object');
    expect(Array.isArray(request.body)).toBe(false);
    const body = request.body as Record<string, unknown>;
    expect(body.id).toEqual(expect.not.stringMatching(/^r:/));
    expect(body.count).toEqual(expect.any(Number));
    expect(body.created).toEqual(expect.not.stringMatching(/^c:/));
    expect(body.count).toBeGreaterThanOrEqual(10);
    expect(body.count).toBeLessThanOrEqual(20);
  });

  it('applies auth into headers and removes auth block', () => {
    const authed = resolveApiRequest({
      type: 'api',
      url: 'https://example.com',
      auth: {type: 'bearer', token: 'secret'},
    } as APIData, {}, {});
    expect(authed.auth).toBeUndefined();
    expect(authed.headers?.Authorization).toBe('Bearer secret');
  });

  it('resolves i: chains to e:/c: consistently across fields', () => {
    const request = resolveApiRequest({
      type: 'api',
      url: 'https://example.com/<<i:user>>',
      method: 'post',
      format: 'json',
      inputs: {
        user: 'alice',
        host: 'e:host',
        stamp: 'c:time',
      },
      headers: {
        'X-Host': 'i:host',
        'X-Host-2': 'i:host',
        'X-Stamp': 'i:stamp',
        'X-Direct-E': 'e:host',
      },
      body: {
        host: 'i:host',
        stamp: 'i:stamp',
        label: '<<i:host>>/<<i:user>>',
      },
    } as APIData, {}, {host: 'api.local'}, {preserveStructuredBody: true});

    expect(request.url).toBe('https://example.com/alice');
    expect(request.headers?.['X-Host']).toBe('api.local');
    expect(request.headers?.['X-Host-2']).toBe('api.local');
    expect(request.headers?.['X-Direct-E']).toBe('api.local');
    expect(request.body).toEqual({
      host: 'api.local',
      stamp: request.headers?.['X-Stamp'],
      label: 'api.local/alice',
    });
    expect(String(request.headers?.['X-Stamp']).length).toBeGreaterThan(0);
  });

  it('remints r: per i: reference when the input default is still r:uuid', () => {
    const request = resolveApiRequest({
      type: 'api',
      url: 'https://example.com',
      method: 'post',
      format: 'json',
      inputs: {req_id: 'r:uuid'},
      headers: {'X-Req': 'i:req_id', 'X-Req-2': 'i:req_id'},
      query: {rid: 'i:req_id'},
      body: {req_id: 'i:req_id', direct: 'r:uuid'},
    } as APIData, {}, {}, {refreshRuntimeTokens: true, preserveStructuredBody: true});

    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(request.headers?.['X-Req']).toMatch(uuid);
    expect(request.headers?.['X-Req-2']).toMatch(uuid);
    expect(request.query?.rid).toMatch(uuid);
    expect((request.body as any).req_id).toMatch(uuid);
    expect((request.body as any).direct).toMatch(uuid);
    // Same input name, but each i: lookup remints because r: is never cached.
    expect(request.headers?.['X-Req']).not.toBe(request.headers?.['X-Req-2']);
    expect(request.headers?.['X-Req']).not.toBe((request.body as any).req_id);
  });

  it('keeps i:→r: consistent when inputs were already materialized', () => {
    const minted = '11111111-2222-4333-8444-555555555555';
    const request = resolveApiRequest({
      type: 'api',
      url: 'https://example.com',
      method: 'post',
      format: 'json',
      inputs: {req_id: 'r:uuid'},
      headers: {'X-Req': 'i:req_id', 'X-Req-2': 'i:req_id'},
      body: {req_id: 'i:req_id'},
    } as APIData, {req_id: minted}, {}, {preserveStructuredBody: true});

    expect(request.headers?.['X-Req']).toBe(minted);
    expect(request.headers?.['X-Req-2']).toBe(minted);
    expect(request.body).toEqual({req_id: minted});
  });
});
