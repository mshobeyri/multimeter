import {
  convertToPostman,
  translateMmtTokenToPostman,
} from './mmtToPostmanConvertor';

function makeLoader(files: Record<string, string>) {
  return (p: string) => {
    const hit = files[p];
    if (!hit) {
      throw new Error('missing ' + p);
    }
    return hit;
  };
}

describe('translateMmtTokenToPostman', () => {
  it('maps e/i embedded and bare tokens to mustache', () => {
    expect(translateMmtTokenToPostman('<<e:base_url>>/v1')).toBe('{{base_url}}/v1');
    expect(translateMmtTokenToPostman('e:token')).toBe('{{token}}');
    expect(translateMmtTokenToPostman('i:name')).toBe('{{name}}');
  });

  it('maps known r: tokens to Postman dynamics', () => {
    expect(translateMmtTokenToPostman('r:uuid')).toBe('{{$guid}}');
    expect(translateMmtTokenToPostman('<<r:email>>')).toBe('{{$randomEmail}}');
    expect(translateMmtTokenToPostman('r:epoch')).toBe('{{$timestamp}}');
    expect(translateMmtTokenToPostman('r:int')).toBe('{{$randomInt}}');
  });

  it('maps o: and c: tokens to mustache with c: warning', () => {
    expect(translateMmtTokenToPostman('o:body.token')).toBe('{{body.token}}');
    const sink = {warnings: [] as string[]};
    expect(translateMmtTokenToPostman('c:iso_now', sink)).toBe('{{iso_now}}');
    expect(sink.warnings.some((w) => /c:iso_now/.test(w))).toBe(true);
  });

  it('warns on unsupported random tokens', () => {
    const sink = {warnings: [] as string[]};
    expect(translateMmtTokenToPostman('r:not_a_real_token', sink)).toBe('{{not_a_real_token}}');
    expect(sink.warnings.some((w) => /Unsupported random token/.test(w))).toBe(true);
  });

  it('passes through empty and non-string values', () => {
    expect(translateMmtTokenToPostman('')).toBe('');
    expect(translateMmtTokenToPostman(null as unknown as string)).toBe(null);
  });
});

