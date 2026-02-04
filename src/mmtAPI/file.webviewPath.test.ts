import {readRelativeFileContent} from './file';

jest.mock('vscode', () => {
  return {
    Uri: {
      file: (p: string) => ({fsPath: p, toString: () => p}),
      parse: (u: string) => {
        // Minimal `file:` URI support for tests
        if (typeof u === 'string' && u.toLowerCase().startsWith('file:')) {
          const withoutScheme = u.replace(/^file:\/+?/i, '');
          // `file:///C:/x` -> `C:/x`
          return {fsPath: withoutScheme.replace(/^\/?([a-zA-Z]:)/, '$1')};
        }
        return {fsPath: u};
      },
    },
    workspace: {
      openTextDocument: async (_uri: any) => ({getText: () => 'ok'}),
    },
    window: {
      showErrorMessage: () => {},
    },
  };
}, {virtual: true});

describe('readRelativeFileContent webview path normalization', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    // Force Windows for these scenarios
    Object.defineProperty(process, 'platform', {value: 'win32'});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {value: originalPlatform});
  });

  it('handles percent-encoded drive paths from webview (/c%3A/...)', async () => {
    const base = 'C:/proj/tests/test.mmt';
    const content = await readRelativeFileContent(base, '/c%3A/proj/shared/extra.mmt');
    expect(content).toBe('ok');
  });

  it('handles /C:/... style absolute paths on Windows', async () => {
    const base = 'C:/proj/tests/test.mmt';
    const content = await readRelativeFileContent(base, '/C:/proj/shared/extra.mmt');
    expect(content).toBe('ok');
  });

  it('handles file:/// URIs from webview', async () => {
    const base = 'C:/proj/tests/test.mmt';
    const content = await readRelativeFileContent(base, 'file:///C:/proj/shared/extra.mmt');
    expect(content).toBe('ok');
  });
});
