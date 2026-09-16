import {buildDocFromApis, prepareRunFromOptions, runFile} from './runner';
import {tagFilterFromLists} from './suiteTagFilter';

jest.mock('./networkCoreNode', () => ({
  send: jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    body: '{}',
    headers: {'content-type': 'application/json'},
    duration: 4,
  })),
  setRunnerNetworkConfig: jest.fn(),
  getRunnerNetworkConfig: jest.fn(() => ({})),
}));

describe('runner extra paths', () => {
  const api = {
    title: 'Echo',
    method: 'GET',
    url: 'https://example.com/echo',
    format: 'json',
  };

  it('builds html and markdown docs', () => {
    const html = buildDocFromApis([api], {title: 'Docs'});
    const md = buildDocFromApis([api], {title: 'Docs', format: 'md'});
    expect(html).toContain('Echo');
    expect(md).toContain('Echo');
  });

  it('loads a path file and treats missing files as empty', async () => {
    const prepared = await prepareRunFromOptions({
      file: '/missing.mmt',
      fileType: 'path',
      filePath: '/missing.mmt',
      fileLoader: async () => {
        throw new Error('ENOENT');
      },
      jsRunner: async () => ({}),
      logger: () => {},
    } as any);
    expect(prepared.rawText).toBe('');
  });

  it('skips a tagged test before execute', async () => {
    const events: any[] = [];
    const result = await runFile({
      file: 'type: test\ntags: [slow]\nsteps:\n  - print: x\n',
      fileType: 'raw',
      filePath: '/t.mmt',
      tagFilter: tagFilterFromLists(['smoke']),
      fileLoader: async () => '',
      jsRunner: async () => {
        throw new Error('should not run');
      },
      logger: () => {},
      reporter: (msg: any) => events.push(msg),
    } as any);
    expect(result.result.itemStatus).toBe('skipped');
    expect(events.some((e) => e.status === 'skipped')).toBe(true);
  });

  it('runs a one-iteration loadtest through runFile', async () => {
    const result = await runFile({
      file: 'type: loadtest\nrepeat: 1\ntest: ./target.mmt\n',
      fileType: 'raw',
      filePath: '/workspace/load.mmt',
      fileLoader: async () => 'type: test\nsteps:\n  - print: ok\n',
      jsRunner: async () => ({}),
      logger: () => {},
      reporter: () => {},
    } as any);
    expect(result.docType).toBe('loadtest');
    expect(result.result.success).toBe(true);
  });

  it('rejects unsupported document types', async () => {
    await expect(runFile({
      file: 'type: env\nvars:\n  A: 1\n',
      fileType: 'raw',
      filePath: '/env.mmt',
      fileLoader: async () => '',
      jsRunner: async () => ({}),
      logger: () => {},
    } as any)).rejects.toThrow(/supported for test or api/);
  });

  it('runs an API file through executeApi', async () => {
    const result = await runFile({
      file: [
        'type: api',
        'title: Echo',
        'url: https://example.com/echo',
        'method: get',
      ].join('\n'),
      fileType: 'raw',
      filePath: '/echo.mmt',
      fileLoader: async () => '',
      jsRunner: async ({code}: {code: string}) => {
        const send_ = async () => ({
          status: 200,
          statusText: 'OK',
          body: '{}',
          headers: {},
          duration: 1,
        });
        const fn = new Function('send_', code);
        return fn(send_);
      },
      logger: () => {},
    } as any);
    expect(result.docType).toBe('api');
  });
});
