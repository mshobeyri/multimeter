import {
  buildApiTesterSendRequest,
  mintApiTesterResolvedRequest,
} from '../apiBodyEdit';
import {
  clearTokenFieldPreviewRandomCache,
  findBodyTokenHoverSpans,
  findDisplayTokenCharRanges,
  projectTokenFieldPreview,
  TOKEN_FIELD_PREVIEW_BODY_SCOPE,
  tokenFieldPreviewScope,
  rewriteAllLeavesToDisplayText,
  stringifyJsonWithRuntimeTokens,
} from '../bodyRuntimeTokens';
import {apiToJSfunc} from '../JSer';
import {generateApiJs} from '../runApi';
import {APIData} from '../APIData';

const apiWithRuntimeTokens: APIData = {
  type: 'api',
  url: 'https://example.com/{{r:uuid}}',
  method: 'post',
  format: 'json',
  headers: {
    'X-Id': 'r:uuid',
    'X-Time': 'c:time',
  },
  body: {
    id: 'r:uuid',
    stamp: 'c:time',
  },
} as APIData;

describe('apiBodyEdit Send snapshot', () => {
  beforeEach(() => {
    clearTokenFieldPreviewRandomCache();
  });

  it('remints a new r:uuid on every Send snapshot', () => {
    const first = mintApiTesterResolvedRequest(apiWithRuntimeTokens);
    const second = mintApiTesterResolvedRequest(apiWithRuntimeTokens);

    expect(typeof first.headers?.['X-Id']).toBe('string');
    expect(typeof second.headers?.['X-Id']).toBe('string');
    expect(first.headers?.['X-Id']).not.toBe(second.headers?.['X-Id']);
    expect(first.body && (first.body as any).id)
        .not.toBe(second.body && (second.body as any).id);
  });

  it('seeds telescope preview to the reminted c:time value', () => {
    const resolved = mintApiTesterResolvedRequest(apiWithRuntimeTokens);
    const headerTime = String(resolved.headers?.['X-Time'] ?? '');
    const bodyStamp = String((resolved.body as any)?.stamp ?? '');

    expect(projectTokenFieldPreview(
               '{{c:time}}', {env: {}, inputs: {}},
               tokenFieldPreviewScope('headers', 'X-Time')).text)
        .toBe(headerTime);
    expect(headerTime.length).toBeGreaterThan(0);
    expect(bodyStamp.length).toBeGreaterThan(0);
  });

  it('buildApiTesterSendRequest returns wire-shaped body without packing source api', () => {
    const sourceBody = apiWithRuntimeTokens.body;
    const {resolved, sendRequest} = buildApiTesterSendRequest(apiWithRuntimeTokens);

    expect(sourceBody).toEqual({id: 'r:uuid', stamp: 'c:time'});
    expect(typeof sendRequest.body === 'string' || sendRequest.body != null).toBe(true);
    expect(resolved.body).toEqual(expect.objectContaining({
      id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    }));
  });

  it('seeds body document cache so tokens-mode hover tips match the Send snapshot', () => {
    const api = {
      type: 'api',
      url: 'https://example.com/echo',
      method: 'post',
      format: 'json',
      body: {
        rw: 'r:uuid',
        rws: 'r:uuid',
        stamp: 'c:time',
      },
    } as APIData;
    const resolved = mintApiTesterResolvedRequest(api);
    const rw = String((resolved.body as any).rw);
    const rws = String((resolved.body as any).rws);
    const stamp = String((resolved.body as any).stamp);
    expect(rw).not.toBe(rws);

    const display = stringifyJsonWithRuntimeTokens(
        rewriteAllLeavesToDisplayText(api.body), true);
    const cacheTips = findDisplayTokenCharRanges(
        display, {inputs: {}, env: {}}, TOKEN_FIELD_PREVIEW_BODY_SCOPE)
        .filter((s) => display.slice(s.start, s.end) === '{{r:uuid}}')
        .map((s) => s.tooltip);
    expect(cacheTips).toEqual([rw, rws]);

    const hover = findBodyTokenHoverSpans(display, {
      tokenSource: api.body,
      resolvedBody: resolved.body,
    });
    expect(hover.some(
               (s) => display.slice(s.start, s.end) === '{{r:uuid}}' &&
                   s.tooltip === rw))
        .toBe(true);
    expect(hover.some(
               (s) => display.slice(s.start, s.end) === '{{r:uuid}}' &&
                   s.tooltip === rws))
        .toBe(true);
    expect(hover.some(
               (s) => display.slice(s.start, s.end) === '{{c:time}}' &&
                   s.tooltip === stamp))
        .toBe(true);
  });

  it('seeds url and header field cache to the reminted Send values', () => {
    // Avoid body leaves that share the bare `r:uuid` cache key with headers.
    const api = {
      type: 'api',
      url: 'https://example.com/{{r:uuid}}',
      method: 'get',
      headers: {'X-Id': 'r:uuid', 'X-Stamp': 'c:time'},
    } as APIData;
    const resolved = mintApiTesterResolvedRequest(api);
    const urlId = String(resolved.url).replace(/^https:\/\/example\.com\//, '');
    const headerId = String(resolved.headers?.['X-Id'] ?? '');
    const stamp = String(resolved.headers?.['X-Stamp'] ?? '');
    expect(urlId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(projectTokenFieldPreview('https://example.com/{{r:uuid}}', {
             env: {},
             inputs: {},
           }).text)
        .toBe(`https://example.com/${urlId}`);
    expect(projectTokenFieldPreview(
               '{{r:uuid}}', {env: {}, inputs: {}},
               tokenFieldPreviewScope('headers', 'X-Id')).text)
        .toBe(headerId);
    expect(projectTokenFieldPreview(
               '{{c:time}}', {env: {}, inputs: {}},
               tokenFieldPreviewScope('headers', 'X-Stamp')).text)
        .toBe(stamp);
  });
});

describe('API send_ requestOverride', () => {
  it('generated API JS uses __mmt_requestOverride when present', async () => {
    const js = await generateApiJs({
      api: {
        type: 'api',
        title: 'override',
        url: 'https://example.com/echo',
        method: 'post',
        format: 'json',
        body: {id: 'r:uuid'},
      } as any,
      name: 'override_api',
      envVars: {},
      inputs: {},
      fileLoader: async () => '',
    });

    expect(js).toContain('__mmt_requestOverride');
    expect(js).toContain('__mmt_originalSend(__req)');
    // The wrapper sends what the API function built from the override
    // (binary load / multipart / auth); it must not swap the override back in.
    expect(js).toContain('const __req = req || {};');
    expect(js).not.toMatch(/__mmt_requestOverride\) \? __mmt_requestOverride/);
    // Skip evaluating remint expressions when override is set.
    expect(js).toMatch(
        /if \(typeof __mmt_requestOverride !== 'undefined' && __mmt_requestOverride\) \{\s*\n\s*req_ = __mmt_requestOverride;/,
    );
  });

  it('oauth2 token fetch uses __mmt_originalSend not send_', async () => {
    const js = await apiToJSfunc({
      api: {
        type: 'api',
        url: 'https://example.com/resource',
        method: 'get',
        auth: {
          type: 'oauth2',
          token_url: 'https://auth.example.com/token',
          client_id: 'id',
          client_secret: 'secret',
        },
      } as any,
      name: 'oauth_api',
      inputs: {},
      envVars: {},
    });
    expect(js).toContain('await __mmt_originalSend({');
    expect(js).not.toContain('_tokenResp = await send_');
  });

  it('i: and e: appear as concrete values on the Send snapshot', () => {
    const api = {
      type: 'api',
      url: 'https://example.com/{{i:user}}',
      method: 'post',
      format: 'json',
      headers: {
        'X-User': 'i:user',
        'X-Host': 'e:host',
      },
      body: {
        user: 'i:user',
        host: 'e:host',
      },
    } as APIData;
    const resolved = mintApiTesterResolvedRequest(
        api, {user: 'alice'}, {host: 'api.local'});
    expect(resolved.url).toBe('https://example.com/alice');
    expect(resolved.headers?.['X-User']).toBe('alice');
    expect(resolved.headers?.['X-Host']).toBe('api.local');
    expect(resolved.body).toEqual({user: 'alice', host: 'api.local'});
    expect(JSON.stringify(resolved)).not.toMatch(/\bi:user\b|\be:host\b/);
  });

  it('with override set, remint helpers are not evaluated for JSON Send', async () => {
    const funcSrc = await apiToJSfunc({
      api: {
        type: 'api',
        url: 'https://example.com/{{r:uuid}}',
        method: 'post',
        format: 'json',
        headers: {'X-Id': 'r:uuid'},
        body: {id: 'r:uuid', stamp: 'c:time'},
      } as any,
      name: 'json_send',
      inputs: {},
      envVars: {},
    });
    expect(funcSrc).toContain("mmtRandom_('uuid')");
    expect(funcSrc).toContain('req_ = __mmt_requestOverride');

    const override = {
      url: 'https://example.com/already-minted',
      protocol: 'http',
      method: 'post',
      headers: {'X-Id': 'fixed-uuid', 'Content-Type': 'application/json'},
      body: '{"id":"fixed-uuid","stamp":"2026-01-01T00:00:00.000Z"}',
    };
    const sent: any[] = [];
    const boom = (label: string) => () => {
      throw new Error(`${label} should not run when override is set`);
    };
    const runner = new Function(
        'send_',
        'mmtRandom_',
        'mmtCurrent_',
        'mmtEnv_',
        'mmtAccess_',
        'extractOutputs_',
        'applyOmitToRequest_',
        'resolveRequestFormat_',
        'protocolFromUrl_',
        '__mmt_requestOverride',
        '__mmt_originalSend',
        `${funcSrc}\nreturn json_send();`,
    );
    const output = await runner(
        async (req: any) => {
          sent.push(req);
          return {
            status: 200,
            body: '{}',
            headers: {},
            cookies: {},
            duration: 12,
          };
        },
        boom('mmtRandom_'),
        boom('mmtCurrent_'),
        boom('mmtEnv_'),
        (v: any) => v,
        () => ({}),
        () => {},
        () => 'json',
        () => 'http',
        override,
        boom('__mmt_originalSend'),
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual(override);
    expect(output._.details).toContain('already-minted');
    expect(output._.details).toContain('fixed-uuid');
    expect(output._.status).toBe(200);
  });

  it('without override, remint helpers run for JSON Send (glyph / Run in Core)', async () => {
    const funcSrc = await apiToJSfunc({
      api: {
        type: 'api',
        url: 'https://example.com/{{r:uuid}}',
        method: 'post',
        format: 'json',
        body: {id: 'r:uuid'},
      } as any,
      name: 'glyph_send',
      inputs: {},
      envVars: {},
    });
    const sent: any[] = [];
    let randomCalls = 0;
    const runner = new Function(
        'send_',
        'mmtRandom_',
        'mmtCurrent_',
        'mmtEnv_',
        'mmtAccess_',
        'extractOutputs_',
        'applyOmitToRequest_',
        'resolveRequestFormat_',
        'protocolFromUrl_',
        '__mmt_requestOverride',
        '__mmt_originalSend',
        `${funcSrc}\nreturn glyph_send();`,
    );
    await runner(
        async (req: any) => {
          sent.push(req);
          return {
            status: 200,
            body: '{}',
            headers: {},
            cookies: {},
            duration: 1,
          };
        },
        (name: string) => {
          randomCalls += 1;
          return name === 'uuid' ? 'glyph-uuid' : `r:${name}`;
        },
        () => 'now',
        async () => undefined,
        (v: any) => v,
        () => ({}),
        () => {},
        () => 'json',
        () => 'http',
        null,
        async () => ({status: 200, body: '{}'}),
    );
    expect(randomCalls).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).toContain('glyph-uuid');
  });

  it('oauth2 token fetch uses originalSend while primary send_ still gets override',
     async () => {
       const funcSrc = await apiToJSfunc({
         api: {
           type: 'api',
           url: 'https://example.com/resource',
           method: 'get',
           auth: {
             type: 'oauth2',
             token_url: 'https://auth.example.com/token',
             client_id: 'cid',
             client_secret: 'csecret',
           },
         } as any,
         name: 'oauth_override',
         inputs: {},
         envVars: {},
       });
       const originalCalls: any[] = [];
       const wrappedCalls: any[] = [];
       const override: {
         url: string;
         method: string;
         headers: Record<string, string>;
         body: undefined;
       } = {
         url: 'https://example.com/resource',
         method: 'get',
         headers: {},
         body: undefined,
       };
       const runner = new Function(
           'send_',
           'mmtRandom_',
           'mmtCurrent_',
           'mmtEnv_',
           'mmtAccess_',
           'extractOutputs_',
           'applyOmitToRequest_',
           'resolveRequestFormat_',
           'protocolFromUrl_',
           '__mmt_requestOverride',
           '__mmt_originalSend',
           `${funcSrc}\nreturn oauth_override();`,
       );
       await runner(
           async (req: any) => {
             wrappedCalls.push(req);
             return {
               status: 200,
               body: '{}',
               headers: {},
               cookies: {},
               duration: 1,
             };
           },
           () => {
             throw new Error('mmtRandom_ should not run');
           },
           () => {
             throw new Error('mmtCurrent_ should not run');
           },
           async () => undefined,
           (v: any) => v,
           () => ({}),
           () => {},
           () => 'json',
           () => 'http',
           override,
           async (req: any) => {
             originalCalls.push(req);
             return {
               status: 200,
               body: JSON.stringify({access_token: 'tok-abc'}),
               headers: {},
               cookies: {},
               duration: 1,
             };
           },
       );
       expect(originalCalls).toHaveLength(1);
       expect(originalCalls[0].url).toContain('auth.example.com/token');
       expect(wrappedCalls).toHaveLength(1);
       expect(wrappedCalls[0]).toBe(override);
       expect(override.headers['Authorization']).toBe('Bearer tok-abc');
     });

  it('gRPC generated JS binds override without evaluating message remint', async () => {
    const js = await apiToJSfunc({
      api: {
        type: 'api',
        protocol: 'grpc',
        url: 'localhost:50051',
        grpc: {
          proto: 'echo.proto',
          service: 'Echo',
          method: 'Say',
          message: {id: 'r:uuid'},
        },
      } as any,
      name: 'grpc_api',
      inputs: {},
      envVars: {},
    });
    expect(js).toContain('req_ = __mmt_requestOverride');
    expect(js).toContain('__grpcReq = __mmt_requestOverride');
    expect(js).toContain("mmtRandom_('uuid')");
    // Remint only in the else branch — override short-circuits first.
    const overrideIdx = js.indexOf('req_ = __mmt_requestOverride');
    const randomIdx = js.indexOf("mmtRandom_('uuid')");
    expect(overrideIdx).toBeGreaterThanOrEqual(0);
    expect(randomIdx).toBeGreaterThan(overrideIdx);
  });
});
