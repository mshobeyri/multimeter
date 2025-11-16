import { postmanToAPI } from './postmanConvertor';

describe('postmanConvertor.postmanToAPI real collection features', () => {
  it('handles websocket, env variable placeholders, nested items, urlencoded, xml and response-only entries', () => {
    const collection = {
      info: { name: 'Real Example', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'WS Echo',
          request: {
            method: 'GET',
            url: { raw: 'ws://echo.example.com/{{tenant}}/socket?auth={{token}}' }
          },
          response: [
            { name: 'Example 101', status: 'Switching Protocols' }
          ]
        },
        {
          name: 'User',
          item: [
            {
              name: 'Create User',
              request: {
                method: 'POST',
                header: [
                  { key: 'Content-Type', value: 'application/json' },
                  { key: 'X-Env', value: '{{envName}}' }
                ],
                url: { raw: 'https://api.example.com/users' },
                body: { mode: 'raw', raw: '{"name":"{{username}}","active":true}' }
              }
            },
            {
              name: 'Get User',
              request: {
                method: 'GET',
                header: [ { key: 'Content-Type', value: 'application/json' } ],
                url: { raw: 'https://api.example.com/users/{{userId}}' }
              }
            }
          ]
        },
        {
          name: 'Update User',
          request: {
            method: 'PUT',
            header: [ { key: 'Content-Type', value: 'application/xml' } ],
            url: { raw: 'https://api.example.com/users/{{userId}}' },
            body: { mode: 'raw', raw: '<user><id>{{userId}}</id><status>active</status></user>' }
          }
        },
        {
          name: 'Login',
          request: {
            method: 'POST',
            header: [ { key: 'Content-Type', value: 'application/x-www-form-urlencoded' } ],
            url: { raw: 'https://api.example.com/login' },
            body: { mode: 'urlencoded', urlencoded: [ { key: 'user', value: '{{user}}' }, { key: 'pass', value: '{{pass}}' } ] }
          }
        },
        {
          name: 'Static Status',
          request: {
            method: 'GET',
            header: [ { key: 'Content-Type', value: 'application/json' } ],
            url: { raw: 'https://api.example.com/status' }
          }
        },
        {
          name: 'Ping Example (response only) ',
          response: [ { name: '200 OK', status: 'OK' } ]
        }
      ]
    };

    const apis = postmanToAPI(collection);
  // Expect flattened: WS Echo, Create User, Get User, Update User, Login, Static Status, Ping Example (response-only)
  expect(apis.length).toBe(7);

    const wsEcho = apis.find(a => a.title === 'WS Echo');
    expect(wsEcho).toBeTruthy();
    expect(wsEcho!.protocol).toBe('ws');
  expect(wsEcho!.url).toContain('<<e:tenant>>');
  expect(wsEcho!.url).toContain('<<e:token>>');

  const createUser = apis.find(a => a.title === 'Create User');
  expect(createUser).toBeTruthy();
  expect(createUser!.headers!['X-Env']).toBe('<<e:envName>>');
  expect(createUser!.format).toBe('json');
  expect(createUser!.body).toBe('{"name":"<<e:username>>","active":true}');

    const getUser = apis.find(a => a.title === 'Get User');
    expect(getUser).toBeTruthy();
  expect(getUser!.url).toContain('<<e:userId>>');
    expect(getUser!.method).toBe('get');

    const updateUser = apis.find(a => a.title === 'Update User');
    expect(updateUser).toBeTruthy();
    expect(updateUser!.format).toBe('xml');
  expect(updateUser!.body).toBe('<user><id><<e:userId>></id><status>active</status></user>');

    const login = apis.find(a => a.title === 'Login');
    expect(login).toBeTruthy();
  expect(login!.body).toEqual({ user: '<<e:user>>', pass: '<<e:pass>>' });

  const staticStatus = apis.find(a => a.title === 'Static Status');
  expect(staticStatus).toBeTruthy();
  expect(staticStatus!.url).toBe('https://api.example.com/status');
  expect(staticStatus!.protocol).toBe('http');
  expect(staticStatus!.method).toBe('get');

    const ping = apis.find(a => a.title?.startsWith('Ping Example'));
    expect(ping).toBeTruthy();
    // Request absent -> url empty string
    expect(ping!.url).toBe('');
    // Method undefined for response-only item
    expect(ping!.method).toBeUndefined();
  });
});
