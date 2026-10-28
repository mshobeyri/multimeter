import {runFile} from '../runner/runner';
import {runJSCode} from '../runner/jsRunner';

const files: Record<string, string> = {
  '/tmp/os-env/consumer.mmt': [
    'type: test',
    'steps:',
    '  - check: e:api_token == secret-from-os',
    '  - check: e:missing_os == e:missing_os',
  ].join('\n'),
};

describe('OS env $VAR refs in runs', () => {
  it('resolves $VAR via injected processEnv for e: reads', async () => {
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/os-env/consumer.mmt',
      filePath: '/tmp/os-env/consumer.mmt',
      fileLoader: async (p: string) => files[p] ?? '',
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {
        api_token: '$API_TOKEN',
        missing_os: '$NOT_SET_IN_PROCESS',
      },
      processEnv: {API_TOKEN: 'secret-from-os'},
    } as any);
    expect(res.result.success).toBe(true);
  });
});
