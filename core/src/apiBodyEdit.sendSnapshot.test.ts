import {
  buildApiTesterSendRequest,
  mintApiTesterResolvedRequest,
} from './apiBodyEdit';
import {
  clearTokenFieldPreviewRandomCache,
  projectTokenFieldPreview,
} from './bodyRuntimeTokens';
import {generateApiJs} from './runApi';
import {APIData} from './APIData';

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

    // Distinct source strings → distinct cache keys (both hold reminted c:time).
    expect(projectTokenFieldPreview('{{c:time}}', {env: {}, inputs: {}}).text)
        .toBe(bodyStamp);
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
    // Prefer override over the YAML-resolved req so Send can remint once in UI.
    expect(js).toMatch(
        /const __req = \(typeof __mmt_requestOverride !== 'undefined' &&\s*\n\s*__mmt_requestOverride\) \? __mmt_requestOverride : \(req \|\| \{\}\)/,
    );
  });
});
