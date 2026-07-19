import {runGeneratedJs, validateJsSyntax} from './runCommon';
import {AssertionFailedError} from './testHelper';

describe('validateJsSyntax', () => {
  it('returns undefined for valid JS', () => {
    expect(validateJsSyntax('const x = 1;')).toBeUndefined();
  });

  it('returns undefined for valid async function body', () => {
    const js = `
      const result = await send_({url: 'http://example.com'});
      console.log(result);
    `;
    expect(validateJsSyntax(js)).toBeUndefined();
  });

  it('detects syntax error from unmatched braces', () => {
    const js = 'if (true) { console.log("open")';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('syntax error');
  });

  it('detects syntax error from unexpected token', () => {
    const js = 'const x = ;';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('syntax error');
  });

  it('detects syntax error from malformed template literal', () => {
    // A broken template literal like those produced by bad .mmt expect values
    const js = 'const x = `${`;';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('syntax error');
  });

  it('does not flag undefined variable references (those are runtime errors)', () => {
    const js = 'const x = someUndefinedVariable;';
    expect(validateJsSyntax(js)).toBeUndefined();
  });

  it('handles references to injected parameter names', () => {
    // These names are passed as Function parameters, so they are valid
    const js = `
      const h = mmtHelper;
      console.log('test');
      const r = send_({});
    `;
    expect(validateJsSyntax(js)).toBeUndefined();
  });

  it('returns undefined for empty-ish but non-blank code', () => {
    expect(validateJsSyntax('// just a comment')).toBeUndefined();
  });
});

describe('runGeneratedJs', () => {
  it('passes workerEligible to the JS runner when requested', async () => {
    const seen: any[] = [];
    const result = await runGeneratedJs(
      'run-1',
      'return {ok: true};',
      'worker eligible test',
      () => {},
      async (context) => {
        seen.push(context);
        return {ok: true};
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      false,
      undefined,
      false,
      true,
    );

    expect(result.success).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].workerEligible).toBe(true);
  });

  it('uses reporter failures for success accounting when check logs are silent', async () => {
    const result = await runGeneratedJs(
      'run-1',
      'return {};',
      'silent failure test',
      () => {},
      async (context) => {
        context.reporter && context.reporter({
          scope: 'test-step',
          runId: context.runId,
          stepIndex: 1,
          stepType: 'check',
          status: 'failed',
          expects: [{comparison: 'a == b', status: 'failed'}],
        });
        return {};
      },
      undefined,
      undefined,
      undefined,
      () => {},
      undefined,
      false,
      false,
      undefined,
      false,
      false,
      'none',
    );

    expect(result.success).toBe(false);
    expect(result.errors).toContain('check failed');
  });

  it('records executionError when the JS runner throws', async () => {
    const result = await runGeneratedJs(
      'run-1',
      'pm.response.to.have.status(200);',
      'runtime failure test',
      () => {},
      async () => {
        throw new ReferenceError('pm is not defined');
      },
    );

    expect(result.success).toBe(false);
    expect(result.threw).toBe(true);
    expect(result.executionError).toBe('pm is not defined');
    expect(result.errors).toContain('Error running test: pm is not defined');
  });

  it('treats AssertionFailedError as a normal failure, not executionError', async () => {
    const result = await runGeneratedJs(
      'run-assert',
      'throw new Error("unused");',
      'Basic GET test',
      () => {},
      async () => {
        throw new AssertionFailedError();
      },
    );

    expect(result.success).toBe(false);
    expect(result.threw).toBe(false);
    expect(result.executionError).toBeUndefined();
    expect(result.errors.some(e => /Error running/.test(e))).toBe(false);
  });

  it('uses API wording for API runKind execution errors', async () => {
    const result = await runGeneratedJs(
      'run-api',
      'throw new Error("boom");',
      'sample api',
      () => {},
      async () => {
        throw new ReferenceError('envVariables is not defined');
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'API',
    );

    expect(result.success).toBe(false);
    expect(result.threw).toBe(true);
    expect(result.errors).toContain('Error running API: envVariables is not defined');
  });
});
