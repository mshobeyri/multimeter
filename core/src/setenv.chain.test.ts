import {runFile} from './runner';
import {runJSCode} from './jsRunner';

const files: Record<string, string> = {
  '/tmp/chain/suite.mmt':
      `type: suite\nitems:\n  - setter.mmt\n  - then\n  - reader.mmt\n`,
  '/tmp/chain/setter.mmt':
      `type: test\nimport:\n  prep: ./prep.mmt\nsteps:\n  - call: prep\n  - check: e:from_import == imported\n  - setenv:\n      token: abc\n`,
  '/tmp/chain/prep.mmt':
      `type: test\nsteps:\n  - setenv:\n      from_import: imported\n`,
  '/tmp/chain/reader.mmt':
      `type: test\nsteps:\n  - check: e:token == abc\n  - check: e:from_import == imported\n`,
};

const fileLoader = async (p: string) => files[p] ?? '';

const run = (file: string, manualEnvvars?: Record<string, any>) => runFile({
  fileType: 'path',
  file,
  filePath: file,
  fileLoader,
  jsRunner: runJSCode,
  logger: () => {},
  reporter: () => {},
  envvar: {token: 'old'},
  manualEnvvars,
} as any);

describe('setenv visibility', () => {
  it('is visible to later steps, imported tests and later suite items', async () => {
    const res = await run('/tmp/chain/suite.mmt');
    expect(res.result.success).toBe(true);
  });

  it('beats manual env values for later suite items', async () => {
    const res = await run('/tmp/chain/suite.mmt', {token: 'manual'});
    expect(res.result.success).toBe(true);
  });

  it('is not visible to a later item when nothing set it', async () => {
    files['/tmp/chain/solo.mmt'] =
        `type: test\nsteps:\n  - check: e:token == abc\n`;
    const res = await run('/tmp/chain/solo.mmt');
    expect(res.result.success).toBe(false);
  });
});
