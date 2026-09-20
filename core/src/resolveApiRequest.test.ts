import {APIData} from './APIData';
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

  it('applies auth into headers and removes auth block', () => {
    const authed = resolveApiRequest({
      type: 'api',
      url: 'https://example.com',
      auth: {type: 'bearer', token: 'secret'},
    } as APIData, {}, {});
    expect(authed.auth).toBeUndefined();
    expect(authed.headers?.Authorization).toBe('Bearer secret');
  });
});
