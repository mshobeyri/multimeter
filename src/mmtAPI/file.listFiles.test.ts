import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {handleListFiles} from './file';

jest.mock('./network', () => ({
  resolveWorkspaceEnvFilePath: () => undefined,
}));

jest.mock('vscode', () => ({
  workspace: {workspaceFolders: undefined},
}), {virtual: true});

describe('handleListFiles +/ project-root browsing', () => {
  let tmpRoot = '';
  let projectRoot = '';
  let docPath = '';

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-listfiles-'));
    projectRoot = path.join(tmpRoot, 'project');
    const testsDir = path.join(projectRoot, 'tests');
    const apisDir = path.join(projectRoot, 'apis');
    fs.mkdirSync(testsDir, {recursive: true});
    fs.mkdirSync(apisDir, {recursive: true});
    fs.writeFileSync(path.join(projectRoot, 'multimeter.mmt'), 'type: env\n');
    fs.writeFileSync(path.join(testsDir, 'login.mmt'), 'type: test\n');
    fs.writeFileSync(path.join(apisDir, 'users.mmt'), 'type: api\n');
    docPath = path.join(testsDir, 'suite.mmt');
    fs.writeFileSync(docPath, 'type: test\n');
  });

  afterEach(() => {
    if (tmpRoot) {
      fs.rmSync(tmpRoot, {recursive: true, force: true});
    }
  });

  it('lists importable files from project root when folder is +/', () => {
    const posted: any[] = [];
    const webviewPanel = {
      webview: {
        postMessage: (msg: any) => posted.push(msg),
      },
    };
    const document = {uri: {fsPath: docPath}};

    handleListFiles({folder: '+/', recursive: true}, webviewPanel as any, document as any);

    expect(posted).toHaveLength(1);
    expect(posted[0].command).toBe('listFilesResult');
    expect(posted[0].folder).toBe('+/');
    const files = posted[0].files as string[];
    expect(files).toEqual(expect.arrayContaining([
      '+/tests/login.mmt',
      '+/apis/users.mmt',
    ]));
  });

  it('lists files under a nested +/ folder prefix', () => {
    const posted: any[] = [];
    const webviewPanel = {
      webview: {
        postMessage: (msg: any) => posted.push(msg),
      },
    };
    const document = {uri: {fsPath: docPath}};

    handleListFiles({folder: '+/apis/', recursive: true}, webviewPanel as any, document as any);

    expect(posted).toHaveLength(1);
    expect(posted[0].files).toEqual(['+/apis/users.mmt']);
  });

  it('returns empty results when project root cannot be resolved', () => {
    const outsideDoc = path.join(tmpRoot, 'orphan', 'test.mmt');
    fs.mkdirSync(path.dirname(outsideDoc), {recursive: true});
    fs.writeFileSync(outsideDoc, 'type: test\n');

    const posted: any[] = [];
    const webviewPanel = {
      webview: {
        postMessage: (msg: any) => posted.push(msg),
      },
    };
    const document = {uri: {fsPath: outsideDoc}};

    handleListFiles({folder: '+/', recursive: true}, webviewPanel as any, document as any);

    expect(posted).toEqual([{command: 'listFilesResult', folder: '+/', files: []}]);
  });
});
