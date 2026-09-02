import { openApiToAPI, buildOpenApiEnvFromSpec } from './openapiConvertor';
import { parseYamlStrict } from './markupConvertor';

describe('openapiConvertor.openApiToAPI', () => {
  it('returns empty array for invalid input', () => {
    expect(openApiToAPI(null)).toEqual([]);
    expect(openApiToAPI({})).toEqual([]);
  });

  it('converts basic GET without body', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [ { url: 'https://test.mmt.dev' } ],
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
    expect(api.url).toBe('https://test.mmt.dev/users');
    expect(api.method).toBe('get');
    expect(api.query).toEqual({ page: '1' });
    expect(api.headers).toEqual({ 'X-Trace': 'abc' });
    expect(api.body).toBeUndefined();
  });

  it('handles path params and generates body example from schema properties', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [ { url: 'https://test.mmt.dev' } ],
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
    expect(api.url).toBe('https://test.mmt.dev/user/42');
    expect(api.method).toBe('post');
    expect(api.format).toBe('json');
    expect(typeof api.body).toBe('string');
    const parsed = JSON.parse(api.body as string);
    expect(parsed).toEqual({ name: 'Alice', age: 30, active: true });
  });

  it('picks XML format and sets a self-closing fallback body for string schema', () => {
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
    expect(api.body).toBe('<root/>');
  });

  it('generates XML from schema properties when format is xml', () => {
    const spec = {
      openapi: '3.0.0',
      paths: {
        '/xmlprops': {
          post: {
            requestBody: {
              content: {
                'application/xml': {
                  schema: {
                    properties: {
                      name: { type: 'string', example: 'Alice' },
                      id: { type: 'number', example: 42 }
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
    expect(api.format).toBe('xml');
    expect(typeof api.body).toBe('string');
    expect((api.body as string).trim().startsWith('<')).toBe(true);
    // basic check that element names are present
    expect((api.body as string).includes('<name>')).toBe(true);
    expect((api.body as string).includes('<id>')).toBe(true);
  });

  it('turns named requestBody examples into selectable API examples', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{url: 'https://test.mmt.dev'}],
      paths: {
        '/pets': {
          post: {
            summary: 'Create pet',
            requestBody: {
              content: {
                'application/json': {
                  example: {name: 'Default'},
                  examples: {
                    cat: {summary: 'Cat', value: {name: 'Whiskers'}},
                    dog: {name: 'Dog', description: 'A dog', value: {name: 'Rex'}},
                  },
                },
              },
            },
          },
        },
      },
    };
    const apis = openApiToAPI(spec);
    expect(apis).toHaveLength(1);
    expect(apis[0].body).toBe('<<i:body>>');
    expect(JSON.parse(String(apis[0].inputs?.body))).toEqual({name: 'Default'});
    expect(apis[0].examples?.map(example => example.name)).toEqual(['Cat', 'Dog']);
    expect(apis[0].examples?.[0].inputs?.body && JSON.parse(String(apis[0].examples[0].inputs.body))).toEqual({name: 'Whiskers'});
    expect(apis[0].examples?.[1].description).toBe('A dog');
  });

  it('uses the first named example as the default body when no single example is set', () => {
    const spec = {
      openapi: '3.0.0',
      paths: {
        '/pets': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  examples: {
                    only: {value: {ok: true}},
                  },
                },
              },
            },
          },
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(api.body).toBe('<<i:body>>');
    expect(JSON.parse(String(api.inputs?.body))).toEqual({ok: true});
    expect(api.examples?.[0].name).toBe('only');
    expect(api.examples?.[0].inputs).toBeUndefined();
  });

  it('resolves internal parameter refs from components', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{url: 'https://test.mmt.dev'}],
      components: {
        parameters: {
          TraceHeader: {
            name: 'X-Trace',
            in: 'header',
            schema: {type: 'string', example: 'demo'},
          },
        },
      },
      paths: {
        '/echo': {
          post: {
            summary: 'Echo POST body',
            parameters: [{$ref: '#/components/parameters/TraceHeader'}],
            requestBody: {
              content: {
                'application/json': {
                  example: {name: 'Ada'},
                },
              },
            },
          },
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(api.headers).toEqual({'Content-Type': 'application/json', 'X-Trace': 'demo'});
  });

  it('merges path-level parameter refs with operation parameters', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{url: 'https://test.mmt.dev'}],
      components: {
        parameters: {
          TraceHeader: {
            name: 'X-Trace',
            in: 'header',
            schema: {type: 'string', example: 'path'},
          },
        },
      },
      paths: {
        '/items/{id}': {
          parameters: [{$ref: '#/components/parameters/TraceHeader'}],
          get: {
            summary: 'Get item',
            parameters: [
              {name: 'id', in: 'path', schema: {example: 7}},
              {name: 'verbose', in: 'query', schema: {example: 'yes'}},
            ],
          },
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(api.url).toBe('https://test.mmt.dev/items/7');
    expect(api.headers).toEqual({'X-Trace': 'path'});
    expect(api.query).toEqual({verbose: 'yes'});
  });

  it('generates request bodies from resolved schema refs', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{url: 'https://test.mmt.dev'}],
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: {
              name: {type: 'string', example: 'doggie'},
              status: {type: 'string', example: 'available'},
            },
          },
        },
      },
      paths: {
        '/pets': {
          post: {
            summary: 'Add pet',
            requestBody: {
              content: {
                'application/json': {
                  schema: {$ref: '#/components/schemas/Pet'},
                },
              },
            },
          },
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(JSON.parse(String(api.body))).toEqual({name: 'doggie', status: 'available'});
  });

  it('resolves requestBody component refs', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{url: 'https://test.mmt.dev'}],
      components: {
        requestBodies: {
          UserBody: {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    username: {type: 'string', example: 'ada'},
                  },
                },
              },
            },
          },
        },
      },
      paths: {
        '/users': {
          post: {
            summary: 'Create user',
            requestBody: {$ref: '#/components/requestBodies/UserBody'},
          },
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(JSON.parse(String(api.body))).toEqual({username: 'ada'});
    expect(api.headers).toEqual({'Content-Type': 'application/json'});
  });

  it('maps OpenAPI server variables to <<e:>> tokens in API URLs', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{
        url: 'https://{host}/v1',
        variables: {
          host: {
            default: 'api.example.com',
            enum: ['dev.example.com', 'api.example.com'],
          },
        },
      }],
      paths: {
        '/items': {
          get: {summary: 'List items'},
        },
      },
    };
    const api = openApiToAPI(spec)[0];
    expect(api.url).toBe('https://<<e:host>>/v1/items');
  });

  it('builds env file from OpenAPI server variables', () => {
    const spec = {
      openapi: '3.0.0',
      servers: [{
        url: 'https://{environment}.example.com/v1',
        variables: {
          environment: {
            default: 'api',
            enum: ['dev', 'staging', 'api'],
          },
        },
      }],
      paths: {'/health': {get: {summary: 'Health'}}},
    };
    const env = buildOpenApiEnvFromSpec(spec);
    expect(env).toMatchObject({
      type: 'env',
      variables: {
        environment: {dev: 'dev', staging: 'staging', api: 'api'},
      },
      presets: {openapi: {default: {environment: 'api'}}},
    });
  });

  it('recovers YAML flow-mapping server url `{base_url}` into env token', () => {
    const spec = parseYamlStrict([
      'openapi: 3.0.3',
      'servers:',
      '  - url: {base_url}',
      'paths:',
      '  /json:',
      '    get:',
      '      summary: Get JSON',
    ].join('\n'));
    const api = openApiToAPI(spec)[0];
    expect(api.url).toBe('<<e:base_url>>/json');
    expect(buildOpenApiEnvFromSpec(spec)).toMatchObject({
      type: 'env',
      variables: {base_url: {default: ''}},
    });
  });
});
