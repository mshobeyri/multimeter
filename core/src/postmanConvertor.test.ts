import { postmanToAPI } from './postmanConvertor';

describe('postmanConvertor.postmanToAPI', () => {
  it('returns empty array for invalid input', () => {
    expect(postmanToAPI(null)).toEqual([]);
    expect(postmanToAPI({})).toEqual([]);
  });

  it('converts a simple raw body request', () => {
    const collection = {
      item: [
        {
          name: 'Get Users',
          request: {
            method: 'GET',
            header: [ { key: 'Content-Type', value: 'application/json' } ],
            url: { raw: 'https://api.example.com/users' },
            body: { mode: 'raw', raw: '{"hello":"world"}' }
          }
        }
      ]
    };
    const apis = postmanToAPI(collection);
    expect(apis.length).toBe(1);
    const api = apis[0];
    expect(api.method).toBe('get');
    expect(api.url).toBe('https://api.example.com/users');
    expect(api.format).toBe('json');
    expect(api.body).toBe('{"hello":"world"}');
    expect(api.protocol).toBe('http');
  });

  it('flattens nested folders and converts urlencoded/formdata and ws protocol', () => {
    const collection = {
      item: [
        {
          name: 'Folder',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                header: [ { key: 'Content-Type', value: 'application/x-www-form-urlencoded' } ],
                url: { raw: 'https://api.example.com/login' },
                body: { mode: 'urlencoded', urlencoded: [ { key: 'user', value: 'alice' }, { key: 'pass', value: 'secret' } ] }
              }
            },
            {
              name: 'Socket Connect',
              request: {
                method: 'GET',
                header: [ { key: 'Content-Type', value: 'text/plain' } ],
                url: { raw: 'ws://socket.example.com/connect?token=abc' },
                urlencoded: [],
                body: { mode: 'formdata', formdata: [ { key: 'meta', value: 'x' } ] }
              }
            }
          ]
        }
      ]
    };

    const apis = postmanToAPI(collection);
    expect(apis.length).toBe(2);
    const login = apis.find(a => a.title?.includes('Login'))!;
    const socket = apis.find(a => a.title?.includes('Socket'))!;
    expect(login.method).toBe('post');
    expect(login.body).toEqual({ user: 'alice', pass: 'secret' });
    expect(socket.protocol).toBe('ws');
    expect(socket.format).toBe('text');
    expect(socket.body).toEqual({ meta: 'x' });
  });
});
