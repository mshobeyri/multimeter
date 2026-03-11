import {yamlToAPI} from './apiParsePack';
import {apiToJSfunc, rootTestToJsfunc, testToJsfunc,} from './JSer';
import {APIContext} from './JSerAPI';
import {setFileLoader} from './JSerFileLoader';
import {importsToJsfunc} from './JSerImports';
import {TestContext, variableReplacer} from './JSerTest';
import {assertToJSfunc, checkToJSfunc, flowStagesToJsfunc} from './JSerTestFlow';
import {createTestFileLoaderMock} from './testFileLoaderMock';
import {normalizeReportConfig} from './TestData';

describe('normalizeReportConfig', () => {
  it('returns defaults when undefined', () => {
    const result = normalizeReportConfig(undefined);
    expect(result).toEqual({ internal: 'all', external: 'fails' });
  });

  it('applies string shorthand to both internal and external', () => {
    expect(normalizeReportConfig('all')).toEqual({ internal: 'all', external: 'all' });
    expect(normalizeReportConfig('fails')).toEqual({ internal: 'fails', external: 'fails' });
    expect(normalizeReportConfig('none')).toEqual({ internal: 'none', external: 'none' });
  });

  it('uses object values with defaults for missing fields', () => {
    expect(normalizeReportConfig({ internal: 'none' })).toEqual({ internal: 'none', external: 'fails' });
    expect(normalizeReportConfig({ external: 'all' })).toEqual({ internal: 'all', external: 'all' });
    expect(normalizeReportConfig({ internal: 'fails', external: 'none' })).toEqual({ internal: 'fails', external: 'none' });
  });
});

