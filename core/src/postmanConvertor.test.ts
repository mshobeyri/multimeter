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
    // Protocol is undefined for http URLs (inferred from URL)
    expect(api.protocol).toBeUndefined();
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
    // HTTP URLs don't have explicit protocol
    expect(login.protocol).toBeUndefined();
    // WebSocket URLs get explicit protocol
    expect(socket.protocol).toBe('ws');
    expect(socket.format).toBe('text');
    expect(socket.body).toEqual({ meta: 'x' });
  });

  it('converts Postman dynamic random variables to r: tokens', () => {
    const collection = {
      item: [
        {
          name: 'Randomized',
          request: {
            method: 'POST',
            header: [ { key: 'Content-Type', value: 'application/json' } ],
            url: { raw: 'https://api.example.com/createUser?uuid={{$guid}}&ip={{$randomIP}}' },
            body: { mode: 'raw', raw: '{"id":"{{$guid}}","email":"{{$randomEmail}}","v":"{{$randomInt}}","name":"{{$randomFullName}}"}' }
          }
        }
      ]
    };
    const apis = postmanToAPI(collection);
    expect(apis.length).toBe(1);
    const api = apis[0];
    // URL replacements
    expect(api.url).toContain('uuid=r:uuid');
    expect(api.url).toContain('ip=r:ip');
    // Body replacements
    expect(typeof api.body).toBe('string');
    const bodyStr = api.body as string;
    expect(bodyStr).toContain('"id":"r:uuid"');
    expect(bodyStr).toContain('"email":"r:email"');
    expect(bodyStr).toContain('"v":"r:int"');
    expect(bodyStr).toContain('"name":"r:full_name"');
  });

  it('when examples exist, exposes url/headers/body as inputs and builds example overrides', () => {
    const collection = {
      item: [
        {
          name: 'Create User',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'X-Env', value: 'prod' }
            ],
            url: { raw: 'https://api.example.com/users' },
            body: { mode: 'raw', raw: '{"name":"alice","active":true}' }
          },
          response: [
            {
              name: 'example-override',
              originalRequest: {
                method: 'POST',
                header: [
                  { key: 'Content-Type', value: 'application/json' },
                  { key: 'X-Env', value: 'staging' },
                  { key: 'X-Extra', value: '1' }
                ],
                url: { raw: 'https://api.example.com/users?mode=demo' },
                body: { mode: 'raw', raw: '{"name":"bob","active":false}' }
              }
            }
          ]
        }
      ]
    };

    const apis = postmanToAPI(collection);
    expect(apis.length).toBe(1);
    const api = apis[0];
    // url is parameterized
    expect(api.url).toBe('<<i:url>>');
    expect(api.inputs).toBeTruthy();
    expect(api.inputs!.url).toBe('https://api.example.com/users');
    // headers are parameterized with union of keys
    expect(api.headers).toBeTruthy();
    expect(api.headers!['Content-Type']).toBe('<<i:hdr_content_type>>');
    expect(api.headers!['X-Env']).toBe('<<i:hdr_x_env>>');
    expect(api.headers!['X-Extra']).toBe('<<i:hdr_x_extra>>');
    expect(api.inputs!['hdr_content_type']).toBe('application/json');
    expect(api.inputs!['hdr_x_env']).toBe('prod');
    // new header default is empty
    expect(api.inputs!['hdr_x_extra']).toBe('');
    // body parameterized as single input
    expect(api.body).toBe('<<i:body>>');
    expect(typeof api.inputs!.body).toBe('string');
    expect(api.inputs!.body).toContain('"name":"alice"');

    // example overrides only changed values
    expect(Array.isArray(api.examples)).toBe(true);
    expect(api.examples!.length).toBe(1);
    const ex = api.examples![0];
    expect(ex.name).toBe('example-override');
    expect(ex.inputs).toBeTruthy();
    expect(ex.inputs!.url).toBe('https://api.example.com/users?mode=demo');
    expect(ex.inputs!['hdr_x_env']).toBe('staging');
    expect(ex.inputs!['hdr_x_extra']).toBe('1');
    expect(ex.inputs!['body']).toContain('"name":"bob"');
    // unchanged header not present
    expect(ex.inputs!['hdr_content_type']).toBeUndefined();
  });
});
