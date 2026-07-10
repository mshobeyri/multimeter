import {convertToMmt, detectImportSource} from './importConvertor';
import {parseYamlStrict} from './markupConvertor';

describe('importConvertor', () => {
  it('detects supported import sources', () => {
    expect(detectImportSource(JSON.stringify({info: {name: 'Collection'}, item: []}), 'collection.json')).toBe('postman');
    expect(detectImportSource('openapi: 3.0.0\npaths: {}\n', 'openapi.yaml')).toBe('openapi');
    expect(detectImportSource('<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>', 'service.wsdl')).toBe('wsdl');
    expect(detectImportSource('GET https://example.com', 'request.http')).toBe('http');
    expect(detectImportSource('meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}', 'get-user.bru')).toBe('bruno');
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
});
