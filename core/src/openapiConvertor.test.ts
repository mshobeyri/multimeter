import { openApiToAPI } from './openapiConvertor';

describe('openapiConvertor.openApiToAPI', () => {
  it('returns empty array for invalid input', () => {
    expect(openApiToAPI(null)).toEqual([]);
    expect(openApiToAPI({})).toEqual([]);
  });

  it('converts basic GET without body', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [ { url: 'https://api.example.com' } ],
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            parameters: [
              { in: 'query', name: 'page', schema: { example: '1' } },
              { in: 'header', name: 'X-Trace', schema: { example: 'abc' } }
            ]
          }
        }
      }
    };
    const apis = openApiToAPI(spec);
    expect(apis.length).toBe(1);
    const api = apis[0];
    expect(api.title).toBe('List users');
    expect(api.url).toBe('https://api.example.com/users');
    expect(api.method).toBe('get');
    expect(api.query).toEqual({ page: '1' });
    expect(api.headers).toEqual({ 'X-Trace': 'abc' });
    expect(api.body).toBeUndefined();
  });

  it('handles path params and generates body example from schema properties', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [ { url: 'https://api.example.com' } ],
      paths: {
        '/user/{id}': {
          post: {
            summary: 'Update user',
            description: 'Updates a user',
            parameters: [ { in: 'path', name: 'id', schema: { example: 42 } } ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    properties: {
                      name: { type: 'string', example: 'Alice' },
                      age: { type: 'number', example: 30 },
                      active: { type: 'boolean', example: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    const apis = openApiToAPI(spec);
    expect(apis.length).toBe(1);
    const api = apis[0];
    expect(api.url).toBe('https://api.example.com/user/42');
    expect(api.method).toBe('post');
    expect(api.format).toBe('json');
    expect(typeof api.body).toBe('string');
    const parsed = JSON.parse(api.body as string);
    expect(parsed).toEqual({ name: 'Alice', age: 30, active: true });
  });

  it('picks XML format and sets fallback body for string schema', () => {
    const spec = {
      openapi: '3.0.0',
      paths: {
        '/xml': {
          post: {
            requestBody: {
              content: {
                'application/xml': {
                  schema: { type: 'string' }
                }
              }
            }
          }
        }
      }
    };
    const apis = openApiToAPI(spec);
    expect(apis.length).toBe(1);
    const api = apis[0];
    expect(api.format).toBe('xml');
    expect(api.body).toBe('<root></root>');
  });
});
