import {convertToMmt, detectImportSource, findSpecApiSelection, listSpecApis, listSpecApisFromFiles} from './importConvertor';
import {parseYamlStrict} from './markupConvertor';

describe('importConvertor', () => {
  it('detects supported import sources', () => {
    expect(detectImportSource(JSON.stringify({info: {name: 'Collection'}, item: []}), 'collection.json')).toBe('postman');
    expect(detectImportSource('openapi: 3.0.0\npaths: {}\n', 'openapi.yaml')).toBe('openapi');
    expect(detectImportSource('<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>', 'service.wsdl')).toBe('wsdl');
    expect(detectImportSource('GET https://example.com', 'request.http')).toBe('http');
    expect(detectImportSource('meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}', 'get-user.bru')).toBe('bruno');
  });

  it('lists OpenAPI operations for the spec selector', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'Pets', version: '1.0.0'},
      paths: {
        '/pets': {
          get: {summary: 'List pets', operationId: 'listPets'},
          post: {summary: 'Create pet', operationId: 'createPet'},
        },
      },
    };
    const apis = listSpecApis(JSON.stringify(spec), 'pets.openapi.json');
    expect(apis).toHaveLength(2);
    expect(apis.map(item => item.title)).toEqual(['List pets', 'Create pet']);
    expect(apis[0].api.type).toBe('api');
    expect(apis[0].method).toBe('get');
    expect(apis[0].examples).toEqual([]);
    expect(apis[1].examples).toEqual([]);
  });

  it('lists Postman requests for the spec selector', () => {
    const collection = {
      info: {name: 'Users', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: [
        {name: 'Get user', request: {method: 'GET', url: 'https://example.com/users/1'}},
        {name: 'Create user', request: {method: 'POST', url: 'https://example.com/users'}},
      ],
    };
    const apis = listSpecApis(JSON.stringify(collection), 'users.postman_collection.json');
    expect(apis.length).toBeGreaterThanOrEqual(2);
    expect(apis.every(item => item.api.type === 'api')).toBe(true);
  });

  it('lists WSDL operations for the spec selector', () => {
    const wsdl = `<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://schemas.xmlsoap.org/2001/XMLSchema" targetNamespace="urn:customer">
  <types>
    <xsd:schema targetNamespace="urn:customer">
      <xsd:element name="GetCustomer">
        <xsd:complexType><xsd:sequence><xsd:element name="id" type="xsd:string" /></xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="GetCustomerRequest"><part name="parameters" element="tns:GetCustomer" /></message>
  <portType name="CustomerPort"><operation name="GetCustomer"><input message="tns:GetCustomerRequest" /></operation></portType>
  <binding name="CustomerBinding" type="tns:CustomerPort"><soap:binding transport="http://schemas.xmlsoap.org/soap/http" /><operation name="GetCustomer"><soap:operation soapAction="urn:GetCustomer" /></operation></binding>
  <service name="CustomerService"><port name="CustomerPort" binding="tns:CustomerBinding"><soap:address location="https://soap.example.com/customer" /></port></service>
</definitions>`;
    const apis = listSpecApis(wsdl, 'customer.wsdl');
    expect(apis).toHaveLength(1);
    expect(apis[0].title).toMatch(/GetCustomer/i);
    expect(apis[0].api.type).toBe('api');
    expect(apis[0].examples).toEqual([]);
  });

  it('converts a Postman collection into API, test, and env files', () => {
    const collection = {
      info: {name: 'User Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      variable: [{key: 'base_url', value: 'https://test.mmt.dev'}],
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'Create User',
              request: {
                method: 'POST',
                header: [{key: 'Content-Type', value: 'application/json'}],
                url: {raw: '{{base_url}}/users'},
                body: {mode: 'raw', raw: '{"name":"Ada"}'},
              },
              response: [{name: 'Created', code: 201}],
              event: [
                {
                  listen: 'test',
                  script: {
                    exec: [
                      'pm.response.to.have.status(201);',
                      'pm.expect(pm.response.json().id).to.eql("u1");',
                      'pm.environment.set("user_id", pm.response.json().id);',
                      'pm.require("package1");',
                    ],
                  },
                },
              ],
            },
            {
              name: 'Get User',
              request: {
                method: 'GET',
                url: {raw: '{{base_url}}/users/{{user_id}}'},
              },
              response: [{name: 'OK', code: 200}],
            },
          ],
        },
      ],
    };

    const result = convertToMmt(JSON.stringify(collection), {sourcePath: 'users.postman_collection.json'});
    expect(result.sourceKind).toBe('postman');
    expect(result.files.map(file => file.path).sort()).toEqual([
      'api/users/create-user.mmt',
      'api/users/get-user.mmt',
      'multimeter.mmt',
      'suites/collection.mmt',
      'suites/users.mmt',
      'tests/users.mmt',
    ]);

    const testFile = result.files.find(file => file.path === 'tests/users.mmt');
    expect(testFile).toBeTruthy();
    const testYaml = parseYamlStrict(testFile!.content);
    expect(testYaml.import.createUser).toBe('../api/users/create-user.mmt');
    expect(testYaml.steps[0].expect.status).toBe('== 201');
    expect(testYaml.steps[0].expect['body.id']).toBe('== u1');
    expect(testYaml.steps[1].setenv.user_id).toBe('body.id');
    expect(testYaml.steps[2].js).toContain('Original Postman test script');
    expect(testYaml.steps[3].call).toBe('getUser');

    const envFile = result.files.find(file => file.path === 'multimeter.mmt');
    expect(parseYamlStrict(envFile!.content).variables.base_url.default).toBe('https://test.mmt.dev');

    const collectionSuite = result.files.find(file => file.path === 'suites/collection.mmt');
    expect(collectionSuite).toBeTruthy();
    const collectionSuiteYaml = parseYamlStrict(collectionSuite!.content);
    expect(collectionSuiteYaml.type).toBe('suite');
    expect(collectionSuiteYaml.items).toEqual(['../suites/users.mmt']);

    const usersSuite = result.files.find(file => file.path === 'suites/users.mmt');
    expect(parseYamlStrict(usersSuite!.content).items).toEqual(['../tests/users.mmt']);
  });

  it('uses project-root imports and creates a root env marker for larger Postman conversions', () => {
    const collection = {
      info: {name: 'Big Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: Array.from({length: 5}, (_unused, index) => ({
        name: `Request ${index + 1}`,
        request: `https://test.mmt.dev/${index + 1}`,
      })),
    };

    const result = convertToMmt(JSON.stringify(collection), {sourcePath: 'big.postman_collection.json'});
    expect(result.files.some(file => file.path === 'multimeter.mmt')).toBe(true);

    const test = parseYamlStrict(result.files.find(file => file.path === 'tests/collection.mmt')!.content);
    expect(test.import.request1).toBe('+/api/request-1.mmt');

    const suite = parseYamlStrict(result.files.find(file => file.path === 'suites/collection.mmt')!.content);
    expect(suite.items).toEqual(['+/tests/collection.mmt']);
  });

  it('converts OpenAPI operations into API files', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'Pets', version: '1.0.0'},
      servers: [{url: 'https://test.mmt.dev'}],
      paths: {
        '/pets/{petId}': {
          get: {
            summary: 'Get Pet',
            parameters: [
              {name: 'petId', in: 'path', schema: {example: 123}},
              {name: 'include', in: 'query', schema: {example: 'owner'}},
            ],
          },
        },
      },
    };

    const result = convertToMmt(JSON.stringify(spec), {sourcePath: 'petstore.openapi.json'});
    expect(result.sourceKind).toBe('openapi');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('api/get-pet.mmt');
    const api = parseYamlStrict(result.files[0].content);
    expect(api.type).toBe('api');
    expect(api.url).toBe('https://test.mmt.dev/pets/123');
    expect(api.query.include).toBe('owner');
  });

  it('exports multimeter.mmt when OpenAPI server URL uses variables', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'Pets', version: '1.0.0'},
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
        '/pets': {
          get: {summary: 'List pets'},
        },
      },
    };

    const result = convertToMmt(JSON.stringify(spec), {sourcePath: 'pets.openapi.json'});
    expect(result.files).toHaveLength(2);
    const api = parseYamlStrict(result.files.find(file => file.kind === 'api')!.content);
    expect(api.url).toBe('https://<<e:host>>/v1/pets');
    const envFile = result.files.find(file => file.path === 'multimeter.mmt');
    expect(envFile?.kind).toBe('env');
    const env = parseYamlStrict(envFile!.content);
    expect(env.variables.host).toEqual({
      'dev-example-com': 'dev.example.com',
      'api-example-com': 'api.example.com',
    });
    expect(env.presets.openapi.default.host).toBe('api-example-com');
  });

  it('converts WSDL operations into SOAP API files', () => {
    const wsdl = `<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:customer">
  <types>
    <xsd:schema targetNamespace="urn:customer">
      <xsd:element name="GetCustomer">
        <xsd:complexType><xsd:sequence><xsd:element name="id" type="xsd:string" /></xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="GetCustomerRequest"><part name="parameters" element="tns:GetCustomer" /></message>
  <portType name="CustomerPort"><operation name="GetCustomer"><input message="tns:GetCustomerRequest" /></operation></portType>
  <binding name="CustomerBinding" type="tns:CustomerPort"><soap:binding transport="http://schemas.xmlsoap.org/soap/http" /><operation name="GetCustomer"><soap:operation soapAction="urn:GetCustomer" /></operation></binding>
  <service name="CustomerService"><port name="CustomerPort" binding="tns:CustomerBinding"><soap:address location="https://soap.example.com/customer" /></port></service>
</definitions>`;

    const result = convertToMmt(wsdl, {sourcePath: 'customer.wsdl'});
    expect(result.sourceKind).toBe('wsdl');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('api/getcustomer.mmt');
    const api = parseYamlStrict(result.files[0].content);
    expect(api.format).toBe('xml');
    expect(api.headers.SOAPAction).toBe('urn:GetCustomer');
    expect(api.inputs.id).toBe('string');
    expect(api.body).toContain('<tns:id><<i:id>></tns:id>');
  });

  it('converts HTTP request files into API and test MMT files', () => {
    const result = convertToMmt([
      '@host = https://test.mmt.dev',
      '###',
      '# @name listUsers',
      'GET {{host}}/json',
      'Accept: application/json',
    ].join('\n'), {sourcePath: 'users.http'});

    expect(result.sourceKind).toBe('http');
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('api/listusers.mmt');
    expect(result.files[1].path).toBe('tests/users-http.mmt');
    const api = parseYamlStrict(result.files[0].content);
    expect(api.type).toBe('api');
    expect(api.tags).toContain('http');
    expect(api.url).toBe('https://test.mmt.dev/json');
    expect(api.method).toBe('get');
    const test = parseYamlStrict(result.files[1].content);
    expect(test.type).toBe('test');
    expect(test.tags).toContain('http');
    expect(test.import.listusers).toBe('../api/listusers.mmt');
    expect(test.steps[0]).toMatchObject({
      call: 'listusers',
      id: 'iListusers',
      debug: true,
    });
  });

  it('converts multi-request HTTP files into multiple APIs and one test', () => {
    const result = convertToMmt([
      '@host = https://test.mmt.dev',
      '###',
      '# @name ping',
      'GET {{host}}/json',
      '###',
      '# @name echo',
      'POST {{host}}/echo',
      'Content-Type: application/json',
      '',
      '{"ok":true}',
    ].join('\n'), {sourcePath: 'flow.http'});

    expect(result.files.filter(file => file.kind === 'api')).toHaveLength(2);
    expect(result.files.filter(file => file.kind === 'test')).toHaveLength(1);
    const test = parseYamlStrict(result.files.find(file => file.kind === 'test')!.content);
    expect(test.steps).toHaveLength(2);
    expect(test.steps[0]).toMatchObject({call: 'ping', id: 'iPing', debug: true});
    expect(test.steps[1]).toMatchObject({call: 'echo', id: 'iEcho', debug: true});
    expect(test.import.ping).toBe('../api/ping.mmt');
    expect(test.import.echo).toBe('../api/echo.mmt');
  });

  it('prefixes converted Postman step ids to avoid import binding collisions', () => {
    const collection = {
      info: {name: 'Convert Example', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: [
        {
          name: 'Ping',
          request: {
            method: 'GET',
            url: 'https://test.mmt.dev/json',
            header: [{key: 'Accept', value: 'application/json'}],
          },
          response: [{name: 'sample json', code: 200, body: '{"id":1}'}],
        },
      ],
    };

    const result = convertToMmt(JSON.stringify(collection), {sourcePath: 'convert.postman_collection.json'});
    const test = parseYamlStrict(result.files.find(file => file.path === 'tests/collection.mmt')!.content);
    expect(test.import.ping).toBe('../api/ping.mmt');
    expect(test.steps[0].call).toBe('ping');
    expect(test.steps[0].id).toBe('iPing');
    expect(test.steps[0].debug).toBe(true);
  });

  it('prefixes conflicting Postman import aliases and step ids', () => {
    const collection = {
      info: {name: 'Keywords', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: [
        {
          name: 'Call',
          request: {
            method: 'GET',
            url: {raw: 'https://test.mmt.dev/json'},
          },
        },
      ],
    };

    const result = convertToMmt(JSON.stringify(collection), {sourcePath: 'keywords.postman_collection.json'});
    const test = parseYamlStrict(result.files.find(file => file.path === 'tests/collection.mmt')!.content);
    expect(test.import.call).toBe('../api/call.mmt');
    expect(test.steps[0].call).toBe('call');
    expect(test.steps[0].id).toBe('iCall');
  });

  it('converts Bruno request files into API and test files', () => {
    const bruno = `meta {
  name: Create user
}
post {
  url: https://test.mmt.dev/echo
}
headers {
  Content-Type: application/json
}
body:json {
  {"name":"Ada"}
}
tests {
  expect(res.status).to.equal(201);
}`;

    const result = convertToMmt(bruno, {sourcePath: 'create-user.bru'});
    expect(result.sourceKind).toBe('bruno');
    expect(result.files.map(file => file.path).sort()).toEqual([
      'api/create-user.mmt',
      'tests/create-user.mmt',
    ]);

    const api = parseYamlStrict(result.files.find(file => file.path === 'api/create-user.mmt')!.content);
    expect(api.type).toBe('api');
    expect(api.tags).toContain('bruno');
    expect(api.url).toBe('https://test.mmt.dev/echo');
    expect(api.method).toBe('post');

    const test = parseYamlStrict(result.files.find(file => file.path === 'tests/create-user.mmt')!.content);
    expect(test.type).toBe('test');
    expect(test.tags).toContain('bruno');
    expect(test.import.createUser).toBe('../api/create-user.mmt');
    expect(test.steps[0].call).toBe('createUser');
    expect(test.steps[0].id).toBe('iCreateUser');
    expect(test.steps[0].debug).toBe(true);
    expect(test.steps[0].expect.status).toBe('== 201');
  });

  it('returns no spec APIs for empty or unknown files', () => {
    expect(listSpecApis('{}', 'notes.json')).toEqual([]);
    expect(listSpecApis('', 'empty.yaml')).toEqual([]);
    expect(listSpecApis('not-a-spec', 'readme.txt')).toEqual([]);
  });

  it('lists HTTP and Bruno files as spec APIs', () => {
    const httpApis = listSpecApis([
      '###',
      '# @name ping',
      'GET https://test.mmt.dev/json',
      '###',
      '# @name echo',
      'POST https://test.mmt.dev/echo',
    ].join('\n'), 'flow.http');
    expect(httpApis.map(item => item.title)).toEqual(['ping', 'echo']);
    expect(httpApis.every(item => item.examples.length === 0)).toBe(true);

    const titledHttp = listSpecApis([
      '### Login',
      'POST https://test.mmt.dev/echo',
      '',
      '### List books',
      'GET https://test.mmt.dev/json',
      '',
      '### Delete user',
      'DELETE https://test.mmt.dev/status/200',
    ].join('\n'), 'library.http');
    expect(titledHttp.map(item => item.title)).toEqual(['Login', 'List books', 'Delete user']);
    expect(titledHttp.map(item => item.method)).toEqual(['post', 'get', 'delete']);

    const brunoApis = listSpecApis([
      'meta {',
      '  name: Get user',
      '}',
      'get {',
      '  url: https://test.mmt.dev/users/1',
      '}',
    ].join('\n'), 'get-user.bru');
    expect(brunoApis).toHaveLength(1);
    expect(brunoApis[0].title).toBe('Get user');
    expect(brunoApis[0].method).toBe('get');
  });

  it('lists every Bruno collection request as a spec API', () => {
    const apis = listSpecApisFromFiles([
      {
        path: '/lib/collection.bru',
        content: 'meta {\n  name: Library\n}\n',
      },
      {
        path: '/lib/checkout.bru',
        content: 'meta {\n  name: Checkout\n  seq: 2\n}\npost {\n  url: https://test.mmt.dev/echo\n}\n',
      },
      {
        path: '/lib/health.bru',
        content: 'meta {\n  name: Health\n  seq: 1\n}\nget {\n  url: https://test.mmt.dev/status/200\n}\n',
      },
    ]);
    expect(apis.map(item => item.title)).toEqual(['Health', 'Checkout']);
    expect(apis.map(item => item.method)).toEqual(['get', 'post']);
    expect(apis[0].id).toBe('0:Health');
    expect(apis[1].id).toBe('1:Checkout');
  });

  it('lists OpenAPI named request examples as selector children', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'Pets', version: '1.0.0'},
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
                    dog: {summary: 'Dog', description: 'A dog', value: {name: 'Rex'}},
                  },
                },
              },
            },
          },
        },
      },
    };
    const apis = listSpecApis(JSON.stringify(spec), 'pets.openapi.json');
    expect(apis).toHaveLength(1);
    expect(apis[0].examples.map(example => example.title)).toEqual(['Cat', 'Dog']);
    expect(apis[0].examples[0].exampleIndex).toBe(0);
    expect(apis[0].api.body).toBe('<<i:body>>');
    expect(apis[0].api.inputs?.body).toContain('Default');
    expect(apis[0].api.examples?.[0].inputs?.body).toContain('Whiskers');
    expect(apis[0].api.examples?.[1].inputs?.body).toContain('Rex');

    const cat = findSpecApiSelection(apis, apis[0].examples[0].id);
    expect(cat?.item.id).toBe(apis[0].id);
    expect(cat?.exampleIndex).toBe(0);
    expect(findSpecApiSelection(apis, apis[0].id)?.exampleIndex).toBe(-1);
    expect(findSpecApiSelection(apis, 'missing')?.item.id).toBe(apis[0].id);
    expect(findSpecApiSelection([], 'x')).toBeUndefined();
  });

  it('lists Postman saved responses as selector examples', () => {
    const collection = {
      info: {name: 'Users', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: [
        {
          name: 'Create user',
          request: {
            method: 'POST',
            header: [{key: 'Content-Type', value: 'application/json'}],
            url: {raw: 'https://test.mmt.dev/users'},
            body: {mode: 'raw', raw: '{"name":"Ada"}'},
          },
          response: [
            {
              name: 'Ada',
              originalRequest: {
                method: 'POST',
                url: {raw: 'https://test.mmt.dev/users'},
                body: {mode: 'raw', raw: '{"name":"Ada"}'},
              },
              code: 201,
              body: '{"id":"u1"}',
            },
            {
              name: 'Grace',
              originalRequest: {
                method: 'POST',
                url: {raw: 'https://test.mmt.dev/users'},
                body: {mode: 'raw', raw: '{"name":"Grace"}'},
              },
              code: 201,
              body: '{"id":"u2"}',
            },
          ],
        },
      ],
    };
    const apis = listSpecApis(JSON.stringify(collection), 'users.postman_collection.json');
    expect(apis).toHaveLength(1);
    expect(apis[0].examples.map(example => example.title)).toEqual(['Ada', 'Grace']);
    expect(apis[0].api.examples?.[1].inputs?.body).toContain('Grace');
  });

  it('converts OpenAPI named examples into API example YAML', () => {
    const spec = {
      openapi: '3.0.0',
      info: {title: 'Pets', version: '1.0.0'},
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
                  },
                },
              },
            },
          },
        },
      },
    };
    const result = convertToMmt(JSON.stringify(spec), {sourcePath: 'pets.openapi.json'});
    expect(result.files).toHaveLength(1);
    const api = parseYamlStrict(result.files[0].content);
    expect(api.body).toBe('<<i:body>>');
    expect(api.inputs.body).toContain('Default');
    expect(api.examples).toHaveLength(1);
    expect(api.examples[0].name).toBe('Cat');
    expect(api.examples[0].inputs.body).toContain('Whiskers');
  });

  it('converts Postman saved examples into API example YAML', () => {
    const collection = {
      info: {name: 'Users', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
      item: [
        {
          name: 'Create user',
          request: {
            method: 'POST',
            header: [{key: 'Content-Type', value: 'application/json'}],
            url: {raw: 'https://test.mmt.dev/users'},
            body: {mode: 'raw', raw: '{"name":"Ada"}'},
          },
          response: [
            {
              name: 'Grace',
              originalRequest: {
                method: 'POST',
                header: [{key: 'Content-Type', value: 'application/json'}],
                url: {raw: 'https://test.mmt.dev/users'},
                body: {mode: 'raw', raw: '{"name":"Grace"}'},
              },
              code: 201,
              body: '{"id":"u2"}',
            },
          ],
        },
      ],
    };
    const result = convertToMmt(JSON.stringify(collection), {sourcePath: 'users.postman_collection.json'});
    const api = parseYamlStrict(result.files.find(file => file.path === 'api/create-user.mmt')!.content);
    expect(api.inputs.body).toContain('Ada');
    expect(api.examples[0].name).toBe('Grace');
    expect(api.examples[0].inputs.body).toContain('Grace');
  });

  it('converts Swagger 2 specs and warns when OpenAPI has no operations', () => {
    const swagger = {
      swagger: '2.0',
      info: {title: 'Legacy', version: '1.0.0'},
      host: 'test.mmt.dev',
      paths: {
        '/health': {
          get: {summary: 'Health'},
        },
      },
    };
    const result = convertToMmt(JSON.stringify(swagger), {sourcePath: 'legacy.swagger.json'});
    expect(result.sourceKind).toBe('openapi');
    expect(result.files).toHaveLength(1);
    expect(parseYamlStrict(result.files[0].content).title).toBe('Health');

    const empty = convertToMmt(JSON.stringify({openapi: '3.0.0', info: {title: 'Empty'}, paths: {}}), {sourcePath: 'empty.openapi.json'});
    expect(empty.files).toEqual([]);
    expect(empty.warnings[0]).toMatch(/No OpenAPI operations/);
  });
});
