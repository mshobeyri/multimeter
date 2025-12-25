jest.mock('vscode', () => {
  const fs = require('fs');
  const path = require('path');
  return {
    Uri: {
      file: (p: string) => ({fsPath: path.resolve(p)}),
    },
    workspace: {
      fs: {
        readFile: async (uri: {fsPath: string}) => fs.promises.readFile(uri.fsPath),
      },
    },
  };
}, {virtual: true});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {parseAssistantRunArgs} from './assistantArgs';

interface TempContext {
  workspaceState: {
    get: jest.Mock<any, any>;
  };
}

describe('parseAssistantRunArgs', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, {recursive: true, force: true});
      }
    }
  });

  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-args-'));
    tempDirs.push(dir);
    return dir;
  }

  it('parses manual inputs, environment options, and workspace env state', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'api.mmt');
    const fileContents = 'type: api\nname: example';
    fs.writeFileSync(filePath, fileContents, 'utf8');

    const envPath = path.join(dir, 'envs.mmt');
    fs.writeFileSync(envPath, `type: env\nvariables:\n  API_URL:\n    dev: http://dev.example.com\n    prod: http://prod.example.com\n  AUTH_TOKEN:\n    default: authToken\npresets:\n  runner:\n    dev:\n      API_URL: dev\n      AUTH_TOKEN: default\n`, 'utf8');

    const extraPath = path.join(dir, 'extra.txt');
    fs.writeFileSync(extraPath, 'extra-data', 'utf8');

    const context: TempContext = {
      workspaceState: {
        get: jest.fn().mockReturnValue([
          {name: 'LOCAL_ONLY', value: 'from-context'},
          {name: 'UNUSED', value: 'value'},
        ]),
      },
    };

    const prompt = `${filePath} --input limit=5 --env debug=true --env-file ${path.basename(envPath)} --preset runner.dev --print-js --out output.log`;

    const result = await parseAssistantRunArgs(dir, prompt, context as any);

    expect(result.printJs).toBe(true);
    expect(result.outFile).toBe('output.log');

    const {runFileOptions} = result;
    expect(runFileOptions.filePath).toBe(filePath);
    expect(runFileOptions.file).toBe(fileContents);
    expect(runFileOptions.manualInputs).toEqual({limit: 5});
    expect(runFileOptions.manualEnvvars).toEqual({debug: true});
    expect(runFileOptions.envvar).toEqual({
      LOCAL_ONLY: 'from-context',
      UNUSED: 'value',
      debug: true,
      API_URL: 'http://dev.example.com',
      AUTH_TOKEN: 'authToken',
    });

    const loaderResult = await runFileOptions.fileLoader('extra.txt');
    expect(loaderResult).toBe('extra-data');
  });

  it('supports short -i and -e flags', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'api.mmt');
    fs.writeFileSync(filePath, 'type: api\nname: short-flags', 'utf8');

    const context: TempContext = {
      workspaceState: {get: jest.fn().mockReturnValue([])},
    };

    const prompt = `${filePath} -i limit 5 -i token=abc123 -e certificate=sss -e stage beta -o result.json`;
    const result = await parseAssistantRunArgs(dir, prompt, context as any);

    expect(result.outFile).toBe('result.json');
    expect(result.runFileOptions.manualInputs).toEqual({limit: 5, token: 'abc123'});
    expect(result.runFileOptions.manualEnvvars).toEqual({certificate: 'sss', stage: 'beta'});
  });

  it('throws when no file argument is provided', async () => {
    const context: TempContext = {
      workspaceState: {get: jest.fn().mockReturnValue([])},
    };

    await expect(parseAssistantRunArgs('/tmp', '', context as any))
        .rejects.toThrow(/Usage: \/run/);
  });
});
