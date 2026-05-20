import {detectDocType} from './runCommon';
import {generateTestJs} from './runTest';
import {brunoToTest, isBrunoFilePath, validateBrunoDocument} from './brunoParsePack';

describe('brunoParsePack', () => {
  it('detects .bru files as test documents', () => {
    expect(isBrunoFilePath('/tmp/get_user.bru')).toBe(true);
    expect(detectDocType('/tmp/get_user.bru', 'meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}\n')).toBe('test');
  });

  it('converts a Bruno request into a test flow', () => {
    const test = brunoToTest(`meta {
  name: Create user
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/users
  body: json
  auth: bearer
}

vars:pre-request {
  baseUrl: https://api.example.com
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
      http: 'https://api.example.com/users',
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
  url: https://api.example.com/ping
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
    expect(js).toContain('https://api.example.com/ping');
  });
});
