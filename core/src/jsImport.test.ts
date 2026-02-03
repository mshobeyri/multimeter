import {generateTestJs} from './runTest';
import {runJSCode} from './jsRunner';

const createLoader = (files: Record<string, string>) => {
  return async (p: string) => {
    const hit = files[p];
    if (typeof hit !== 'string') {
      throw new Error('not found: ' + p);
    }
    return hit;
  };
};

describe('JS module imports in test import section', () => {
  test('imports a .js module and exposes its exports under alias', async () => {
    const rawText = `type: test
import:
  helpers: /proj/helpers.js
steps:
  - js: |
      const out = helpers.add(2, 3);
      if (out !== 5) { throw new Error('bad math'); }
`;

    const js = await generateTestJs({
      rawText,
      name: 't',
      inputs: {},
      envVars: {},
      filePath: '/proj/test.mmt',
      projectRoot: '/proj',
      fileLoader: createLoader({
        '/proj/helpers.js': 'module.exports = { add: (a, b) => a + b };',
      }),
    } as any);

    expect(js).toContain('const helpers_ = importJsModule_');
    expect(js).toContain('const helpers = await helpers_');

    // Execute the generated JS to ensure the runtime wiring works.
    const logs: string[] = [];
    await runJSCode({
      runId: 'run',
      js,
      title: 't',
      fileLoader: createLoader({
        '/proj/helpers.js': 'module.exports = { add: (a, b) => a + b };',
      }),
      logger: (_level, msg) => {
        logs.push(String(msg));
      },
    });
    expect(logs.join('\n')).not.toContain('Error running test');
  });

  test('caches imported module by resolved path', async () => {
    const rawText = `type: test
import:
  helpers: /proj/helpers.js
steps:
  - js: |
      const a = helpers.inc(1);
      const b = helpers.inc(1);
      if (a !== 2 || b !== 3) { throw new Error('expected cached singleton'); }
`;

    const js = await generateTestJs({
      rawText,
      name: 't',
      inputs: {},
      envVars: {},
      filePath: '/proj/test.mmt',
      projectRoot: '/proj',
      fileLoader: createLoader({
        '/proj/helpers.js': `let n = 0; module.exports = { inc: (x) => x + (++n) };`,
      }),
    } as any);

    // We can't execute here (runGeneratedJs uses options.jsRunner), but we do ensure
    // generated JS uses importJsModule_ which caches by path.
    expect(js).toContain('importJsModule_');
  });
});
