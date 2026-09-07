import {
  buildDownloadUrl,
  compareVersions,
  detectInstallChannel,
  detectPlatform,
  normalizeVersion,
  planUpdate,
} from './selfUpdate';

describe('selfUpdate helpers', () => {
  it('normalizes and compares versions', () => {
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(-1);
  });

  it('detects platforms', () => {
    expect(detectPlatform('darwin', 'arm64')).toBe('macos-arm64');
    expect(detectPlatform('linux', 'x64')).toBe('linux-x64');
    expect(detectPlatform('win32', 'arm64')).toBe('win-x64');
  });

  it('detects install channels', () => {
    expect(detectInstallChannel('/usr/local/bin/testlight')).toBe('standalone');
    expect(detectInstallChannel(
               '/opt/homebrew/Cellar/mmt-testlight/0.4.4/bin/testlight'))
        .toBe('homebrew');
    expect(detectInstallChannel(
               '/usr/local/bin/node',
               '/usr/local/lib/node_modules/mmt-testlight/dist/cli.js'))
        .toBe('npm');
  });

  it('builds github and portal download urls', () => {
    expect(buildDownloadUrl({version: '1.2.3', platform: 'linux-x64'}))
        .toBe(
            'https://github.com/mshobeyri/multimeter/releases/download/v1.2.3/testlight-linux-x64.tar.gz');
    expect(buildDownloadUrl({
      version: '1.2.3',
      platform: 'win-x64',
      releaseBaseUrl: 'https://portal.example/testlight',
    })).toBe('https://portal.example/testlight/v1.2.3/testlight-win-x64.zip');
  });

  it('plans npm advice instead of binary replace', async () => {
    const plan = await planUpdate({
      currentVersion: '0.4.0',
      version: '0.4.4',
      execPath: '/usr/local/bin/node',
      scriptPath: '/usr/local/lib/node_modules/mmt-testlight/dist/cli.js',
      fetchJson: async () => ({tag_name: 'v0.4.4'}),
    });
    expect(plan.action).toBe('advise-npm');
    expect(plan.advice).toContain('npm install -g mmt-testlight@0.4.4');
  });

  it('plans noop when already current', async () => {
    const plan = await planUpdate({
      currentVersion: '1.2.3',
      version: '1.2.3',
      execPath: '/usr/local/bin/testlight',
      fetchJson: async () => ({tag_name: 'v1.2.3'}),
    });
    expect(plan.action).toBe('noop');
  });

  it('plans download for standalone when newer', async () => {
    const plan = await planUpdate({
      currentVersion: '1.0.0',
      version: '1.2.3',
      execPath: '/opt/portal/bin/testlight',
      fetchJson: async () => ({tag_name: 'v1.2.3'}),
    });
    expect(plan.action).toBe('download');
    expect(plan.downloadUrl).toContain('/v1.2.3/testlight-');
  });
});
