import {detectDocType} from './runCommon';
import {generateTestJs} from './runTest';
import {httpToTest, isHttpFilePath, parseHttpDocument, testToHttp, validateHttpDocument} from './httpParsePack';

describe('httpParsePack', () => {
  it('detects .http and .https files as test documents', () => {
    expect(isHttpFilePath('/tmp/flow.http')).toBe(true);
    expect(isHttpFilePath('/tmp/flow.https')).toBe(true);
    expect(detectDocType('/tmp/flow.http', 'GET https://example.com')).toBe('test');
  });

  it('parses VS Code REST style variables and request chaining', () => {
    const test = httpToTest(`@host = https://api.example.com
@user = jane

###
# @name login
POST {{host}}/login
Content-Type: application/json

{"user":"{{user}}","trace":"{{$guid}}"}

###
# @name profile
GET {{host}}/me
Authorization: Bearer {{login.response.body.$.token}}
`);

    expect(test.steps).toHaveLength(2);
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://api.example.com/login',
      id: 'login',
      method: 'post',
      format: 'json',
      headers: {'Content-Type': 'application/json'},
      body: {user: 'jane', trace: 'r:uuid'},
    });
    expect(test.steps?.[1]).toMatchObject({
      http: 'https://api.example.com/me',
      id: 'profile',
      headers: {Authorization: 'Bearer ${login.body.token}'},
    });
  });

  it('parses JetBrains style metadata and response assertions', () => {
    const test = httpToTest(`### Create user
// @name createUser
POST https://api.example.com/users HTTP/2
Content-Type: application/json

{
  "name": "Ada"
}

> {%
  client.test("status", function() {
    client.assert(response.status === 201, "created");
  });
%}
`);

    expect(test.steps?.[0]).toMatchObject({
      id: 'createUser',
      title: 'Create user',
      http: 'https://api.example.com/users',
      method: 'post',
      body: {name: 'Ada'},
      expect: {status: '== 201'},
    });
  });

  it('maps all supported response handler assertions', () => {
    const test = httpToTest(`@baseUrl = https://jsonplaceholder.typicode.com
@name = Mehrdad
@email = mehrdad@example.com

### Create user
POST {{baseUrl}}/users
Content-Type: application/json

{
  "name": "{{name}}",
  "email": "{{email}}"
}

> {%
  client.test("Status is 201 Created", function () {
    client.assert(response.status === 201);
  });

  client.test("Name matches input", function () {
    client.assert(response.body.name === "Mehrdad");
  });

  client.test("Email matches input", function () {
    client.assert(response.body.email === "mehrdad@example.com");
  });

  client.test("Response contains ID", function () {
    client.assert(response.body.id !== undefined);
  });
%}
`);

    expect(test.steps?.[0]).toMatchObject({
      expect: {
        status: '== 201',
        'body.name': '== Mehrdad',
        'body.email': '== mehrdad@example.com',
        'body.id': '!= undefined',
      },
    });
  });

  it('maps response handler global variables to setenv steps', () => {
    const test = httpToTest(`### Login
# @name login
POST https://api.example.com/login
Content-Type: application/json

{"username":"ada"}

> {%
  client.global.set("token", response.body.token);
  client.environment.set("statusCode", response.status);
%}
`);

    expect(test.steps).toHaveLength(2);
    expect(test.steps?.[0]).toMatchObject({id: 'login'});
    expect(test.steps?.[1]).toEqual({
      setenv: {
        token: '${login.body.token}',
        statusCode: '${login.status}',
      },
    });
  });

  it('reports duplicate request names as validation errors', () => {
    const errors = validateHttpDocument(`###
# @name same
GET https://example.com/a

###
# @name same
GET https://example.com/b
`);

    expect(errors.some(error => error.message.includes('Duplicate request name'))).toBe(true);
  });

  it('preserves unsupported scripts and file includes as warnings', () => {
    const doc = parseHttpDocument(`###
POST https://example.com/import
Content-Type: application/json

< ./payload.json

< {%
  request.variables.set("x", "y");
%}
`);

    expect(doc.requests[0].body).toBe('< ./payload.json');
    expect(doc.warnings.map(warning => warning.message).join('\n')).toContain('File body includes');
    expect(doc.warnings.map(warning => warning.message).join('\n')).toContain('Pre-request scripts');
  });

  it('serializes HTTP steps back to .http syntax', () => {
    const http = testToHttp({
      type: 'test',
      title: 'HTTP test',
      description: '',
      tags: [],
      steps: [
        {
          http: 'https://api.example.com/users',
          id: 'createUser',
          title: 'Create user',
          method: 'post',
          format: 'json',
          headers: {'Content-Type': 'application/json'},
          body: {name: 'Ada'},
        },
      ],
    });

    expect(http).toContain('# @name createUser');
    expect(http).toContain('POST https://api.example.com/users');
    expect(http).toContain('Content-Type: application/json');
    expect(http).toContain('"name": "Ada"');
  });

  it('generates test JS from a .http path', async () => {
    const js = await generateTestJs({
      rawText: `###
# @name ping
GET https://api.example.com/ping
`,
      name: 'ping_http',
      inputs: {},
      envVars: {},
      filePath: '/project/ping.http',
      projectRoot: '/project',
      isExternal: false,
      fileLoader: async () => '',
    });

    expect(js).toContain('__http_0');
    expect(js).toContain('https://api.example.com/ping');
  });
});
