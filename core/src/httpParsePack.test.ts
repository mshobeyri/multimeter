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
      report: 'all',
      headers: {'Content-Type': 'application/json'},
      body: {user: 'jane', trace: 'r:uuid'},
    });
    expect(test.steps?.[1]).toMatchObject({
      http: 'https://api.example.com/me',
      id: 'profile',
      report: 'all',
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

  it('parses a full login and user CRUD HTTP flow', () => {
    const test = httpToTest(`@baseUrl = https://api.example.com
@username = test_user
@password = 1234

########################################
### 1. LOGIN (capture token)
########################################
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "username": "{{username}}",
  "password": "{{password}}"
}

> {%
  client.test("Login successful", function () {
    client.assert(response.status === 200);
  });

  client.test("Token exists", function () {
    client.assert(response.body.token !== undefined);
  });

  client.global.set("authToken", response.body.token);
%}


########################################
### 2. CREATE USER (POST)
########################################
POST {{baseUrl}}/users
Content-Type: application/json
Authorization: Bearer {{authToken}}

{
  "name": "Ali",
  "email": "ali@example.com"
}

> {%
  client.test("User created", function () {
    client.assert(response.status === 201);
  });

  client.test("Name matches input", function () {
    client.assert(response.body.name === "Ali");
  });

  client.global.set("userId", response.body.id);
%}


########################################
### 3. GET USER (GET + validation)
########################################
GET {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{authToken}}

> {%
  client.test("User fetched", function () {
    client.assert(response.status === 200);
  });

  client.test("Correct ID returned", function () {
    client.assert(response.body.id === client.global.get("userId"));
  });
%}


########################################
### 4. UPDATE USER (PATCH)
########################################
PATCH {{baseUrl}}/users/{{userId}}
Content-Type: application/json
Authorization: Bearer {{authToken}}

{
  "name": "Ali Updated"
}

> {%
  client.test("Update success", function () {
    client.assert(response.status === 200);
  });

  client.test("Name updated", function () {
    client.assert(response.body.name === "Ali Updated");
  });
%}


########################################
### 5. DELETE USER
########################################
DELETE {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{authToken}}

> {%
  client.test("Deleted successfully", function () {
    client.assert(response.status === 204 || response.status === 200);
  });
%}
`);

    expect(test.steps).toHaveLength(7);
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://api.example.com/auth/login',
      id: 'request_1',
      title: '1. LOGIN (capture token)',
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: {username: 'test_user', password: '1234'},
      expect: {status: '== 200', 'body.token': '!= undefined'},
    });
    expect(test.steps?.[1]).toEqual({setenv: {authToken: '${request_1.body.token}'}});
    expect(test.steps?.[2]).toMatchObject({
      http: 'https://api.example.com/users',
      id: 'request_2',
      title: '2. CREATE USER (POST)',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer <<e:authToken>>',
      },
      expect: {status: '== 201', 'body.name': '== Ali'},
    });
    expect(test.steps?.[3]).toEqual({setenv: {userId: '${request_2.body.id}'}});
    expect(test.steps?.[4]).toMatchObject({
      http: 'https://api.example.com/users/<<e:userId>>',
      method: 'get',
      headers: {Authorization: 'Bearer <<e:authToken>>'},
      expect: {status: '== 200', 'body.id': '== <<e:userId>>'},
    });
    expect(test.steps?.[5]).toMatchObject({
      http: 'https://api.example.com/users/<<e:userId>>',
      method: 'patch',
      body: {name: 'Ali Updated'},
      expect: {status: '== 200', 'body.name': '== Ali Updated'},
    });
    expect(test.steps?.[6]).toMatchObject({
      http: 'https://api.example.com/users/<<e:userId>>',
      method: 'delete',
    });
    expect((test.steps?.[6] as any).expect).toBeUndefined();
  });

  it('parses a full JSONPlaceholder post flow', () => {
    const test = httpToTest(`@baseUrl = https://jsonplaceholder.typicode.com
@title = Hello World
@userId = 1

########################################
### 1. CREATE POST
########################################
POST {{baseUrl}}/posts
Content-Type: application/json

{
  "title": "{{title}}",
  "body": "This is a test post",
  "userId": {{userId}}
}

> {%
  client.test("Post created", function () {
    client.assert(response.status === 201);
  });

  client.test("Title matches input", function () {
    client.assert(response.body.title === "Hello World");
  });

  client.global.set("postId", response.body.id);
%}


########################################
### 2. FETCH CREATED POST
########################################
GET {{baseUrl}}/posts/{{postId}}

> {%
  client.test("Post fetched", function () {
    client.assert(response.status === 200);
  });

  client.test("ID matches", function () {
    client.assert(response.body.id === client.global.get("postId"));
  });
%}


########################################
### 3. SEARCH POSTS BY USER
########################################
GET {{baseUrl}}/posts?userId={{userId}}

> {%
  client.test("Has posts", function () {
    client.assert(Array.isArray(response.body));
    client.assert(response.body.length > 0);
  });

  client.test("All belong to user", function () {
    response.body.forEach(p => {
      client.assert(p.userId === {{userId}});
    });
  });
%}


########################################
### 4. DELETE POST
########################################
DELETE {{baseUrl}}/posts/{{postId}}

> {%
  client.test("Delete executed", function () {
    client.assert(response.status === 200 || response.status === 204);
  });
%}
`);

    expect(test.steps).toHaveLength(5);
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://jsonplaceholder.typicode.com/posts',
      id: 'request_1',
      title: '1. CREATE POST',
      method: 'post',
      body: {
        title: 'Hello World',
        body: 'This is a test post',
        userId: 1,
      },
      expect: {status: '== 201', 'body.title': '== Hello World'},
    });
    expect(test.steps?.[1]).toEqual({setenv: {postId: '${request_1.body.id}'}});
    expect(test.steps?.[2]).toMatchObject({
      http: 'https://jsonplaceholder.typicode.com/posts/<<e:postId>>',
      method: 'get',
      expect: {status: '== 200', 'body.id': '== <<e:postId>>'},
    });
    expect(test.steps?.[3]).toMatchObject({
      http: 'https://jsonplaceholder.typicode.com/posts?userId=1',
      method: 'get',
      expect: {'body.length': '> 0'},
    });
    expect(test.steps?.[4]).toMatchObject({
      http: 'https://jsonplaceholder.typicode.com/posts/<<e:postId>>',
      method: 'delete',
    });
    expect((test.steps?.[4] as any).expect).toBeUndefined();
  });
});
