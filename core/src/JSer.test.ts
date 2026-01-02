import {yamlToAPI} from './apiParsePack';
import {apiToJSfunc, rootTestToJsfunc, testToJsfunc,} from './JSer';
import {APIContext} from './JSerAPI';
import {setFileLoader} from './JSerFileLoader';
import {importsToJsfunc} from './JSerImports';
import {TestContext, variableReplacer} from './JSerTest';
import {flowStagesToJsfunc} from './JSerTestFlow';
import {createTestFileLoaderMock} from './testFileLoaderMock';

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
    const users = new Function(bundle + '\nreturn users;')();
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

    expect(js).toContain('const users = [');
    expect(js).toMatch(/const imports = \{[^}]*users: users[^}]*\}/);
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

    expect(js).toMatch(/const imports = \{[^}]*users: users[^}]*\}/);
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
    expect(bundle).toContain('const a = async');
    expect(bundle).toContain('const c = async');
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
      const idxSecond = bundle.indexOf('const second = async');
      const idxFirst = bundle.indexOf('const first = async');
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
       expect(bundle).toContain('const a1 = async');
       expect(bundle).toMatch(/const a1_\d+ = async/);
     });

  it('injects `imports` alias object in generated test functions', async () => {
    const mock = createTestFileLoaderMock({
      '/root/main.mmt':
          'type: test\nimport:\n  m: /root/my file.mmt\nsteps:\n  - call: m\n',
      '/root/my file.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);
    const bundle = await importsToJsfunc({main: '/root/main.mmt'});
    // function name should be from filename "my file" => "my_file"
    expect(bundle).toContain('const my_file = async');
    // and an imports object mapping key -> function name for the importing test
    expect(bundle).toContain('const main = async');
    expect(bundle).toMatch(/const main[\s\S]*const imports = \{[\s\S]*m: my_file[\s\S]*\};/);
  });

  it('does not error when a test has no imports', async () => {
    const mock = createTestFileLoaderMock({
      '/root/noimp.mmt': 'type: test\nsteps:\n  - print: hi\n',
    });
    setFileLoader(mock.fileLoader);
    const bundle = await importsToJsfunc({main: '/root/noimp.mmt'});
    expect(bundle).toContain('const noimp = async');
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
    expect(js).toContain('const testflow = async');
    expect(js).toContain('kxxx: txxx');
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

    expect(js).toContain('kxxx: txxx');
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

  it('supports object-form check and assert with message', async () => {
    const ctx: TestContext = {
      name: 'objectCheckAssert',
      test: {
        steps: [
          {check: {actual: 1, expected: 2, operator: '==', message: 'm1'}},
          {assert: {actual: 'x', expected: 3, operator: '>=', message: 'm2'}},
        ],
      } as any,
      inputs: {},
      envVars: {},
    };
    const js = await testToJsfunc(ctx, true);
    expect(js).toContain('m1');
    expect(js).toContain('m2');
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
    // url should interpolate env without double wrapping
    expect(js).toContain('url: `http://${envVariables.HOST}/login`');
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
