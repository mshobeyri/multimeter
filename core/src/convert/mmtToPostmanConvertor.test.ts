import {
  convertToPostman,
  translateMmtTokenToPostman,
} from './mmtToPostmanConvertor';

describe('translateMmtTokenToPostman', () => {
  it('maps e/i embedded and bare tokens to mustache', () => {
    expect(translateMmtTokenToPostman('<<e:base_url>>/v1')).toBe('{{base_url}}/v1');
    expect(translateMmtTokenToPostman('e:token')).toBe('{{token}}');
    expect(translateMmtTokenToPostman('i:name')).toBe('{{name}}');
  });

  it('maps known r: tokens to Postman dynamics', () => {
    expect(translateMmtTokenToPostman('r:uuid')).toBe('{{$guid}}');
    expect(translateMmtTokenToPostman('<<r:email>>')).toBe('{{$randomEmail}}');
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
      fileLoader: (p) => {
        const hit = files[p];
        if (!hit) {
          throw new Error('missing ' + p);
        }
        return hit;
      },
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
      fileLoader: (p) => {
        const hit = files[p];
        if (!hit) {
          throw new Error('missing ' + p);
        }
        return hit;
      },
    });
    expect(result.sourceType).toBe('suite');
    const collection = JSON.parse(result.files[0].content);
    expect(collection.info.name).toBe('Smoke');
    expect(collection.item[0].name).toBe('Ping test');
    expect(collection.item[0].item[0].request.method).toBe('GET');
  });
});
