import {apiToJSfunc} from './JSerAPI';
import {DEFAULT_OUTPUT_KEYS, mergeWithDefaultExtractionRules} from './outputExtractor';
import {ImportTracker} from './importTracker';

describe('API default outputs in generated code', () => {
  it('generated API function includes default extraction rules', async () => {
    const js = await apiToJSfunc({
      api: {
        type: 'api',
        title: 'Test API',
        url: 'http://example.com',
        method: 'get',
        protocol: 'http',
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
    });

    // The generated code should include extraction rules for defaults
    expect(js).toContain('"body"');
    expect(js).toContain('"headers"');
    expect(js).toContain('"cookies"');
    expect(js).toContain('"status"');
    expect(js).toContain('"duration"');
  });

  it('generated API function includes user outputs alongside defaults', async () => {
    const js = await apiToJSfunc({
      api: {
        type: 'api',
        title: 'Test API',
        url: 'http://example.com',
        method: 'get',
        protocol: 'http',
        outputs: {token: 'body.token', userId: 'body.user.id'},
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
    });

    // Default keys
    expect(js).toContain('"body"');
    expect(js).toContain('"headers"');
    expect(js).toContain('"status"');
    expect(js).toContain('"duration"');
    // User-defined keys
    expect(js).toContain('"token"');
    expect(js).toContain('"userId"');
    expect(js).toContain('body.token');
    expect(js).toContain('body.user.id');
    expect(js).toContain('reportOutputKeys: ["token","userId"]');
  });

  it('generated API function marks only explicit output keys for reports', async () => {
    const withoutExplicitOutputs = await apiToJSfunc({
      api: {
        type: 'api',
        title: 'Test API',
        url: 'http://example.com',
        method: 'get',
        protocol: 'http',
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
    });

    const withOverrides = await apiToJSfunc({
      api: {
        type: 'api',
        title: 'Test API',
        url: 'http://example.com',
        method: 'get',
        protocol: 'http',
        outputs: {body: 'body.data', status: 'body.code'},
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
    });

    expect(withoutExplicitOutputs).toContain('reportOutputKeys: []');
    expect(withOverrides).toContain('reportOutputKeys: ["body","status"]');
  });

  it('user output overrides default when same key name is used', async () => {
    const js = await apiToJSfunc({
      api: {
        type: 'api',
        title: 'Test API',
        url: 'http://example.com',
        method: 'get',
        protocol: 'http',
        outputs: {body: 'body.data', status: 'body.code'},
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
    });

    // The user overrides should be present
    expect(js).toContain('"body": "body.data"');
    expect(js).toContain('"status": "body.code"');
    // Other defaults still present
    expect(js).toContain('"headers": "headers"');
    expect(js).toContain('"cookies": "cookies"');
    expect(js).toContain('"duration": "duration"');
  });
});

describe('Import tracker registers default output keys for APIs', () => {
  it('API without explicit outputs registers default keys', () => {
    const tracker = new ImportTracker();
    // Simulate what JSerImports does
    const api = {outputs: undefined};
    if (api.outputs && typeof api.outputs === 'object') {
      const userKeys = Object.keys(api.outputs);
      const allKeys = [...new Set([...DEFAULT_OUTPUT_KEYS, ...userKeys])];
      tracker.setOutputKeys('/test/api.mmt', allKeys);
    } else {
      tracker.setOutputKeys('/test/api.mmt', [...DEFAULT_OUTPUT_KEYS]);
    }

    const keys = tracker.getOutputKeys('/test/api.mmt');
    expect(keys).toContain('body');
    expect(keys).toContain('headers');
    expect(keys).toContain('cookies');
    expect(keys).toContain('status');
    expect(keys).toContain('duration');
  });

  it('API with explicit outputs registers both user and default keys', () => {
    const tracker = new ImportTracker();
    const api = {outputs: {token: 'body.token', message: 'body.message'}};
    const userKeys = Object.keys(api.outputs);
    const allKeys = [...new Set([...DEFAULT_OUTPUT_KEYS, ...userKeys])];
    tracker.setOutputKeys('/test/api.mmt', allKeys);

    const keys = tracker.getOutputKeys('/test/api.mmt');
    expect(keys).toContain('body');
    expect(keys).toContain('headers');
    expect(keys).toContain('cookies');
    expect(keys).toContain('status');
    expect(keys).toContain('duration');
    expect(keys).toContain('token');
    expect(keys).toContain('message');
  });
});

describe('Expect validation allows dot-notation paths', () => {
  it('dot-notation path with valid root is allowed in validation', () => {
    const allowedOutputs = new Set(['body', 'headers', 'cookies', 'status', 'duration', 'token']);
    const expectMap = {
      'status': 200,
      'body.message': 'hello',
      'body.user.name': 'mehrdad',
      'headers.Content-Type': 'application/json',
      'token': 'abc',
    };

    const unknownOutputs = Object.keys(expectMap).filter(k => {
      if (allowedOutputs.has(k)) { return false; }
      const dotIdx = k.indexOf('.');
      if (dotIdx > 0 && allowedOutputs.has(k.slice(0, dotIdx))) { return false; }
      return true;
    });

    expect(unknownOutputs).toHaveLength(0);
  });

  it('dot-notation path with invalid root is rejected', () => {
    const allowedOutputs = new Set(['body', 'headers', 'status']);
    const expectMap = {
      'unknown.field': 'value',
      'body.message': 'hello',
    };

    const unknownOutputs = Object.keys(expectMap).filter(k => {
      if (allowedOutputs.has(k)) { return false; }
      const dotIdx = k.indexOf('.');
      if (dotIdx > 0 && allowedOutputs.has(k.slice(0, dotIdx))) { return false; }
      return true;
    });

    expect(unknownOutputs).toEqual(['unknown.field']);
  });

  it('direct key match takes priority over dot-notation', () => {
    const allowedOutputs = new Set(['body', 'body.token']);
    const expectMap = {
      'body.token': 'xyz',
    };

    const unknownOutputs = Object.keys(expectMap).filter(k => {
      if (allowedOutputs.has(k)) { return false; }
      const dotIdx = k.indexOf('.');
      if (dotIdx > 0 && allowedOutputs.has(k.slice(0, dotIdx))) { return false; }
      return true;
    });

    expect(unknownOutputs).toHaveLength(0);
  });
});

describe('mergeWithDefaultExtractionRules preserves insertion order', () => {
  it('defaults come first, user outputs come after', () => {
    const result = mergeWithDefaultExtractionRules({token: 'body.token'});
    const keys = Object.keys(result);
    // Defaults are first
    expect(keys.indexOf('body')).toBeLessThan(keys.indexOf('token'));
    expect(keys.indexOf('status')).toBeLessThan(keys.indexOf('token'));
  });

  it('user override replaces value but keeps key position from defaults', () => {
    const result = mergeWithDefaultExtractionRules({body: 'body.data'});
    const keys = Object.keys(result);
    // body key should still be in the position it was overridden to (spread order)
    expect(keys.includes('body')).toBe(true);
    expect(result['body']).toBe('body.data');
  });
});