describe('flowStagesToJsfunc', () => {
  it('generates parallel execution for independent stages', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
        ],
      },
      {
        id: 'stage2',
        steps: [
          {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any, true);
    expect(js).toContain('const stage1Promise = (async () =>');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });

  it('generates dependency handling for dependent stages', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
        ],
      },
      {
        id: 'stage2',
        depends_on: ['stage1'],
        steps: [
          {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any, true);
    expect(js).toContain('await Promise.all([stage1Promise]);');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });

  it('handles multiple dependencies', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
        ],
      },
      {
        id: 'stage2',
        steps: [
          {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
        ],
      },
      {
        id: 'stage3',
        depends_on: ['stage1', 'stage2'],
        steps: [
          {type: 'call', id: 'step3', target: 'apiFunc3', inputs: ['c']},
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any, true);
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
    expect(js).toContain('const stage3Promise = (async () =>');
    expect(js).toContain(
        'await Promise.all([stage1Promise, stage2Promise, stage3Promise]);');
  });

  it('injects early return when stage condition exists', () => {
    const stages = [
      {
        id: 'stage1',
        condition: 'equals(status, 200)',
        steps: [
          {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
        ],
      },
      {
        id: 'stage2',
        steps: [
          {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any, true);
    expect(js).toContain('const stage1Promise = (async () =>');
    // Presence of condition should introduce an early-return guard
    expect(js).toContain('if (!(');
    expect(js).toContain('return;');
    // Final Promise.all should include both launched stages
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });

  it('defaults to no condition (treated as true) when absent', () => {
    const stages = [
      {
        id: 'stage1',
        steps: [
          {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
        ],
      },
      {
        id: 'stage2',
        steps: [
          {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
        ],
      },
    ];
    const js = flowStagesToJsfunc(stages as any, true);
    expect(js).toContain('const stage1Promise = (async () =>');
    // No condition means no early-return guard injected
    expect(js.includes('if (!(')).toBe(false);
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });
});

describe('testToJsfunc (multi-stage)', () => {
  it('generates code for a test with only stages', async () => {
    const ctx: TestContext = {
      name: 'multiStageTest',
      test: {
        stages: [
          {
            id: 'stage1',
            steps: [
              {type: 'call', id: 'step1', target: 'apiFunc1', inputs: ['a']},
            ],
          },
          {
            id: 'stage2',
            depends_on: ['stage1'],
            steps: [
              {type: 'call', id: 'step2', target: 'apiFunc2', inputs: ['b']},
            ],
          },
        ],
      } as any,
      inputs: {a: '', b: ''},
      envVars: {},
    };
    // Patch testToJsfunc to use flowStagesToJsfunc for this test
    const originalFlowStagesToJsfunc = (globalThis as any).flowStagesToJsfunc;
    (globalThis as any).flowStagesToJsfunc = flowStagesToJsfunc;
    const js = await testToJsfunc(ctx, true);
    (globalThis as any).flowStagesToJsfunc = originalFlowStagesToJsfunc;
    expect(js).toContain('const stage1Promise = (async () =>');
    expect(js).toContain('const stage2Promise = (async () =>');
    expect(js).toContain('await Promise.all([stage1Promise]);');
    expect(js).toContain('await Promise.all([stage1Promise, stage2Promise]);');
  });
});

describe('CSV import parsing', () => {
  it('wires through importsToJsfunc with a loader', async () => {
    const csv = `name,family,age\nmehrdad,shobeyri,35\n`;
    setFileLoader(async (p: string) => {
      if (p.endsWith('.csv')) {
        return csv;
      }
      return '';
    });
    const bundle = await importsToJsfunc({users: 'users.csv'});
    const users = new Function(bundle + '\nreturn users_;')();
    expect(users).toEqual([{name: 'mehrdad', family: 'shobeyri', age: 35}]);
  });

  it('maps csv import keys to generated names in root imports', async () => {
    const csv = `name,age\nmehrdad,35\n`;
    setFileLoader(async (p: string) => {
      if (p === '/root/users.csv') {
        return csv;
      }
      return '';
    });

    const js = await rootTestToJsfunc({
      name: 'csvRunner',
      test: {
        import: {users: '/root/users.csv'},
        steps: [{print: 'hello'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/testflow.mmt',
    });

    expect(js).toContain('const users_ = [');
    expect(js).toContain('const users = users_');
    expect(js).not.toMatch(/const imports =/);
  });

  it('maps relative csv imports to canonical names', async () => {
    const csv = `name\nmehrdad\n`;
    setFileLoader(async (p: string) => {
      if (p === '/root/data/users.csv') {
        return csv;
      }
      return '';
    });

    const js = await rootTestToJsfunc({
      name: 'csvRunner',
      test: {
        import: {users: '../data/users.csv'},
        steps: [{print: 'hello'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/tests/main.mmt',
    });

    expect(js).not.toMatch(/const imports =/);
    expect(js).toContain('const users_ = [');
    expect(js).toContain('const users = users_');
  });


  it('detects circular imports and logs error (graceful handling)',
     async () => {
       const errorLogs: any[] = [];
       const originalError = console.error;
       console.error = (...args: any[]) => {
         errorLogs.push(args);
       };

       try {
         setFileLoader(async (p: string) => {
           if (p === 'a.mmt') {
             return 'type: test\nimport:\n  b: b.mmt\n';
           }
           if (p === 'b.mmt') {
             return 'type: test\nimport:\n  a: a.mmt\n';
           }
           return '';
         });

         // Circular import: a -> b -> a
         const result = await importsToJsfunc({a: 'a.mmt'});
         expect(result).toBe('');
         const hasCircular = errorLogs.some(
             (log: any) => log[0]?.includes('Error importing functions:') &&
                 log[1]?.message?.includes('Circular import detected'));
         expect(hasCircular).toBe(true);
       } finally {
         console.error = originalError;
       }
     });

  it('resolves nested import paths relative to each file', async () => {
    const seen: string[] = [];
    setFileLoader(async (p: string) => {
      seen.push(p);
      if (p === '/root/a.mmt') {
        return 'type: test\nimport:\n  b: ../../../b.mmt\n';
      }
      if (p === '/b.mmt') {
        return 'type: test\nimport:\n  c: /c.mmt\n';
      }
      if (p === '/c.mmt') {
        return 'type: api\nprotocol: http\nmethod: GET\nurl: http://example.com\n';
      }
      return '';
    });

    const bundle = await importsToJsfunc({a: '/root/a.mmt'});
    expect(bundle).toContain('const a_ = async');
    expect(bundle).toContain('const c_ = async');
    expect(seen).toEqual(
        expect.arrayContaining(['/root/a.mmt', '/b.mmt', '/c.mmt']));
  });

  it('logs missing-file error when import content is empty', async () => {
    const errorLogs: any[] = [];
    const originalError = console.error;
    console.error = (...args: any[]) => {
      errorLogs.push(args);
    };
    try {
      setFileLoader(async (p: string) => {
        if (p === 'a.mmt') {
          return 'type: test\nimport:\n  b: b.mmt\n';
        }
        if (p === 'b.mmt') {
          return '';
        }
        return '';
      });
      const bundle = await importsToJsfunc({a: 'a.mmt'});
      expect(bundle).toBe('');
      const hasMissing = errorLogs.some(
          (log: any) => log[0]?.includes('Error importing functions:') &&
              log[1]?.message?.includes('Imported file not found'));
      expect(hasMissing).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it('names imported test functions by title and emits in reverse order',
     async () => {
       const mock = createTestFileLoaderMock({
         '/root/main.mmt':
             'type: test\nimport:\n  first: /root/first.mmt\n  second: /root/second.mmt\nsteps: []\n',
         '/root/first.mmt':
             'type: test\ntitle: First Title\nsteps:\n  - print: one\n',
         '/root/second.mmt':
             'type: test\ntitle: Second Title\nsteps:\n  - print: two\n',
       });
       setFileLoader(mock.fileLoader);

       const bundle = await importsToJsfunc({main: '/root/main.mmt'});
       // reverse emission => second_* comes before first_*
      const idxSecond = bundle.indexOf('const second_ = async');
      const idxFirst = bundle.indexOf('const first_ = async');
      expect(idxSecond).toBeGreaterThanOrEqual(0);
      expect(idxFirst).toBeGreaterThanOrEqual(0);
      expect(idxSecond).toBeLessThan(idxFirst);
     });

  it('falls back to filename when title is missing and resolves conflicts with suffix',
     async () => {
       const mock = createTestFileLoaderMock({
         '/root/a1.mmt': 'type: test\nsteps: []\n',
         '/other/a1.mmt': 'type: test\nsteps: []\n',
       });
       setFileLoader(mock.fileLoader);
       const bundle =
           await importsToJsfunc({x: '/root/a1.mmt', y: '/other/a1.mmt'});
      expect(bundle).toContain('const a1_1_ = async');
      expect(bundle).toMatch(/const a1_\d+_ = async/);
     });

  it('injects `imports` alias object in generated test functions', async () => {
    const mock = createTestFileLoaderMock({
      '/root/main.mmt':
          'type: test\nimport:\n  m: /root/my file.mmt\nsteps:\n  - call: m\n',
      '/root/my file.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);
    const bundle = await importsToJsfunc({main: '/root/main.mmt'});
    expect(bundle).toContain('const my_file_ = async');
    // and an imports alias assignment inside the importing test (const m = my_file_)
    expect(bundle).toContain('const main_ = async');
    expect(bundle).toContain('const m = my_file_');
  });

  it('does not error when a test has no imports', async () => {
    const mock = createTestFileLoaderMock({
      '/root/noimp.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);
    const bundle = await importsToJsfunc({main: '/root/noimp.mmt'});
    expect(bundle).toContain('const noimp_ = async');
  });
});

describe('env token replacements in generated JS', () => {
  it('replaces e:VAR, e:{VAR}, <e:VAR> and <<e:VAR>> inside template literals',
     async () => {
       const ctx: TestContext = {
         name: 'envTplTest',
         test: {
           steps:
               [{print: 'FOO=<e:FOO>, BAR=<<e:BAR>>, BAZ=e:BAZ, QUX=e:{QUX}'} as
                any]
         } as any,
         inputs: {},
         envVars: {}
       };
       const js = await rootTestToJsfunc(ctx);
       expect(js).toContain('${envVariables.FOO}');
       expect(js).toContain('${envVariables.BAR}');
       expect(js).toContain('${envVariables.BAZ}');
       expect(js).toContain('${envVariables.QUX}');
     });

  it('replaces tokens outside template literals as plain envVariables access',
     async () => {
       const ctx: TestContext = {
         name: 'envOutsideTest',
         test: {
           steps: [{ for: 'let i = 0; i < e:LIMIT; i++', steps: [ { print: 'ok' } as any ]
           } as any]
         } as any,
         inputs: {},
         envVars: {}
       };
       const js = await rootTestToJsfunc(ctx);
       expect(js).toContain('i < envVariables.LIMIT');
     });

  it('variableReplacer works on raw JS strings inside and outside template literals',
     () => {
       const input = [
         'const a = e:AAA;', 'const b = e:{BBB};',
         'console.log(`X=<e:FOO> Y=<<e:BAR>> Z=e:BAZ W=e:{QUX}`);'
       ].join('\n');
       const out = variableReplacer(input);
       expect(out).toContain('const a = envVariables.AAA;');
       expect(out).toContain('const b = envVariables.BBB;');
       expect(out).toContain(
           '`X=${envVariables.FOO} Y=${envVariables.BAR} Z=${envVariables.BAZ} W=${envVariables.QUX}`');
     });

  it('does not double-wrap pre-existing ${envVariables.VAR} inside template literals',
     () => {
       // This is the exact regression: generated code may already have
       // ${envVariables.FOO} inside a template literal. replaceInsideTpl must
       // leave them as-is instead of producing ${${envVariables.FOO}}.
       const input = 'console.log(`url=${envVariables.HOST}/api`);';
       const out = variableReplacer(input);
       expect(out).toContain('`url=${envVariables.HOST}/api`');
       expect(out).not.toContain('${${');
     });

  it('does not double-wrap when mixing pre-existing and new env tokens in template',
     () => {
       // Template has both a pre-existing ${envVariables.HOST} and a raw e:PORT
       const input = 'const u = `http://${envVariables.HOST}:e:PORT/path`;';
       const out = variableReplacer(input);
       expect(out).toContain('${envVariables.HOST}');
       expect(out).toContain('${envVariables.PORT}');
       expect(out).not.toContain('${${');
     });

  it('does not double-wrap with <<e:VAR>> inside template literal',
     () => {
       const input = 'const s = `value=<<e:FOO>>`;';
       const out = variableReplacer(input);
       expect(out).toContain('${envVariables.FOO}');
       expect(out).not.toContain('${${');
     });

  it('preserves non-env ${...} expressions in template literals', () => {
    const input = 'const x = `${someVar} and e:NAME`;';
    const out = variableReplacer(input);
    expect(out).toContain('${someVar}');
    expect(out).toContain('${envVariables.NAME}');
    expect(out).not.toContain('${${');
  });

  it('handles envVariables references outside template literals without wrapping',
     () => {
       // Outside backticks, envVariables.FOO should stay plain (no ${...})
       const input = 'if (envVariables.FLAG) { run(); }';
       const out = variableReplacer(input);
       expect(out).toContain('envVariables.FLAG');
       expect(out).not.toContain('${envVariables.FLAG}');
     });
});

describe('toInputsParams env token handling', () => {
  it('converts e:VAR input default to envVariables reference', () => {
    const {toInputsParams} = require('./JSerHelper');
    const result = toInputsParams({ host: 'e:HOST' }, '=');
    expect(result).toContain('envVariables.HOST');
    expect(result).not.toContain('e:HOST');
  });

  it('converts <<e:VAR>> partial input to template with ${envVariables.VAR}', () => {
    const {toInputsParams} = require('./JSerHelper');
    const result = toInputsParams({ url: 'http://<<e:HOST>>/path' }, '=');
    expect(result).toContain('${envVariables.HOST}');
    expect(result).not.toContain('${${');
  });

  it('does not double-wrap if value already contains envVariables reference', () => {
    const {toInputsParams} = require('./JSerHelper');
    // Edge case: a value that somehow already has envVariables.HOST
    // (shouldn't normally happen, but must not produce ${${envVariables.HOST}})
    const result = toInputsParams({ url: '${envVariables.HOST}/api' }, '=');
    expect(result).not.toContain('${${');
  });
});

describe('step reporter instrumentation', () => {
  it('relies on shared _report helper instead of inlining reporter code', async () => {
    const ctx: TestContext = {
      name: 'reporterTest',
      test: {steps: [{check: 'a == b'} as any]} as any,
      inputs: {},
      envVars: {},
    };
    const js = await rootTestToJsfunc(ctx);
    expect(js).not.toContain('__mmtReportStepHandler');
    expect(js).toContain("report_('check'");
  });

  it('reports failed checks and asserts (default)', () => {
    // useExternalReport=false means internal run (direct)
    const checkJs = checkToJSfunc('foo == bar', false);
    expect(checkJs).toContain("report_('check'");
    expect(checkJs).toContain('foo == bar');

    const assertJs = assertToJSfunc('foo != bar', false);
    expect(assertJs).toContain("report_('assert'");
    expect(assertJs).toContain('foo != bar');
  });

  it('reports success when report: all (internal run)', () => {
    // useExternalReport=false means internal run
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: 'all' } as any, false);
    // success branch should have report_ call
    expect(checkJs).toContain("console.log");
    expect(checkJs).toContain("report_('check'");
    // Verify the success path has the report call
    const successBlock = checkJs.split('} else')[0];
    expect(successBlock).toContain("report_('check'");
    
    const assertJs = assertToJSfunc({ actual: 'foo', operator: '!=', expected: 'bar', report: 'all' } as any, false);
    const assertSuccessBlock = assertJs.split('} else')[0];
    expect(assertSuccessBlock).toContain("report_('assert'");
  });

  it('reports only failures with report: fails (default external)', () => {
    // useExternalReport=true means external run (suite or import)
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar' } as any, true);
    // success branch should NOT have report_ call
    const successBlock = checkJs.split('} else')[0];
    expect(successBlock).not.toContain("report_('check'");
    // failure branch should have report_ call
    expect(checkJs).toContain("report_('check'");
  });

  it('suppresses all reports with report: none', () => {
    // useExternalReport=false means internal run, but report: none overrides
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: 'none' } as any, false);
    // No report_ calls at all
    expect(checkJs).not.toContain("report_('check'");
  });

  it('supports object form report with internal/external', () => {
    // useExternalReport=false means use internal config
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: { internal: 'all', external: 'none' } } as any, false);
    // Internal run with report.internal='all' should report success
    const successBlock = checkJs.split('} else')[0];
    expect(successBlock).toContain("report_('check'");
    
    // useExternalReport=true means use external config
    const checkJsExt = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: { internal: 'all', external: 'none' } } as any, true);
    // External run with report.external='none' should not report anything
    expect(checkJsExt).not.toContain("report_('check'");
  });
});

describe('check/assert details templating', () => {
  it('preserves ${...} expressions in details (call result vars)', () => {
    // useExternalReport=false means internal run
    const js = checkToJSfunc({
      actual: 'a',
      operator: '==',
      expected: 'b',
      details: 'result code is ${myCall.result_code}',
    } as any, false);

    // Details is emitted as a template literal so ${...} resolves at runtime.
    expect(js).toContain('`result code is ${myCall.result_code}`');
    expect(js).toContain("report_('check'");
  });
});

describe('rootTestToJsfunc + import tracker', () => {
  it('keeps top-level imports mapping as key->key when tracker lacks alias', async () => {
    const mock = createTestFileLoaderMock({
      '/root/testflow.mmt':
          'type: test\nimport:\n  kxxx: /root/txxx.mmt\nsteps:\n  - call: kxxx\n',
      '/root/txxx.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {kxxx: '/root/txxx.mmt'},
        steps: [{call: 'kxxx'} as any],
      } as any,
      inputs: {},
      envVars: {url: 'http://localhost:8080'},
      filePath: '/root/testflow.mmt',
    });

    // Root imports object is emitted in the root test function.
    expect(js).toContain('const envVariables =');
    expect(js).toContain('const testflow_ = async');
    expect(js).toContain('kxxx = txxx_;');
  });

  it('resolves relative paths when building root aliases', async () => {
    const mock = createTestFileLoaderMock({
      '/root/testflow.mmt':
          'type: test\nimport:\n  kxxx: ./txxx.mmt\nsteps:\n  - call: kxxx\n',
      '/root/txxx.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {kxxx: './txxx.mmt'},
        steps: [{call: 'kxxx'} as any],
      } as any,
      inputs: {},
      envVars: {url: 'http://localhost:8080'},
      filePath: '/root/testflow.mmt',
    });

    expect(js).toContain('kxxx = txxx_;');
  });
});

describe('empty test items are valid', () => {
  it('handles empty assert without throwing and generates no code',
     async () => {
       const ctx: TestContext = {
         name: 'emptyAssert',
         test: {steps: [{assert: ''} as any]} as any,
         inputs: {},
         envVars: {}
       };
       const js = await testToJsfunc(ctx, true);
       expect(js).toContain('let outputs');
     });

  it('handles empty check without throwing and generates no code', async () => {
    const ctx: TestContext = {
      name: 'emptyCheck',
      test: {steps: [{check: ''} as any]} as any,
      inputs: {},
      envVars: {}
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('let outputs');
  });

  it('supports object-form check and assert with title/details', async () => {
    const ctx: TestContext = {
      name: 'objectCheckAssert',
      test: {
        steps: [
          {check: {actual: 1, expected: 2, operator: '==', title: 't1', details: 'd1'}},
          {assert: {actual: 'x', expected: 3, operator: '>=', title: 't2', details: 'd2'}},
        ],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('t1');
    expect(js).toContain('d1');
    expect(js).toContain('t2');
    expect(js).toContain('d2');
  });

  it('handles empty if gracefully (treated as true) and nests steps',
     async () => {
       const ctx: TestContext = {
         name: 'emptyIf',
         test: {
           steps: [{
             if: '', steps: [ { print: 'ok' } as any ]
           } as any]
         } as any,
         inputs: {},
         envVars: {}
       };
       const js = await testToJsfunc(ctx, true);
       expect(js).toContain('if (true)');
     });
});

describe('inline check/assert on call steps', () => {
  it('generates check after call with single string check', async () => {
    const ctx: TestContext = {
      name: 'callCheck',
      test: {
        steps: [{call: 'login', check: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // Should capture call result (no id → temp variable with index suffix)
    expect(js).toContain('const _login_0 = await login(');
    // Should generate check on the output parameter
    expect(js).toContain('equals_(`${_login_0.status}`, `200`)');
    expect(js).toContain("report_('check'");
  });

  it('generates check after call with array of checks', async () => {
    const ctx: TestContext = {
      name: 'callMultiCheck',
      test: {
        steps: [{call: 'login', check: ['status == 200', 'token != null']} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const _login_0 = await login(');
    expect(js).toContain('equals_(`${_login_0.status}`, `200`)');
    expect(js).toContain('notEquals_(`${_login_0.token}`, `null`)');
  });

  it('generates assert after call', async () => {
    const ctx: TestContext = {
      name: 'callAssert',
      test: {
        steps: [{call: 'login', assert: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const _login_0 = await login(');
    expect(js).toContain("report_('assert'");
    expect(js).toContain('throw new Error("Assertion failed")');
  });

  it('generates both check and assert on same call', async () => {
    const ctx: TestContext = {
      name: 'callBoth',
      test: {
        steps: [{call: 'login', check: 'token != null', assert: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const _login_0 = await login(');
    expect(js).toContain("report_('check'");
    expect(js).toContain("report_('assert'");
  });

  it('uses id as result variable when call has id', async () => {
    const ctx: TestContext = {
      name: 'callWithId',
      test: {
        steps: [{call: 'login', id: 'res', check: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const res = await login(');
    expect(js).toContain('equals_(`${res.status}`, `200`)');
  });

  it('sets default title to call name', async () => {
    const ctx: TestContext = {
      name: 'callTitle',
      test: {
        steps: [{call: 'myApi', check: 'value == ok'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // Title should be the call name
    expect(js).toContain('"myApi"');
  });

  it('title falls back to call name over id (call has higher priority)', async () => {
    const ctx: TestContext = {
      name: 'callTitleId',
      test: {
        steps: [{call: 'myApi', id: 'res', check: 'value == ok'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // call name (priority 3) beats id (priority 5)
    expect(js).toContain('"myApi"');
  });

  it('uses explicit title field when set on call step', async () => {
    const ctx: TestContext = {
      name: 'callExplicitTitle',
      test: {
        steps: [{call: 'myApi', title: 'My Custom Title', check: 'value == ok'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // explicit title (priority 1) wins
    expect(js).toContain('"My Custom Title"');
    expect(js).not.toContain('"myApi"');
  });

  it('title priority: title > fileTitle > call > fileName > id', async () => {
    // Without explicit title or file metadata, call name is used
    const ctx: TestContext = {
      name: 'titlePriority',
      test: {
        steps: [
          {call: 'login', id: 'res', check: 'status == 200'} as any,
        ],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('"login"');
  });

  it('includes details with JSON.stringify of call result', async () => {
    const ctx: TestContext = {
      name: 'callDetails',
      test: {
        steps: [{call: 'login', check: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('JSON.stringify(_login_0)');
  });

  it('passes inputs to call with inline check', async () => {
    const ctx: TestContext = {
      name: 'callInputsCheck',
      test: {
        steps: [{call: 'login', inputs: {username: 'alice'}, check: 'status == 200'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('_login_0 = await login(');
    expect(js).toContain('alice');
    expect(js).toContain('equals_(`${_login_0.status}`, `200`)');
  });

  it('resolves <<i:input>> reference in inline check expected value', async () => {
    const ctx: TestContext = {
      name: 'inputRefInCheck',
      test: {
        inputs: { message: 'hello world' },
        import: { echo: 'echo_api.mmt' },
        steps: [{
          call: 'echo',
          id: 'result',
          inputs: { message: 'i:message' },
          check: ['statusCode_ == 200', 'echoed_message == <<i:message>>'],
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${result.echoed_message}`, `${message}`)');
  });

  it('resolves <<i:input>> in inline check when manual inputs have spaces', async () => {
    const ctx: TestContext = {
      name: 'inputRefInCheckWithSpaces',
      test: {
        inputs: { message: 'hello world' },
        import: { echo: 'echo_api.mmt' },
        steps: [{
          call: 'echo',
          id: 'result',
          inputs: { message: 'i:message' },
          check: ['echoed_message == <<i:message>>'],
        } as any],
      } as any,
      inputs: { message: 'hello world' },
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // Should generate valid JS even when the input value has spaces
    expect(js).toContain('equals_');
  });

  it('does not generate temp variable when no check or assert', async () => {
    const ctx: TestContext = {
      name: 'callNoCheck',
      test: {
        steps: [{call: 'login'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('await login(');
    expect(js).not.toContain('const _login_0');
  });

  it('handles check with empty expected (2-part format)', async () => {
    const ctx: TestContext = {
      name: 'callEmptyExpected',
      test: {
        steps: [{call: 'login', check: 'name =='} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const _login_0');
    expect(js).toContain('equals_');
    // The expected arg in the template literal should be empty
    expect(js).toContain('``');
  });

  it('handles check with quoted empty string markers', async () => {
    const ctx: TestContext = {
      name: 'callQuotedEmpty',
      test: {
        steps: [{call: 'login', check: "name == ''"} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_');
    // '' should be unquoted to truly empty
    expect(js).toContain('``');
  });

  it('handles check with double-quoted empty string markers', async () => {
    const ctx: TestContext = {
      name: 'callDblQuotedEmpty',
      test: {
        steps: [{call: 'login', check: 'name == ""'} as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_');
    expect(js).toContain('``');
  });

  it('generates unique variable names for duplicate call aliases', async () => {
    const ctx: TestContext = {
      name: 'duplicateCalls',
      test: {
        steps: [
          {call: 'login', check: 'status == 200'} as any,
          {call: 'login', check: 'name == ok'} as any,
        ],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // First call at index 0
    expect(js).toContain('const _login_0 = await login(');
    expect(js).toContain('equals_(`${_login_0.status}`, `200`)');
    // Second call at index 1 — different variable name
    expect(js).toContain('const _login_1 = await login(');
    expect(js).toContain('equals_(`${_login_1.name}`, `ok`)');
  });

  it('uses internal report settings for checks inside for loop when root run', async () => {
    const ctx: TestContext = {
      name: 'forLoopReport',
      test: {
        steps: [{
          for: 'const row of items',
          steps: [{
            call: 'echo',
            id: 'result',
            check: ['status == 200'],
            report: { internal: 'all', external: 'none' },
          } as any],
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    // root=true → useExternalReport=false → should use internal='all'
    const js = await testToJsfunc(ctx, true);
    // console.log on success means report level is 'all' (internal)
    expect(js).toContain('console.log');
    expect(js).toContain("report_('check'");
    // Should NOT have console.trace (which is used for 'none')
    expect(js).not.toContain('console.trace');
  });

  it('uses external report settings for checks inside for loop when imported', async () => {
    const ctx: TestContext = {
      name: 'forLoopReportExt',
      test: {
        steps: [{
          for: 'const row of items',
          steps: [{
            call: 'echo',
            id: 'result',
            check: ['status == 200'],
            report: { internal: 'all', external: 'none' },
          } as any],
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    // root=false → useExternalReport=true → should use external='none'
    const js = await testToJsfunc(ctx, false);
    // console.trace on success means report level is 'none'
    expect(js).toContain('console.trace');
    // Should NOT have report_ calls at all (none = no reporting)
    expect(js).not.toContain("report_('check'");
  });
});

describe('body inputs numeric/boolean templating', () => {
  it('does not quote numbers, floats, and booleans in JSON body', async () => {
    const apiYaml = [
      'type: api', 'protocol: http', 'method: post', 'format: json',
      'url: http://<e:HOST>/login', 'inputs:', '  username: username@gmail.com',
      '  password: 123456', '  pi: 3.14', '  name: true', 'body: |',
      '  {"user":"${username}","pass":${password},"pi":${pi},"flag":${name}}'
    ].join('\n');
    const ctx: APIContext =
        {api: yamlToAPI(apiYaml), name: 'login_api', inputs: {}, envVars: {}} as
        any;
    const js = await apiToJSfunc(ctx);
    // url should interpolate env without double wrapping (now uses __resolvedUrl)
    expect(js).toContain('__resolvedUrl = `http://${envVariables.HOST}/login`');
    expect(js).toContain('url: __resolvedUrl');
    // numbers and booleans should be passed via var)
    expect(js).toContain('"pass":${password}');
    expect(js).toContain('"pi":${pi}');
    expect(js).toContain('\"flag\":${name}');
    // username remains a string at runtime
    expect(js).toContain('\"user\":\"${username}\"');
  });
});

describe('API query handling', () => {
  it('injects query parameters into generated request objects', async () => {
    const apiYaml = [
      'type: api',
      'protocol: http',
      'method: get',
      'url: https://example.com/users',
      'inputs:',
      '  page: 1',
      'query:',
      '  page: i:page',
      '  locale: <e:LOCALE>',
    ].join('\n');
    const ctx: APIContext =
        {api: yamlToAPI(apiYaml), name: 'users_api', inputs: {}, envVars: {}} as
        any;
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('query: {');
    expect(js).toContain('"page": `${page}`');
    expect(js).toContain('"locale": `${envVariables.LOCALE}`');
  });
});

describe('delay step generation', () => {
  it('generates setTimeout-based await for ms and unit strings', async () => {
    const ctx1: TestContext = {
      name: 'delayTest1',
      test: {steps: [{delay: 500} as any]} as any,
      inputs: {},
      envVars: {}
    };
    const js1 = await testToJsfunc(ctx1, true);
    expect(js1).toContain('setTimeout(r, 500)');

    const ctx2: TestContext = {
      name: 'delayTest2',
      test: {steps: [{delay: '2s'} as any]} as any,
      inputs: {},
      envVars: {}
    };
    const js2 = await testToJsfunc(ctx2, true);
    expect(js2).toContain('setTimeout(r, 2000)');
  });
});

describe('input defaults with e: references', () => {
  it('resolves e: refs in API input defaults to envVariables at runtime', async () => {
    // User scenario: input default is 'e:test', body uses i:xxx
    // The generated code should resolve e:test to envVariables.test
    const apiYaml = [
      'type: api',
      'protocol: http',
      'method: post',
      'format: json',
      'url: http://localhost:8080',
      'inputs:',
      '  xxx: e:test',
      'body:',
      '  username: i:xxx',
    ].join('\n');
    const ctx: APIContext =
        {api: yamlToAPI(apiYaml), name: 'test_api', inputs: {}, envVars: {}} as any;
    const js = await apiToJSfunc(ctx);
    // The default value for xxx should reference envVariables.test, not literal 'e:test'
    expect(js).toContain('envVariables.test');
    // Should NOT contain literal 'e:test' as a default value
    expect(js).not.toMatch(/xxx\s*=\s*`e:test`/);
  });

  it('resolves e: refs in test input defaults', async () => {
    const ctx: TestContext = {
      name: 'envRefTest',
      test: {
        inputs: { user: 'e:USERNAME' },
        steps: [{ log: 'i:user' } as any]
      } as any,
      inputs: {},
      envVars: {}
    };
    const js = await testToJsfunc(ctx, true);
    // The default should use envVariables.USERNAME
    expect(js).toContain('envVariables.USERNAME');
    expect(js).not.toMatch(/user\s*=\s*`e:USERNAME`/);
  });

  it('resolves r: refs in API input defaults to __mmt_random call', async () => {
    const apiYaml = [
      'type: api',
      'protocol: http',
      'method: post',
      'format: json',
      'url: http://localhost:8080',
      'inputs:',
      '  userId: r:uuid',
      'body:',
      '  id: i:userId',
    ].join('\n');
    const ctx: APIContext =
        {api: yamlToAPI(apiYaml), name: 'test_api', inputs: {}, envVars: {}} as any;
    const js = await apiToJSfunc(ctx);
    // The default value should call __mmt_random('uuid')
    expect(js).toContain("__mmt_random('uuid')");
    // Should NOT contain literal 'r:uuid'
    expect(js).not.toMatch(/userId\s*=\s*`r:uuid`/);
  });

  it('resolves c: refs in input defaults to __mmt_current call', async () => {
    const apiYaml = [
      'type: api',
      'protocol: http',
      'method: get',
      'url: http://localhost:8080',
      'inputs:',
      '  timestamp: c:epoch',
      'query:',
      '  ts: i:timestamp',
    ].join('\n');
    const ctx: APIContext =
        {api: yamlToAPI(apiYaml), name: 'test_api', inputs: {}, envVars: {}} as any;
    const js = await apiToJSfunc(ctx);
    // The default value should call __mmt_current('epoch')
    expect(js).toContain("__mmt_current('epoch')");
    expect(js).not.toMatch(/timestamp\s*=\s*`c:epoch`/);
  });
});
