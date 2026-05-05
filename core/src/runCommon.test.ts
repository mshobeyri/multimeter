import {runGeneratedJs, validateJsSyntax} from './runCommon';

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
    expect(result).toContain('syntax error');
  });

  it('detects syntax error from unexpected token', () => {
    const js = 'const x = ;';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result).toContain('syntax error');
  });

  it('includes print-js hint in syntax error message', () => {
    const js = 'if (true) {';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result).toContain('print-js');
  });

  it('detects syntax error from malformed template literal', () => {
    // A broken template literal like those produced by bad .mmt expect values
    const js = 'const x = `${`;';
    const result = validateJsSyntax(js);
    expect(result).toBeDefined();
    expect(result).toContain('syntax error');
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
    expect(result.errors).toContain('Reported failed check');
  });
});