describe('convertToPostman', () => {
  it('exports a simple HTTP api as a collection', async () => {
    const raw = [
      'type: api',
      'title: Ping',
      'url: https://test.mmt.dev/json',
      'method: get',
      'headers:',
      '  Accept: application/json',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/ping.mmt'});
    expect(result.sourceType).toBe('api');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].kind).toBe('collection');
    expect(result.files[0].path).toBe('ping.postman_collection.json');
    const collection = JSON.parse(result.files[0].content);
    expect(collection.info.schema).toContain('v2.1.0');
    expect(collection.item).toHaveLength(1);
    expect(collection.item[0].request.method).toBe('GET');
    expect(collection.item[0].request.url.raw).toContain('test.mmt.dev/json');
    expect(collection.item[0].request.header).toEqual(
        expect.arrayContaining([{key: 'Accept', value: 'application/json', type: 'text'}]));
  });

  it('maps query params and env tokens in the URL', async () => {
    const raw = [
      'type: api',
      'title: Search',
      'url: <<e:base_url>>/search',
      'method: get',
      'query:',
      '  q: hello',
      '  page: "1"',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/search.mmt'});
    const collection = JSON.parse(result.files[0].content);
    const url = collection.item[0].request.url;
    expect(url.raw).toContain('{{base_url}}/search');
    expect(url.query).toEqual(expect.arrayContaining([
      {key: 'q', value: 'hello'},
      {key: 'page', value: '1'},
    ]));
    expect(collection.variable).toEqual(
        expect.arrayContaining([{key: 'base_url', value: ''}]));
  });

  it('exports urlencoded, multipart, and binary body modes', async () => {
    const urlencoded = await convertToPostman([
      'type: api',
      'title: Form',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: urlencoded',
      'body:',
      '  username: i:user',
      '  role: admin',
    ].join('\n'), {sourcePath: '/repo/api/form.mmt'});
    const uBody = JSON.parse(urlencoded.files[0].content).item[0].request.body;
    expect(uBody.mode).toBe('urlencoded');
    expect(uBody.urlencoded).toEqual(expect.arrayContaining([
      {key: 'username', value: '{{user}}'},
      {key: 'role', value: 'admin'},
    ]));

    const multipart = await convertToPostman([
      'type: api',
      'title: Upload',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: multipart',
      'body:',
      '  - name: description',
      '    value: hello',
      '  - name: file',
      '    file: ./assets/sample.txt',
    ].join('\n'), {sourcePath: '/repo/api/upload.mmt'});
    const mBody = JSON.parse(multipart.files[0].content).item[0].request.body;
    expect(mBody.mode).toBe('formdata');
    expect(mBody.formdata).toEqual(expect.arrayContaining([
      {key: 'description', type: 'text', value: 'hello'},
      {key: 'file', type: 'file', src: './assets/sample.txt'},
    ]));
    expect(multipart.warnings.some((w) => /file part/.test(w))).toBe(true);

    const binary = await convertToPostman([
      'type: api',
      'title: Bin',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: binary',
      'body: ./assets/payload.bin',
    ].join('\n'), {sourcePath: '/repo/api/bin.mmt'});
    const bBody = JSON.parse(binary.files[0].content).item[0].request.body;
    expect(bBody.mode).toBe('file');
    expect(bBody.file.src).toBe('./assets/payload.bin');
  });

  it('maps bearer, basic, and api-key auth', async () => {
    const cases: Array<{raw: string; type: string; check: (auth: any) => void}> = [
      {
        raw: [
          'type: api',
          'title: Bearer',
          'url: https://test.mmt.dev/echo',
          'method: get',
          'auth:',
          '  type: bearer',
          '  token: e:token',
        ].join('\n'),
        type: 'bearer',
        check: (auth) => {
          expect(auth.bearer[0].value).toBe('{{token}}');
        },
      },
      {
        raw: [
          'type: api',
          'title: Basic',
          'url: https://test.mmt.dev/echo',
          'method: get',
          'auth:',
          '  type: basic',
          '  username: admin',
          '  password: e:password',
        ].join('\n'),
        type: 'basic',
        check: (auth) => {
          expect(auth.basic.find((e: any) => e.key === 'username').value).toBe('admin');
          expect(auth.basic.find((e: any) => e.key === 'password').value).toBe('{{password}}');
        },
      },
      {
        raw: [
          'type: api',
          'title: ApiKey',
          'url: https://test.mmt.dev/echo',
          'method: get',
          'auth:',
          '  type: api-key',
          '  header: X-API-Key',
          '  value: secret',
        ].join('\n'),
        type: 'apikey',
        check: (auth) => {
          expect(auth.apikey.find((e: any) => e.key === 'key').value).toBe('X-API-Key');
          expect(auth.apikey.find((e: any) => e.key === 'in').value).toBe('header');
          expect(auth.apikey.find((e: any) => e.key === 'value').value).toBe('secret');
        },
      },
    ];
    for (const c of cases) {
      const result = await convertToPostman(c.raw, {sourcePath: '/repo/api/auth.mmt'});
      const auth = JSON.parse(result.files[0].content).item[0].request.auth;
      expect(auth.type).toBe(c.type);
      c.check(auth);
    }
  });

  it('exports oauth2 with a warning', async () => {
    const raw = [
      'type: api',
      'title: OAuth',
      'url: https://test.mmt.dev/echo',
      'method: get',
      'auth:',
      '  type: oauth2',
      '  grant: client_credentials',
      '  token_url: https://auth.example/token',
      '  client_id: cid',
      '  client_secret: csecret',
      '  scope: read',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/oauth.mmt'});
    const auth = JSON.parse(result.files[0].content).item[0].request.auth;
    expect(auth.type).toBe('oauth2');
    expect(result.warnings.some((w) => /OAuth2/i.test(w))).toBe(true);
  });

  it('exports GraphQL as Postman graphql body mode', async () => {
    const raw = [
      'type: api',
      'title: Countries',
      'url: https://countries.example/graphql',
      'protocol: graphql',
      'graphql:',
      '  operation: |',
      '    query { countries { name } }',
      '  variables:',
      '    code: BR',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/gql.mmt'});
    const body = JSON.parse(result.files[0].content).item[0].request.body;
    expect(body.mode).toBe('graphql');
    expect(body.graphql.query).toContain('countries');
    expect(body.graphql.variables).toContain('BR');
  });

  it('skips gRPC APIs with a warning and no collection item', async () => {
    const raw = [
      'type: api',
      'title: Greeter',
      'protocol: grpc',
      'url: localhost:50051',
      'method: /pkg.Service/Method',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/grpc.mmt'});
    expect(result.files).toHaveLength(0);
    expect(result.warnings.some((w) => /gRPC/i.test(w))).toBe(true);
  });

  it('exports env variables as a Postman environment', async () => {
    const raw = [
      'type: env',
      'variables:',
      '  base_url: https://test.mmt.dev',
      '  mode:',
      '    dev: debug',
      '    prod: release',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/multimeter.mmt'});
    expect(result.sourceType).toBe('env');
    expect(result.files).toHaveLength(1);
    const env = JSON.parse(result.files[0].content);
    expect(env._postman_variable_scope).toBe('environment');
    const byKey = Object.fromEntries(env.values.map((v: any) => [v.key, v.value]));
    expect(byKey.base_url).toBe('https://test.mmt.dev');
    expect(byKey.mode).toBe('debug');
  });

  it('exports env presets as separate Postman environments', async () => {
    const raw = [
      'type: env',
      'variables:',
      '  api_url:',
      '    local: https://local.mmt.dev',
      '    staging: https://test.mmt.dev',
      '  mode:',
      '    dev: debug',
      '    prod: release',
      '  path_from_os: $PATH',
      'presets:',
      '  runner:',
      '    dev:',
      '      api_url: local',
      '      mode: dev',
      '    staging:',
      '      api_url: staging',
      '      mode: prod',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/project.mmt'});
    expect(result.sourceType).toBe('env');
    expect(result.files).toHaveLength(2);
    expect(result.files.every((f) => f.kind === 'environment')).toBe(true);
    expect(result.files.map((f) => f.path).sort()).toEqual([
      'project-runner-dev.postman_environment.json',
      'project-runner-staging.postman_environment.json',
    ].sort());
    const staging = JSON.parse(
        result.files.find((f) => f.path.includes('staging'))!.content);
    const byKey = Object.fromEntries(staging.values.map((v: any) => [v.key, v.value]));
    expect(byKey.api_url).toBe('https://test.mmt.dev');
    expect(byKey.mode).toBe('release');
    expect(byKey.path_from_os).toBe('');
    expect(result.warnings.some((w) => /path_from_os/.test(w))).toBe(true);
  });

  it('exports test calls with simple expects and setenv scripts', async () => {
    const files: Record<string, string> = {
      '/repo/api/login.mmt': [
        'type: api',
        'title: Login',
        'url: https://test.mmt.dev/login',
        'method: post',
        'body:',
        '  user: i:user',
        'outputs:',
        '  token: body.token',
        'setenv:',
        '  token: body.token',
      ].join('\n'),
      '/repo/test/login.mmt': [
        'type: test',
        'title: Login flow',
        'import:',
        '  login: ../api/login.mmt',
        'steps:',
        '  - call: login',
        '    inputs:',
        '      user: e:user',
        '    expect:',
        '      status: 200',
        '      body.token: defined',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/test/login.mmt'], {
      sourcePath: '/repo/test/login.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    expect(result.sourceType).toBe('test');
    const collection = JSON.parse(result.files[0].content);
    expect(collection.item).toHaveLength(1);
    const item = collection.item[0];
    expect(item.request.body.raw).toContain('"user"');
    expect(item.request.body.raw).toContain('{{user}}');
    const exec = item.event.find((e: any) => e.listen === 'test').script.exec.join('\n');
    expect(exec).toContain('pm.response.to.have.status(200)');
    expect(exec).toContain('body.token exists');
    expect(exec).toContain('pm.collectionVariables.set("token"');
  });

  it('exports body and header literal expects; skips complex operators', async () => {
    const files: Record<string, string> = {
      '/repo/api/echo.mmt': [
        'type: api',
        'title: Echo',
        'url: https://test.mmt.dev/echo',
        'method: get',
      ].join('\n'),
      '/repo/test/expects.mmt': [
        'type: test',
        'title: Expects',
        'import:',
        '  echo: ../api/echo.mmt',
        'steps:',
        '  - call: echo',
        '    expect:',
        '      status: 200',
        '      body.ok: true',
        '      body.message: hello',
        '      headers.content-type: application/json',
        '      body.items.0.id: 7',
        '      body.count: ">= 1"',
        '      body.items.*.id: defined',
        '      body.token: e:token',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/test/expects.mmt'], {
      sourcePath: '/repo/test/expects.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    const exec = JSON.parse(result.files[0].content)
        .item[0]
        .event.find((e: any) => e.listen === 'test')
        .script.exec.join('\n');
    expect(exec).toContain('pm.response.to.have.status(200)');
    expect(exec).toContain('.to.eql(true)');
    expect(exec).toContain('.to.eql("hello")');
    expect(exec).toContain('pm.response.headers.get("content-type")');
    expect(exec).toContain('json["items"][0]["id"]');
    expect(result.warnings.some((w) => /operator/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /non-simple path|body\.items\.\*/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /runtime token/.test(w))).toBe(true);
    expect(exec).not.toContain('body.count');
    expect(exec).not.toContain('body.items.*.id');
  });

  it('walks nested stages and warns on skipped control-flow steps', async () => {
    const files: Record<string, string> = {
      '/repo/api/ping.mmt': [
        'type: api',
        'title: Ping',
        'url: https://test.mmt.dev/json',
        'method: get',
      ].join('\n'),
      '/repo/test/flow.mmt': [
        'type: test',
        'title: Flow',
        'import:',
        '  ping: ../api/ping.mmt',
        'stages:',
        '  - title: setup',
        '    steps:',
        '      - call: ping',
        '        expect:',
        '          status: 200',
        '      - if: "true"',
        '        steps:',
        '          - call: ping',
        '        else:',
        '          - call: ping',
        '      - for: item in items',
        '        steps:',
        '          - call: ping',
        '      - check:',
        '          status: 200',
        '      - js: "1+1"',
        '      - delay: 10',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/test/flow.mmt'], {
      sourcePath: '/repo/test/flow.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    const collection = JSON.parse(result.files[0].content);
    // setup call + if then + if else + for inner once
    expect(collection.item).toHaveLength(4);
    expect(result.warnings.some((w) => /if step/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /if else-branch/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /for step/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /check step skipped/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /js step skipped/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /delay step skipped/.test(w))).toBe(true);
  });

  it('attaches standalone setenv scripts to the preceding request', async () => {
    const files: Record<string, string> = {
      '/repo/api/ping.mmt': [
        'type: api',
        'title: Ping',
        'url: https://test.mmt.dev/json',
        'method: get',
      ].join('\n'),
      '/repo/test/setenv.mmt': [
        'type: test',
        'title: Setenv after call',
        'import:',
        '  ping: ../api/ping.mmt',
        'steps:',
        '  - call: ping',
        '  - setenv:',
        '      status_code: status',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/test/setenv.mmt'], {
      sourcePath: '/repo/test/setenv.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    const exec = JSON.parse(result.files[0].content)
        .item[0]
        .event.find((e: any) => e.listen === 'test')
        .script.exec.join('\n');
    expect(exec).toContain('pm.collectionVariables.set("status_code"');
    expect(exec).toContain('pm.response.code');
  });

  it('requires fileLoader for test conversion', async () => {
    const raw = [
      'type: test',
      'title: Needs loader',
      'steps:',
      '  - call: ping',
    ].join('\n');
    await expect(convertToPostman(raw, {sourcePath: '/repo/test/x.mmt'}))
        .rejects.toThrow(/fileLoader is required/);
  });

  it('exports websocket api without failing', async () => {
    const raw = [
      'type: api',
      'title: Echo WS',
      'protocol: ws',
      'url: wss://echo.websocket.events',
      'body: hello',
    ].join('\n');
    const result = await convertToPostman(raw, {sourcePath: '/repo/api/echo.mmt'});
    expect(result.files).toHaveLength(1);
    const collection = JSON.parse(result.files[0].content);
    expect(collection.item[0].request.url.raw).toContain('wss://');
    expect(result.warnings.some((w) => /WebSocket/i.test(w))).toBe(true);
  });

  it('exports a suite as folders', async () => {
    const files: Record<string, string> = {
      '/repo/api/ping.mmt': [
        'type: api',
        'title: Ping',
        'url: https://test.mmt.dev/json',
        'method: get',
      ].join('\n'),
      '/repo/test/ping.mmt': [
        'type: test',
        'title: Ping test',
        'import:',
        '  ping: ../api/ping.mmt',
        'steps:',
        '  - call: ping',
        '    expect:',
        '      status: 200',
      ].join('\n'),
      '/repo/suite.mmt': [
        'type: suite',
        'title: Smoke',
        'items:',
        '  - ./test/ping.mmt',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/suite.mmt'], {
      sourcePath: '/repo/suite.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    expect(result.sourceType).toBe('suite');
    const collection = JSON.parse(result.files[0].content);
    expect(collection.info.name).toBe('Smoke');
    expect(collection.item[0].name).toBe('Ping test');
    expect(collection.item[0].item[0].request.method).toBe('GET');
  });

  it('nests child suites as folders and can include direct api items', async () => {
    const files: Record<string, string> = {
      '/repo/api/ping.mmt': [
        'type: api',
        'title: Ping',
        'url: https://test.mmt.dev/json',
        'method: get',
      ].join('\n'),
      '/repo/test/ping.mmt': [
        'type: test',
        'title: Ping test',
        'import:',
        '  ping: ../api/ping.mmt',
        'steps:',
        '  - call: ping',
      ].join('\n'),
      '/repo/suites/child.mmt': [
        'type: suite',
        'title: Child',
        'items:',
        '  - ../test/ping.mmt',
      ].join('\n'),
      '/repo/suite.mmt': [
        'type: suite',
        'title: Root',
        'items:',
        '  - ./suites/child.mmt',
        '  - ./api/ping.mmt',
      ].join('\n'),
    };
    const result = await convertToPostman(files['/repo/suite.mmt'], {
      sourcePath: '/repo/suite.mmt',
      projectRoot: '/repo',
      fileLoader: makeLoader(files),
    });
    const collection = JSON.parse(result.files[0].content);
    expect(collection.item.map((i: any) => i.name)).toEqual(
        expect.arrayContaining(['Child', 'Ping']));
    const child = collection.item.find((i: any) => i.name === 'Child');
    expect(child.item[0].name).toBe('Ping test');
    const directApi = collection.item.find((i: any) => i.name === 'Ping' && i.request);
    expect(directApi.request.method).toBe('GET');
  });

  it('rejects unsupported file types', async () => {
    const raw = ['type: mock', 'title: Fake'].join('\n');
    await expect(convertToPostman(raw, {sourcePath: '/repo/mock.mmt'}))
        .rejects.toThrow(/Unsupported .mmt type/);
  });
});
