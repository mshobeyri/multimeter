import {detectDocType} from './runCommon';
import {generateTestJs} from './runTest';
import {brunoToAPI, brunoToTest, isBrunoFilePath, validateBrunoDocument} from './brunoParsePack';

describe('brunoParsePack', () => {
  it('detects .bru and .bruno files as test documents', () => {
    expect(isBrunoFilePath('/tmp/get_user.bru')).toBe(true);
    expect(isBrunoFilePath('/tmp/get_user.bruno')).toBe(true);
    expect(detectDocType('/tmp/get_user.bru', 'meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}\n')).toBe('test');
    expect(detectDocType('/tmp/get_user.bruno', 'meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}\n')).toBe('test');
  });

  it('adds debug to request steps used for Bruno runtime conversion', () => {
    const test = brunoToTest(`meta {
  name: Ping
}

get {
  url: https://test.mmt.dev/json
}
`, 'ping.bru');
    expect(test.steps?.[0]).toMatchObject({
      method: 'get',
      debug: true,
    });
  });

  it('converts a Bruno request into an API definition', () => {
    const api = brunoToAPI(`meta {
  name: Create user
}

post {
  url: {{baseUrl}}/echo
  body: json
  auth: bearer
}

vars:pre-request {
  baseUrl: https://test.mmt.dev
}

headers {
  Content-Type: application/json
}

auth:bearer {
  token: {{token}}
}

body:json {
  {
    "name": "Ada"
  }
}
`, 'create-user.bru');

    expect(api).toMatchObject({
      type: 'api',
      title: 'Create user',
      tags: ['bruno'],
      url: 'https://test.mmt.dev/echo',
      method: 'post',
      format: 'json',
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        type: 'bearer',
        token: '<<e:token>>',
      },
      body: {name: 'Ada'},
    });
  });

  it('converts a Bruno request into a test flow', () => {
    const test = brunoToTest(`meta {
  name: Create user
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/echo
  body: json
  auth: bearer
}

vars:pre-request {
  baseUrl: https://test.mmt.dev
}

headers {
  Content-Type: application/json
}

params:query {
  trace: {{$uuid}}
}

auth:bearer {
  token: {{token}}
}

body:json {
  {
    "name": "Ada"
  }
}

tests {
  expect(res.status).to.equal(201);
  expect(res.body.name).to.equal("Ada");
}
`);

    expect(test).toMatchObject({
      type: 'test',
      title: 'Create user',
      tags: ['bruno'],
    });
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://test.mmt.dev/echo',
      id: 'Create_user',
      method: 'post',
      format: 'json',
      query: {trace: 'r:uuid'},
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer <<e:token>>',
      },
      body: {name: 'Ada'},
      expect: {
        status: '== 201',
        'body.name': '== Ada',
      },
    });
  });

  it('prefixes conflicting Bruno step ids', () => {
    const test = brunoToTest(`meta {
  name: call
}

get {
  url: https://test.mmt.dev/json
}
`);

    expect(test.steps?.[0]).toMatchObject({
      id: 'iCall',
      method: 'get',
    });
  });

  it('reports missing method and url validation errors', () => {
    const errors = validateBrunoDocument('meta {\n  name: Broken\n}\n');
    expect(errors.some(error => error.message.includes('No Bruno HTTP method block'))).toBe(true);
  });

  it('generates test JS from a .bru path', async () => {
    const js = await generateTestJs({
      rawText: `meta {
  name: Ping
}

get {
  url: https://test.mmt.dev/json
  body: none
  auth: none
}
`,
      name: 'ping_bru',
      inputs: {},
      envVars: {},
      filePath: '/project/ping.bru',
      projectRoot: '/project',
      isExternal: false,
      fileLoader: async () => '',
    });

    expect(js).toContain('__http_0');
    expect(js).toContain('https://test.mmt.dev/json');
  });
});
