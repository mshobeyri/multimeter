import {runFile} from './runner';
import {runJSCode} from './jsRunner';

describe('file-backed env values (./…mmt)', () => {
  const files: Record<string, string> = {
    '/tmp/live/env.mmt': [
      'type: env',
      'variables:',
      '  session: ./create_session.mmt',
      '  host: https://example.com',
    ].join('\n'),
    '/tmp/live/create_session.mmt': [
      'type: test',
      'outputs:',
      '  session: from-create',
      '  other: ignored',
      'cache: 1h',
      'steps:',
      '  - set:',
      '      o:session: from-create',
      '      o:other: ignored',
    ].join('\n'),
    '/tmp/live/consumer.mmt': [
      'type: test',
      'steps:',
      '  - check: e:session == from-create',
      '  - check: e:host == https://example.com',
    ].join('\n'),
  };

  const fileLoader = async (p: string) => files[p] ?? '';

  it('runs ./…mmt and uses the first YAML outputs key', async () => {
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live/consumer.mmt',
      filePath: '/tmp/live/consumer.mmt',
      fileLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {
        session: './create_session.mmt',
        host: 'https://example.com',
      },
      envvarFilePath: '/tmp/live/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
  });

  it('setenv of ./path.mmt stays a plain string, not a getter', async () => {
    files['/tmp/live/setenv_path.mmt'] = [
      'type: test',
      'steps:',
      '  - setenv:',
      '      session: ./create_session.mmt',
      '  - check: e:session == ./create_session.mmt',
    ].join('\n');
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live/setenv_path.mmt',
      filePath: '/tmp/live/setenv_path.mmt',
      fileLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {session: 'old'},
      envvarFilePath: '/tmp/live/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
  });

  it('respects cache: on the target file across repeated e: reads', async () => {
    let runs = 0;
    const countingLoader = async (p: string) => {
      if (p.endsWith('create_session.mmt')) {
        runs += 1;
      }
      return files[p] ?? '';
    };
    files['/tmp/live/twice.mmt'] = [
      'type: test',
      'steps:',
      '  - check: e:session == from-create',
      '  - check: e:session == from-create',
    ].join('\n');
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live/twice.mmt',
      filePath: '/tmp/live/twice.mmt',
      fileLoader: countingLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {session: './create_session.mmt'},
      envvarFilePath: '/tmp/live/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
    // Target file loaded once for the env-value run (plus possible prepare reads).
    expect(runs).toBeGreaterThanOrEqual(1);
    expect(runs).toBeLessThanOrEqual(3);
  });

  it('does not run unreferenced file-backed env getters during a test', async () => {
    let createLoads = 0;
    const countingLoader = async (p: string) => {
      if (p.endsWith('create_session.mmt')) {
        createLoads += 1;
      }
      return files[p] ?? '';
    };
    files['/tmp/live/unrelated.mmt'] = [
      'type: test',
      'steps:',
      '  - check: 1 == 1',
    ].join('\n');
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live/unrelated.mmt',
      filePath: '/tmp/live/unrelated.mmt',
      fileLoader: countingLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {
        session: './create_session.mmt',
        host: 'https://example.com',
      },
      envvarFilePath: '/tmp/live/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
    expect(createLoads).toBe(0);
  });

  it('soft-fails when a referenced file-backed env target is missing', async () => {
    files['/tmp/live/missing_target.mmt'] = [
      'type: test',
      'steps:',
      '  - check: e:session == null',
    ].join('\n');
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live/missing_target.mmt',
      filePath: '/tmp/live/missing_target.mmt',
      fileLoader: async (p: string) => {
        if (p.endsWith('create_session.mmt')) {
          return '';
        }
        return files[p] ?? '';
      },
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {session: './create_session.mmt'},
      envvarFilePath: '/tmp/live/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
    expect(String(res.result.errors || [])).not.toContain(
        'supported for test or api');
  });
});
