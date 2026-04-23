import {yamlToAPI} from './apiParsePack';
import {validateAuth} from './apiParsePack';
import {apiToJSfunc, rootTestToJsfunc, testToJsfunc,} from './JSer';
import {APIContext} from './JSerAPI';
import {setFileLoader} from './JSerFileLoader';
import {importsToJsfunc} from './JSerImports';
import {TestContext, variableReplacer} from './JSerTest';
import {assertToJSfunc, checkToJSfunc, flowStagesToJsfunc, parseExpectValue} from './JSerTestFlow';
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
        after: ['stage1'],
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
        after: ['stage1', 'stage2'],
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
            after: ['stage1'],
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


  it('detects circular imports and throws import error',
     async () => {
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
       await expect(importsToJsfunc({a: 'a.mmt'}))
           .rejects.toThrow(/Import error.*Circular import detected/);
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

  it('throws import error when import content is empty', async () => {
    setFileLoader(async (p: string) => {
      if (p === 'a.mmt') {
        return 'type: test\nimport:\n  b: b.mmt\n';
      }
      if (p === 'b.mmt') {
        return '';
      }
      return '';
    });
    await expect(importsToJsfunc({a: 'a.mmt'}))
        .rejects.toThrow(/Import error.*Imported file not found/);
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

  it('supports env accessor syntax inside and outside template literals', () => {
    const input = [
      'const a = e:AAA[0:1];',
      'const b = `X=<<e:FOO[0]>> Y=<<e:BAR[0:2]>>`;'
    ].join('\n');
    const out = variableReplacer(input);
    expect(out).toContain('const a = __mmt_access(envVariables.AAA, "[0:1]");');
    expect(out).toContain('${__mmt_access(envVariables.FOO, "[0]")}');
    expect(out).toContain('${__mmt_access(envVariables.BAR, "[0:2]")}');
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
  it('relies on shared check_ helper instead of inlining reporter code', async () => {
    const ctx: TestContext = {
      name: 'reporterTest',
      test: {steps: [{check: 'a == b'} as any]} as any,
      inputs: {},
      envVars: {},
    };
    const js = await rootTestToJsfunc(ctx);
    expect(js).not.toContain('__mmtReportStepHandler');
    expect(js).toContain("check_(");
    expect(js).toContain("'check'");
  });

  it('reports failed checks and asserts (default)', () => {
    // useExternalReport=false means internal run (direct)
    const checkJs = checkToJSfunc('foo == bar', false);
    expect(checkJs).toContain("check_(");
    expect(checkJs).toContain("'check'");
    expect(checkJs).toContain('foo == bar');

    const assertJs = assertToJSfunc('foo != bar', false);
    expect(assertJs).toContain("check_(");
    expect(assertJs).toContain("'assert'");
    expect(assertJs).toContain('foo != bar');
  });

  it('reports success when report: all (internal run)', () => {
    // useExternalReport=false means internal run
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: 'all' } as any, false);
    // report level 'all' means report on success too
    expect(checkJs).toContain("'all'");
    expect(checkJs).toContain("'check'");
    
    const assertJs = assertToJSfunc({ actual: 'foo', operator: '!=', expected: 'bar', report: 'all' } as any, false);
    expect(assertJs).toContain("'all'");
    expect(assertJs).toContain("'assert'");
  });

  it('reports only failures with report: fails (default external)', () => {
    // useExternalReport=true means external run (suite or import)
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar' } as any, true);
    // Default external report level is 'fails'
    expect(checkJs).toContain("'fails'");
    expect(checkJs).toContain("'check'");
  });

  it('suppresses all reports with report: none', () => {
    // useExternalReport=false means internal run, but report: none overrides
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: 'none' } as any, false);
    // report level 'none' is passed to check_ helper
    expect(checkJs).toContain("'none'");
  });

  it('supports object form report with internal/external', () => {
    // useExternalReport=false means use internal config
    const checkJs = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: { internal: 'all', external: 'none' } } as any, false);
    // Internal run with report.internal='all'
    expect(checkJs).toContain("'all'");
    
    // useExternalReport=true means use external config
    const checkJsExt = checkToJSfunc({ actual: 'foo', operator: '==', expected: 'bar', report: { internal: 'all', external: 'none' } } as any, true);
    // External run with report.external='none'
    expect(checkJsExt).toContain("'none'");
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
    expect(js).toContain("check_(");
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

  it('resolves bare subdirectory paths without ./ prefix for mmt imports', async () => {
    const mock = createTestFileLoaderMock({
      '/root/tests/api/echo.mmt': 'type: api\nprotocol: http\nmethod: GET\nurl: http://example.com\n',
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'barepath',
      test: {
        import: {echo: 'api/echo.mmt'},
        steps: [{call: 'echo'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/tests/main.mmt',
    });

    expect(js).toContain('echo = echo_;');
  });

  it('resolves bare subdirectory paths without ./ prefix for csv imports', async () => {
    const csv = 'name,age\nalice,30\nbob,25\n';
    setFileLoader(async (p: string) => {
      if (p === '/root/tests/data/users.csv') {
        return csv;
      }
      return '';
    });

    const js = await rootTestToJsfunc({
      name: 'barecsv',
      test: {
        import: {users: 'data/users.csv'},
        steps: [{print: 'hello'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/tests/main.mmt',
    });

    expect(js).toContain('const users_ = [');
    expect(js).toContain('const users = users_');
  });

  it('bare and dotslash subdirectory paths produce identical results', async () => {
    const mock = createTestFileLoaderMock({
      '/root/tests/api/echo.mmt': 'type: api\nprotocol: http\nmethod: GET\nurl: http://example.com\n',
    });
    setFileLoader(mock.fileLoader);

    const jsBare = await rootTestToJsfunc({
      name: 'bare',
      test: {
        import: {echo: 'api/echo.mmt'},
        steps: [{call: 'echo'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/tests/main.mmt',
    });

    const jsDot = await rootTestToJsfunc({
      name: 'dot',
      test: {
        import: {echo: './api/echo.mmt'},
        steps: [{call: 'echo'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/tests/main.mmt',
    });

    // Both should contain the same import alias assignment
    expect(jsBare).toContain('echo = echo_;');
    expect(jsDot).toContain('echo = echo_;');
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

describe('call steps without expect', () => {
  it('does not generate temp variable when no expect', async () => {
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

  it('generates unique variable names for duplicate call aliases', async () => {
    const ctx: TestContext = {
      name: 'duplicateCalls',
      test: {
        steps: [
          {call: 'login', expect: { status: 200 }} as any,
          {call: 'login', expect: { name: 'ok' }} as any,
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
});

describe('parseExpectValue', () => {
  it('defaults plain number to == operator', () => {
    expect(parseExpectValue(200)).toEqual({ operator: '==', expected: '200' });
  });

  it('defaults plain boolean to == operator', () => {
    expect(parseExpectValue(true)).toEqual({ operator: '==', expected: 'true' });
    expect(parseExpectValue(false)).toEqual({ operator: '==', expected: 'false' });
  });

  it('defaults plain string to == operator', () => {
    expect(parseExpectValue('hello')).toEqual({ operator: '==', expected: 'hello' });
  });

  it('parses == operator prefix', () => {
    expect(parseExpectValue('== 200')).toEqual({ operator: '==', expected: '200' });
  });

  it('parses != operator prefix', () => {
    expect(parseExpectValue('!= 500')).toEqual({ operator: '!=', expected: '500' });
  });

  it('parses < operator prefix', () => {
    expect(parseExpectValue('< 100')).toEqual({ operator: '<', expected: '100' });
  });

  it('parses > operator prefix', () => {
    expect(parseExpectValue('> 0')).toEqual({ operator: '>', expected: '0' });
  });

  it('parses <= operator prefix', () => {
    expect(parseExpectValue('<= 300')).toEqual({ operator: '<=', expected: '300' });
  });

  it('parses >= operator prefix', () => {
    expect(parseExpectValue('>= 100')).toEqual({ operator: '>=', expected: '100' });
  });

  it('parses =@ (is in) operator prefix', () => {
    expect(parseExpectValue('=@ success')).toEqual({ operator: '=@', expected: 'success' });
  });

  it('parses =C (contains) operator prefix', () => {
    expect(parseExpectValue('=C success')).toEqual({ operator: '=C', expected: 'success' });
  });

  it('parses !C (not contains) operator prefix', () => {
    expect(parseExpectValue('!C error')).toEqual({ operator: '!C', expected: 'error' });
  });

  it('parses =~ (regex) operator prefix', () => {
    expect(parseExpectValue('=~ /ok/i')).toEqual({ operator: '=~', expected: '/ok/i' });
  });

  it('handles expected value with spaces', () => {
    expect(parseExpectValue('== hello world')).toEqual({ operator: '==', expected: 'hello world' });
  });

  it('handles operator-only (no expected value)', () => {
    expect(parseExpectValue('==')).toEqual({ operator: '==', expected: '' });
  });

  it('unquotes empty string markers', () => {
    expect(parseExpectValue("== ''")).toEqual({ operator: '==', expected: '' });
    expect(parseExpectValue('== ""')).toEqual({ operator: '==', expected: '' });
  });
});

describe('expect on call steps', () => {
  it('generates check from simple expect map (default == operator)', async () => {
    const ctx: TestContext = {
      name: 'callExpect',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: 200 },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const _login_0 = await login(');
    expect(js).toContain('equals_(`${_login_0.status_code}`, `200`)');
    expect(js).toContain("checkExpects_(");
  });

  it('generates check from string expect with explicit operator', async () => {
    const ctx: TestContext = {
      name: 'callExpectOp',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: '== 200' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_login_0.status_code}`, `200`)');
  });

  it('generates check from != operator', async () => {
    const ctx: TestContext = {
      name: 'callExpectNe',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: '!= 500' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('notEquals_(`${_login_0.status_code}`, `500`)');
  });

  it('generates multiple checks from array expect value', async () => {
    const ctx: TestContext = {
      name: 'callExpectArr',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: ['== 200', '!= 500'] },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_login_0.status_code}`, `200`)');
    expect(js).toContain('notEquals_(`${_login_0.status_code}`, `500`)');
  });

  it('generates checks for multiple fields', async () => {
    const ctx: TestContext = {
      name: 'callExpectMulti',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: 200, token: '!= null' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_login_0.status_code}`, `200`)');
    expect(js).toContain('notEquals_(`${_login_0.token}`, `null`)');
  });

  it('supports dot-notation for nested field access', async () => {
    const ctx: TestContext = {
      name: 'callExpectDot',
      test: {
        steps: [{
          call: 'getUser',
          expect: { 'body.user.name': '== John' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_getUser_0.body.user.name}`, `John`)');
  });

  it('supports template expressions in expected value', async () => {
    const ctx: TestContext = {
      name: 'callExpectTpl',
      test: {
        inputs: { message: 'hello' },
        steps: [{
          call: 'echo',
          id: 'result',
          expect: { echoed_message: '== <<i:message>>' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${result.echoed_message}`, `${message}`)') ;
  });

  it('uses id as result variable when call has id', async () => {
    const ctx: TestContext = {
      name: 'callExpectId',
      test: {
        steps: [{
          call: 'login',
          id: 'res',
          expect: { status_code: 200 },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('const res = await login(');
    expect(js).toContain('equals_(`${res.status_code}`, `200`)');
  });

  it('expect generates multiple checks in field order', async () => {
    const ctx: TestContext = {
      name: 'callExpectOrder',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: 200, token: '!= null' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    const statusIdx = js.indexOf('equals_(`${_login_0.status_code}`, `200`)');
    const tokenIdx = js.indexOf('notEquals_(`${_login_0.token}`, `null`)');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(tokenIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeLessThan(tokenIdx);
  });

  it('expect is non-throwing (no assertion failure throw)', async () => {
    const ctx: TestContext = {
      name: 'callExpectNoThrow',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: 200 },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // expect uses check (non-throwing) behavior, not assert
    expect(js).toContain("checkExpects_(");
    expect(js).toContain("'check'");
    expect(js).not.toContain("'assert'");
  });

  it('handles plain string expect value (default equality)', async () => {
    const ctx: TestContext = {
      name: 'callExpectStr',
      test: {
        steps: [{
          call: 'login',
          expect: { name: 'alice' },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_login_0.name}`, `alice`)');
  });

  it('handles boolean expect value', async () => {
    const ctx: TestContext = {
      name: 'callExpectBool',
      test: {
        steps: [{
          call: 'login',
          expect: { active: true },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('equals_(`${_login_0.active}`, `true`)');
  });

  it('uses step title in generated checks when provided', async () => {
    const ctx: TestContext = {
      name: 'callExpectTitle',
      test: {
        steps: [{
          call: 'login',
          title: 'Login validation',
          expect: { status_code: 200 },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('Login validation');
  });

  it('passes report config to generated checks', async () => {
    const ctx: TestContext = {
      name: 'callExpectReport',
      test: {
        steps: [{
          call: 'login',
          expect: { status_code: 200 },
          report: 'none',
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    // With report: 'none', the check_ helper will suppress reporting at runtime
    expect(js).toContain("'none'");
  });

  it('uses call alias as fallback title when no step title', async () => {
    const ctx: TestContext = {
      name: 'callExpectFallback',
      test: {
        steps: [{
          call: 'verifyUser',
          expect: { status_code: 200 },
        } as any],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('verifyUser');
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

describe('same-name file imports', () => {
  it('generates correct code when importing a file with the same basename via +/ path', async () => {
    // Scenario: regression/create_session.mmt imports +/smoke/create_session.mmt
    // which itself imports +/api/login.mmt
    const mock = createTestFileLoaderMock({
      '/project/smoke/create_session.mmt': [
        'type: test',
        'title: Create Session',
        'import:',
        '  login: +/api/login.mmt',
        'inputs:',
        '  username: ""',
        '  password: ""',
        'steps:',
        '  - call: login',
        '    inputs:',
        '      username: i:username',
        '      password: i:password',
      ].join('\n'),
      '/project/api/login.mmt': [
        'type: api',
        'protocol: http',
        'method: POST',
        'url: http://example.com/login',
      ].join('\n'),
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {create_session: '+/smoke/create_session.mmt'},
        steps: [
          {call: 'create_session', inputs: {username: 'user@test.com', password: '123'}} as any,
        ],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/project/regression/create_session.mmt',
      projectRoot: '/project',
    });

    // The imported smoke create_session function must be defined
    expect(js).toContain('const create_session_ = async');
    // The API login function must be defined
    expect(js).toContain('const login_ = async');
    // The root function must wire up the alias correctly
    expect(js).toContain('const create_session = create_session_');
    // The login alias inside the smoke test must be wired
    expect(js).toContain('const login = login_');
  });

  it('generates distinct function names when two files share the same basename', async () => {
    const mock = createTestFileLoaderMock({
      '/project/a/helper.mmt': 'type: test\ntitle: Helper A\nsteps:\n  - print: a\n',
      '/project/b/helper.mmt': 'type: test\ntitle: Helper B\nsteps:\n  - print: b\n',
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {
          helperA: '/project/a/helper.mmt',
          helperB: '/project/b/helper.mmt',
        },
        steps: [
          {call: 'helperA'} as any,
          {call: 'helperB'} as any,
        ],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/project/main.mmt',
    });

    // Both functions must exist with distinct names
    expect(js).toContain('const helper_ = async');
    expect(js).toContain('const helper_1_ = async');
    // Aliases must point to the correct distinct functions
    expect(js).toContain('const helperA = helper_');
    expect(js).toContain('const helperB = helper_1_');
  });

  it('resolves nested +/ imports correctly in alias maps', async () => {
    // Parent imports child via +/, child imports grandchild via +/
    const mock = createTestFileLoaderMock({
      '/project/tests/child.mmt': [
        'type: test',
        'import:',
        '  api: +/apis/shared.mmt',
        'steps:',
        '  - call: api',
      ].join('\n'),
      '/project/apis/shared.mmt': [
        'type: api',
        'protocol: http',
        'method: GET',
        'url: http://example.com',
      ].join('\n'),
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {child: '+/tests/child.mmt'},
        steps: [{call: 'child'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/project/runner.mmt',
      projectRoot: '/project',
    });

    // The API function must be emitted
    expect(js).toContain('const shared_ = async');
    // The child test must use the correct alias for the API
    expect(js).toContain('const api = shared_');
    // The root must wire up the child alias
    expect(js).toContain('const child = child_');
  });

  it('handles files with same titles imported from different directories', async () => {
    const mock = createTestFileLoaderMock({
      '/project/auth/login.mmt': [
        'type: test',
        'title: Login Flow',
        'steps:',
        '  - print: auth login',
      ].join('\n'),
      '/project/admin/login.mmt': [
        'type: test',
        'title: Login Flow',
        'steps:',
        '  - print: admin login',
      ].join('\n'),
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {
          authLogin: '/project/auth/login.mmt',
          adminLogin: '/project/admin/login.mmt',
        },
        steps: [
          {call: 'authLogin'} as any,
          {call: 'adminLogin'} as any,
        ],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/project/main.mmt',
    });

    // Both must exist with distinct names (same basename → collision suffix)
    expect(js).toContain('const login_ = async');
    expect(js).toContain('const login_1_ = async');
    // Aliases must be correctly assigned
    expect(js).toContain('const authLogin = login_');
    expect(js).toContain('const adminLogin = login_1_');
  });

  it('handles deeply nested imports where intermediate file shares name with leaf', async () => {
    // root imports setup.mmt, which imports api/setup.mmt (same basename)
    const mock = createTestFileLoaderMock({
      '/project/tests/setup.mmt': [
        'type: test',
        'import:',
        '  api_setup: +/api/setup.mmt',
        'steps:',
        '  - call: api_setup',
      ].join('\n'),
      '/project/api/setup.mmt': [
        'type: api',
        'protocol: http',
        'method: POST',
        'url: http://example.com/setup',
      ].join('\n'),
    });
    setFileLoader(mock.fileLoader);

    const js = await rootTestToJsfunc({
      name: 'testflow',
      test: {
        import: {setup: '+/tests/setup.mmt'},
        steps: [{call: 'setup'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/project/runner.mmt',
      projectRoot: '/project',
    });

    // Both setup files must get distinct function names
    expect(js).toContain('const setup_ = async');
    expect(js).toContain('const setup_1_ = async');
    // The nested alias must point to the correct function
    expect(js).toContain('const api_setup = setup_1_');
    // The root alias must point to the test setup
    expect(js).toContain('const setup = setup_');
  });
});

describe('auth field (apiToJSfunc)', () => {
  it('generates Bearer Authorization header', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {type: 'bearer', token: 'my-token'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('req_.headers["Authorization"]');
    expect(js).toContain('Bearer');
    expect(js).toContain('my-token');
  });

  it('generates Basic Authorization header', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {type: 'basic', username: 'user', password: 'pass'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('req_.headers["Authorization"]');
    expect(js).toContain('Basic');
    expect(js).toContain('btoa');
  });

  it('generates API key header', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {type: 'api-key', header: 'X-API-Key', value: 'secret123'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('req_.headers["X-API-Key"]');
    expect(js).toContain('secret123');
  });

  it('generates API key query parameter', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {type: 'api-key', query: 'api_key', value: 'secret123'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('req_.query["api_key"]');
    expect(js).toContain('secret123');
  });

  it('generates OAuth2 client_credentials token fetch', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {
          type: 'oauth2', grant: 'client_credentials',
          token_url: 'https://auth.example.com/token',
          client_id: 'my_id', client_secret: 'my_secret', scope: 'read write',
        },
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('grant_type');
    expect(js).toContain('client_credentials');
    expect(js).toContain('auth.example.com/token');
    expect(js).toContain('_tokenData.access_token');
  });

  it('does not override explicit Authorization header', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        headers: {Authorization: 'Custom xyz'},
        auth: {type: 'bearer', token: 'my-token'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    // explicit header is in the initial headers object
    expect(js).toContain('"Authorization"');
    expect(js).toContain('Custom xyz');
    // auth guard: only set if not present
    expect(js).toContain('if (!req_.headers["Authorization"])');
  });

  it('auth: none generates no auth code', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: 'none',
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).not.toContain('req_.headers["Authorization"]');
  });

  it('env variable substitution works in auth token', async () => {
    const ctx: APIContext = {
      api: {
        type: 'api', url: 'https://api.example.com', method: 'get', format: 'json',
        auth: {type: 'bearer', token: '<<e:token>>'},
      } as any,
      name: 'myApi', inputs: {}, envVars: {},
    };
    const js = await apiToJSfunc(ctx);
    expect(js).toContain('envVariables.token');
  });
});

describe('validateAuth', () => {
  it('returns undefined for undefined input', () => {
    expect(validateAuth(undefined)).toBeUndefined();
  });

  it('returns none for "none" string', () => {
    expect(validateAuth('none')).toBe('none');
  });

  it('validates bearer auth', () => {
    expect(validateAuth({type: 'bearer', token: 'abc'})).toEqual({type: 'bearer', token: 'abc'});
  });

  it('throws for bearer without token', () => {
    expect(() => validateAuth({type: 'bearer'})).toThrow('token');
  });

  it('validates basic auth', () => {
    expect(validateAuth({type: 'basic', username: 'u', password: 'p'}))
        .toEqual({type: 'basic', username: 'u', password: 'p'});
  });

  it('throws for basic without password', () => {
    expect(() => validateAuth({type: 'basic', username: 'u'})).toThrow('password');
  });

  it('validates api-key with header', () => {
    expect(validateAuth({type: 'api-key', header: 'X-Key', value: 'v'}))
        .toEqual({type: 'api-key', header: 'X-Key', value: 'v'});
  });

  it('validates api-key with query', () => {
    expect(validateAuth({type: 'api-key', query: 'key', value: 'v'}))
        .toEqual({type: 'api-key', query: 'key', value: 'v'});
  });

  it('throws for api-key with both header and query', () => {
    expect(() => validateAuth({type: 'api-key', header: 'X', query: 'q', value: 'v'})).toThrow('exactly one');
  });

  it('throws for api-key without header or query', () => {
    expect(() => validateAuth({type: 'api-key', value: 'v'})).toThrow('header');
  });

  it('throws for invalid auth type', () => {
    expect(() => validateAuth({type: 'unknown'})).toThrow('Must be one of');
  });

  it('throws for non-object auth', () => {
    expect(() => validateAuth(42)).toThrow('expected an object');
  });

  it('validates oauth2', () => {
    const result = validateAuth({
      type: 'oauth2', grant: 'client_credentials',
      token_url: 'https://x', client_id: 'id', client_secret: 's',
    });
    expect(result).toEqual({
      type: 'oauth2', grant: 'client_credentials',
      token_url: 'https://x', client_id: 'id', client_secret: 's',
    });
  });

  it('throws for oauth2 without token_url', () => {
    expect(() => validateAuth({
      type: 'oauth2', grant: 'client_credentials', client_id: 'id', client_secret: 's',
    })).toThrow('token_url');
  });
});
