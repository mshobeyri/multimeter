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
            url: { raw: 'https://test.mmt.dev/echo' },
            body: { mode: 'raw', raw: '{"hello":"world"}' }
          }
        }
      ]
    };
    const apis = postmanToAPI(collection);
    expect(apis.length).toBe(1);
    const api = apis[0];
    expect(api.method).toBe('get');
    expect(api.url).toBe('https://test.mmt.dev/echo');
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
                url: { raw: 'https://test.mmt.dev/echo' },
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
    expect(login.format).toBe('urlencoded');
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
            url: { raw: 'https://test.mmt.dev/echo?uuid={{$guid}}&ip={{$randomIP}}' },
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
            url: { raw: 'https://test.mmt.dev/echo' },
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
                url: { raw: 'https://test.mmt.dev/echo?mode=demo' },
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
    expect(api.inputs!.url).toBe('https://test.mmt.dev/echo');
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
    expect(ex.inputs!.url).toBe('https://test.mmt.dev/echo?mode=demo');
    expect(ex.inputs!['hdr_x_env']).toBe('staging');
    expect(ex.inputs!['hdr_x_extra']).toBe('1');
    expect(ex.inputs!['body']).toContain('"name":"bob"');
    // unchanged header not present
    expect(ex.inputs!['hdr_content_type']).toBeUndefined();
  });

  it('covers string requests, composed urls, header maps, auth, and broken examples', () => {
    const longDesc = 'word '.repeat(40).trim();
    const apis = postmanToAPI({
      item: [
        {name: 'skip-folder', item: [null, {request: 'https://example.com/ping'}]},
        {
          name: 'Composed',
          description: {content: longDesc, version: 'v1'},
          request: {
            method: 'PUT',
            header: 'X-A: 1\nX-B: {{token}}\n',
            url: {
              protocol: 'https',
              host: ['api', 'example', 'com'],
              port: '8443',
              path: ['v1', 'users'],
              query: [{key: 'q', value: '{{$randomBoolean}}'}],
            },
            auth: {type: 'bearer', bearer: [{key: 'token', value: '{{tok}}'}]},
            body: {mode: 'raw', raw: 12},
          },
        },
        {
          name: 'Auths',
          description: 42,
          request: {
            header: {Accept: 'text/xml', 'Content-Type': 'application/xml', skip: {nested: true}},
            url: 'https://x/xml',
            auth: {
              type: 'apikey',
              apikey: {key: 'X-Key', value: 'secret', in: 'query'},
            },
          },
        },
        {
          name: 'Basic empty',
          request: {
            url: {raw: 'https://x'},
            auth: {type: 'basic', basic: []},
          },
        },
        {
          name: 'Examples',
          request: {
            method: 'POST',
            url: {raw: 'https://x'},
            header: [{key: 'A', value: '1'}],
            body: {mode: 'urlencoded', urlencoded: [{key: 'user', value: 'a'}]},
          },
          response: [
            {code: 201, body: '{"id":1}'},
            {name: 'arr', body: '[1]'},
            {name: 'bad', body: '{not json'},
            {
              name: 'form',
              originalRequest: {
                url: {raw: 'https://x?z=1'},
                body: {mode: 'formdata', formdata: [{key: 'user', value: 'b'}, {key: 'extra', value: '1'}]},
              },
            },
            {
              name: 'oauth-skip',
              originalRequest: {url: {raw: 'https://x'}},
            },
          ],
        },
        {
          name: 'oauth',
          request: {
            url: {raw: 'https://x'},
            auth: {
              type: 'oauth2',
              oauth2: [
                {key: 'grant_type', value: 'client_credentials'},
                {key: 'accessTokenUrl', value: 'https://auth/token'},
                {key: 'clientId', value: 'id'},
                {key: 'clientSecret', value: 'secret'},
                {key: 'scope', value: 'read'},
              ],
            },
          },
        },
        {
          name: 'oauth-fail',
          request: {
            url: {raw: 'https://x'},
            auth: {type: 'oauth2', oauth2: {grant_type: 'password'}},
          },
        },
        {
          name: 'digest',
          request: {url: {raw: 'https://x'}, auth: {type: 'digest'}},
        },
      ],
    });
    expect(apis.some(a => a.url?.includes('api.example.com:8443'))).toBe(true);
    const composed = apis.find(a => a.title === 'Composed')!;
    expect(composed.tags).toEqual(['v1']);
    expect(composed.description).toContain('\n');
    expect(composed.headers?.['X-B']).toBe('<<e:token>>');
    expect(composed.auth).toEqual({type: 'bearer', token: '<<e:tok>>'});
    const xml = apis.find(a => a.title === 'Auths')!;
    expect(xml.format).toBe('xml');
    expect(xml.auth).toMatchObject({type: 'api-key', query: 'X-Key'});
    const examples = apis.find(a => a.title === 'Examples')!;
    expect(examples.outputs?.status).toBe('status');
    expect(examples.outputs?.id).toBe('body.id');
    expect(examples.outputs?.body).toBe('body');
    expect(examples.body && typeof examples.body === 'object').toBe(true);
    const oauth = apis.find(a => a.title === 'oauth')!;
    expect(oauth.auth).toMatchObject({type: 'oauth2', grant: 'client_credentials', scope: 'read'});
    expect(apis.find(a => a.title === 'oauth-fail')!.auth).toBeUndefined();
    expect(apis.find(a => a.title === 'digest')!.auth).toBeUndefined();
    expect(apis.find(a => a.title === 'Basic empty')!.auth).toBeUndefined();
  });
});
