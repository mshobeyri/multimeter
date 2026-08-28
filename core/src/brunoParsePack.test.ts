import {detectDocType} from './runCommon';
import {generateTestJs, isSerializedMmtTest} from './runTest';
import {testToYaml} from './testParsePack';
import {
  brunoToAPI,
  brunoToTest,
  brunoToTestStrict,
  isBrunoFilePath,
  parseBrunoDocument,
  validateBrunoDocument,
} from './brunoParsePack';

const SOURCE_BRU = `meta {
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
`;

describe('brunoParsePack', () => {
  it('detects .bru and .bruno files as test documents', () => {
    expect(isBrunoFilePath('/tmp/get_user.bru')).toBe(true);
    expect(isBrunoFilePath('/tmp/get_user.bruno')).toBe(true);
    expect(detectDocType('/tmp/get_user.bru', 'meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}\n')).toBe('test');
    expect(detectDocType('/tmp/get_user.bruno', 'meta {\n  name: Get user\n}\nget {\n  url: https://example.com\n}\n')).toBe('test');
  });

  it('parses the convert-to-mmt example source.bru', () => {
    const parsed = parseBrunoDocument(SOURCE_BRU);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.blocks.map(block => block.name)).toEqual(['meta', 'post', 'headers', 'body']);
    expect(parsed.blocks.find(block => block.name === 'body')?.qualifier).toBe('json');
    const test = brunoToTestStrict(SOURCE_BRU, 'source.bru');
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://test.mmt.dev/echo',
      method: 'post',
      format: 'json',
      body: {name: 'Ada'},
    });
  });

  it('parses blocks after comments, BOM, and CRLF', () => {
    const parsed = parseBrunoDocument(
        '\uFEFF# collection note\r\n// docs\r\nmeta {\r\n  name: Ping\r\n}\r\nget {\r\n  url: https://example.com\r\n}\r\n');
    expect(parsed.warnings).toEqual([]);
    expect(parsed.blocks.map(block => block.name)).toEqual(['meta', 'get']);
  });

  it('parses Bru-lang http: { method, url } and headers: { }', () => {
    const parsed = parseBrunoDocument(`http: {
  method: POST
  url: https://test.mmt.dev/echo
}

headers: {
  Content-Type: application/json
}

body:json {
  {"ok": true}
}
`);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.blocks.map(block => ({name: block.name, qualifier: block.qualifier}))).toEqual([
      {name: 'http', qualifier: undefined},
      {name: 'headers', qualifier: undefined},
      {name: 'body', qualifier: 'json'},
    ]);
    const test = brunoToTestStrict(`http: {
  method: POST
  url: https://test.mmt.dev/echo
}
`, 'source.bru');
    expect(test.steps?.[0]).toMatchObject({
      http: 'https://test.mmt.dev/echo',
      method: 'post',
    });
  });

  it('parses custom http { method } blocks', () => {
    const test = brunoToTest(`http {
  method: PATCH
  url: https://test.mmt.dev/echo
}
`, 'patch.bru');
    expect(test.steps?.[0]).toMatchObject({
      method: 'patch',
      http: 'https://test.mmt.dev/echo',
    });
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

  it('converts Bruno form-urlencoded bodies', () => {
    const api = brunoToAPI(`meta {
  name: Update Profile Form
}

put {
  url: {{baseUrl}}/echo
  body: form-urlencoded
}

vars:pre-request {
  baseUrl: https://test.mmt.dev
}

body:form-urlencoded {
  displayName: Grace Hopper
  timezone: UTC
  newsletter: true
}
`, 'update_profile_form.bru');

    expect(api).toMatchObject({
      type: 'api',
      method: 'put',
      format: 'urlencoded',
      body: {
        displayName: 'Grace Hopper',
        timezone: 'UTC',
        newsletter: 'true',
      },
    });
  });

  it('reports missing method and url validation errors', () => {
    const errors = validateBrunoDocument('meta {\n  name: Broken\n}\n');
    expect(errors.some(error => error.message.includes('No Bruno HTTP method block'))).toBe(true);
  });

  it('does not treat serialized MMT YAML as native Bruno source', () => {
    const yaml = testToYaml(brunoToTest(SOURCE_BRU, 'source.bru'));
    expect(isSerializedMmtTest(yaml)).toBe(true);
    expect(isSerializedMmtTest(SOURCE_BRU)).toBe(false);
    expect(validateBrunoDocument(yaml).some(error => error.message.includes('No Bruno blocks found'))).toBe(true);
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

  it('generates test JS when the panel sends YAML for a .bru path', async () => {
    const yaml = testToYaml(brunoToTest(SOURCE_BRU, 'source.bru'));
    const js = await generateTestJs({
      rawText: yaml,
      name: 'source_bru',
      inputs: {},
      envVars: {},
      filePath: '/project/source.bru',
      projectRoot: '/project',
      isExternal: false,
      fileLoader: async () => '',
    });

    expect(js).toContain('__http_0');
    expect(js).toContain('https://test.mmt.dev/echo');
    expect(js).toContain('Ada');
  });
});
