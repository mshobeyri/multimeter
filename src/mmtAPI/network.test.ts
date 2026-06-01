jest.mock('vscode', () => {
  const configuration = {
    get: jest.fn((name: string, defaultValue: any) => {
      if (name === 'workspaceEnvFile') {
        return '';
      }
      return defaultValue;
    }),
  };

  return {
    workspace: {
      getConfiguration: jest.fn(() => configuration),
      workspaceFolders: [],
    },
    window: {
      showErrorMessage: jest.fn(),
    },
  };
}, {virtual: true});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {prepareNetworkConfigForFile} from './network';

describe('prepareNetworkConfigForFile certificate settings', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, {recursive: true, force: true});
      }
    }
    jest.clearAllMocks();
  });

  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-network-'));
    tempDirs.push(dir);
    return dir;
  }

  function writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, content, 'utf8');
  }

  function createContext(certSettings: any, storageCerts: any = {}) {
    return {
      workspaceState: {
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'multimeter.certificates.settings') {
            return certSettings;
          }
          if (key === 'multimeter.certificates.storage') {
            return storageCerts;
          }
          return defaultValue;
        }),
      },
    } as any;
  }

  it('uses env-file certificate paths while honoring local toggle settings', () => {
    const dir = createTempDir();
    (vscode.workspace.workspaceFolders as any) = [{uri: {fsPath: dir}}];

    const apiFilePath = path.join(dir, 'tests', 'login.mmt');
    writeFile(apiFilePath, 'type: test\nname: login');

    const caPath = path.join(dir, 'certs', 'ca.cer');
    const certPath = path.join(dir, 'certs', 'client.cer');
    const keyPath = path.join(dir, 'certs', 'client.key');
    writeFile(caPath, 'env-ca');
    writeFile(certPath, 'env-cert');
    writeFile(keyPath, 'env-key');

    writeFile(
        path.join(dir, 'multimeter.mmt'),
        [
          'type: env',
          'variables:',
          '  CERT_PASS: from-file',
          'certificates:',
          '  server_ca:',
          '    paths:',
          '      - ./certs/ca.cer',
          '  clients:',
          '    - name: mtls',
          '      host: "*:8085"',
          '      cert: ./certs/client.cer',
          '      key: ./certs/client.key',
          '      passphrase_env: CERT_PASS',
        ].join('\n'),
    );

    const context = createContext(
        {
          sslValidation: false,
          allowSelfSigned: true,
          caEnabled: true,
          clientsEnabled: {'mtls:*:8085': true},
        },
        {
          server_ca: {paths: ['/tmp/storage-ca.cer']},
          clients: [{name: 'storage', host: '*', cert: '/tmp/storage-cert', key: '/tmp/storage-key'}],
        },
    );

    const config = prepareNetworkConfigForFile(
        apiFilePath,
        {CERT_PASS: 'from-override'},
        context,
    );

    expect(config.sslValidation).toBe(false);
    expect(config.allowSelfSigned).toBe(true);
    expect(config.ca.enabled).toBe(true);
    expect(config.ca.certData).toHaveLength(1);
    expect(config.ca.certData?.[0].toString('utf8')).toBe('env-ca');
    expect(config.clients).toHaveLength(1);
    expect(config.clients[0].enabled).toBe(true);
    expect(config.clients[0].certData?.toString('utf8')).toBe('env-cert');
    expect(config.clients[0].keyData?.toString('utf8')).toBe('env-key');
    expect(config.clients[0].passphrase_plain).toBe('from-override');
  });

  it('does not load CA or client cert bytes when local toggles disable them', () => {
    const dir = createTempDir();
    (vscode.workspace.workspaceFolders as any) = [{uri: {fsPath: dir}}];

    const apiFilePath = path.join(dir, 'tests', 'login.mmt');
    writeFile(apiFilePath, 'type: test\nname: login');
    writeFile(path.join(dir, 'certs', 'ca.cer'), 'env-ca');
    writeFile(path.join(dir, 'certs', 'client.cer'), 'env-cert');
    writeFile(path.join(dir, 'certs', 'client.key'), 'env-key');
    writeFile(
        path.join(dir, 'multimeter.mmt'),
        [
          'type: env',
          'certificates:',
          '  server_ca:',
          '    paths:',
          '      - ./certs/ca.cer',
          '  clients:',
          '    - name: mtls',
          '      host: api.example.com',
          '      cert: ./certs/client.cer',
          '      key: ./certs/client.key',
        ].join('\n'),
    );

    const context = createContext({
      sslValidation: true,
      allowSelfSigned: false,
      caEnabled: false,
      clientsEnabled: {'mtls:api.example.com': false},
    });

    const config = prepareNetworkConfigForFile(apiFilePath, undefined, context);

    expect(config.ca.enabled).toBe(false);
    expect(config.ca.certData).toBeUndefined();
    expect(config.clients).toHaveLength(1);
    expect(config.clients[0].enabled).toBe(false);
    expect(config.clients[0].certData).toBeUndefined();
    expect(config.clients[0].keyData).toBeUndefined();
  });

  it('discovers nearest env.mmt and enables file certificates when no local toggles exist', () => {
    const dir = createTempDir();
    (vscode.workspace.workspaceFolders as any) = [{uri: {fsPath: dir}}];

    const apiFilePath = path.join(dir, 'examples', 'mtls_mock_server', 'test', 'secure_health_test.mmt');
    const exampleRoot = path.dirname(path.dirname(apiFilePath));
    writeFile(apiFilePath, 'type: test\nname: secure health');
    writeFile(path.join(exampleRoot, 'certs', 'ca.crt'), 'env-ca');
    writeFile(path.join(exampleRoot, 'certs', 'client.crt'), 'env-cert');
    writeFile(path.join(exampleRoot, 'certs', 'client.key'), 'env-key');
    writeFile(
        path.join(exampleRoot, 'env.mmt'),
        [
          'type: env',
          'certificates:',
          '  server_ca:',
          '    paths:',
          '      - ./certs/ca.crt',
          '  clients:',
          '    - name: mock-client',
          '      host: localhost:9444',
          '      cert: ./certs/client.crt',
          '      key: ./certs/client.key',
        ].join('\n'),
    );

    const context = createContext(undefined);
    const config = prepareNetworkConfigForFile(apiFilePath, undefined, context);

    expect(config.ca.enabled).toBe(true);
    expect(config.ca.certData?.[0].toString('utf8')).toBe('env-ca');
    expect(config.clients).toHaveLength(1);
    expect(config.clients[0].enabled).toBe(true);
    expect(config.clients[0].certData?.toString('utf8')).toBe('env-cert');
    expect(config.clients[0].keyData?.toString('utf8')).toBe('env-key');
  });
});