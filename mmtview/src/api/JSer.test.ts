import {Context, toJSfunction} from './JSer';

describe('toJSfunction', () => {
  it('generates a function with correct input parameters', () => {
    const ctx = {
      api: {
        type: 'api',
        protocol: 'http',
        format: 'json',
        url: 'http://example.com',
        inputs: {foo: '', bar: ''},
        outputs: {result: ''}
      },
      inputs: {},
      envVars: {}
    } as Context;
    const fnStr = toJSfunction(ctx);
    expect(fnStr).toContain('async function call(foo, bar)');
  });

  it('includes output extraction for all outputs', () => {
    const ctx = {
      api: {
        type: 'api',
        protocol: 'http',
        format: 'json',
        url: 'http://example.com',
        inputs: {foo: ''},
        outputs: {result: '', status: ''}
      },
      inputs: {},
      envVars: {}
    } as Context;
    const fnStr = toJSfunction(ctx);
    expect(fnStr).toContain(
        'finalOutputs["result"] = extractedValues["result"] ?? ""');
    expect(fnStr).toContain(
        'finalOutputs["status"] = extractedValues["status"] ?? ""');
  });

  it('handles empty inputs and outputs', () => {
    const ctx = {api: {}, inputs: {}, envVars: {}} as Context;
    const fnStr = toJSfunction(ctx);
    expect(fnStr).toContain('async function call()');
    expect(fnStr).toContain('return finalOutputs;');
  });

  it('includes environment variables in envParameters', () => {
    const ctx = {
      api: {

        type: 'api',
        protocol: 'http',
        format: 'json',
        url: 'http://example.com',
        inputs: {foo: ''},
        outputs: {result: ''}
      },
      inputs: {},
      envVars: {ENV1: 'x', ENV2: 'y'}
    } as Context;
    const fnStr = toJSfunction(ctx);
    expect(fnStr).toContain(
        'const envParameters = {ENV1: (typeof ENV1 !== \'undefined\' ? ENV1 : \'\'), ENV2: (typeof ENV2 !== \'undefined\' ? ENV2 : \'\')}');
  });

  it('uses extract if present, otherwise outputs', () => {
    const ctx = {
      api: {
        type: 'api',
        protocol: 'http',
        format: 'json',
        url: 'http://example.com',
        inputs: {foo: ''},
        extract: {special: ''},
        outputs: {result: ''}
      },
      inputs: {},
      envVars: {}
    } as Context;
    const fnStr = toJSfunction(ctx);
    expect(fnStr).toContain(JSON.stringify({special: ''}));
    expect(fnStr).not.toContain('result');
  });
});