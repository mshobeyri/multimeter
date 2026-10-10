export {};

describe('env autocomplete rebuilds e: suggestions on each load', () => {
  it('replaces prior e: entries instead of appending duplicates', () => {
    jest.resetModules();
    let envCallback: ((vars: any[]) => void)|undefined;
    jest.doMock('../workspaceStorage', () => ({
      loadEnvVariables: (cb: (vars: any[]) => void) => {
        envCallback = cb;
        return () => undefined;
      },
    }));
    (global as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      vscode: {postMessage: jest.fn()},
    };
    const {KeySuggestionsByParent} = require('./AutoComplete');
    const monaco = {
      languages: {
        CompletionItemKind: {
          Keyword: 1,
          Function: 2,
          EnumMember: 3,
          Property: 4,
          Variable: 5,
          Operator: 6,
        },
        CompletionItemInsertTextRule: {InsertAsSnippet: 4},
      },
    };
    const byParent = KeySuggestionsByParent(monaco);
    expect(typeof envCallback).toBe('function');

    envCallback!([{name: 'sss', label: 'sss', value: 12}]);
    envCallback!([
      {name: 'sss', label: 'sss', value: 12},
      {name: 'sss', label: 'dup', value: 99},
    ]);
    envCallback!([{name: 'sss', label: 'sss', value: 12}]);

    const envLabels = (byParent.general || [])
        .map((item: any) => item.label)
        .filter((label: string) => label === 'e:sss');
    expect(envLabels).toEqual(['e:sss']);
  });
});
