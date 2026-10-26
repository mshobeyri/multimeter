import {clearGitCurrentSnapshot, setGitCurrentSnapshot} from 'mmt-core/tokens/Current';

import {
  formatTokenHoverValue,
  getDynamicTokenTargetAtPosition,
  resolveDynamicTokenHoverValue,
  setTokenHoverEnvVariables,
} from './tokenValueHover';

function fakeMonaco() {
  return {
    Range: class {
      constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number,
      ) {}
    },
  };
}

function fakeModel(lines: string[]) {
  return {
    getLineContent: (lineNumber: number) => lines[lineNumber - 1] || '',
  };
}

describe('tokenValueHover', () => {
  const monaco = fakeMonaco();

  afterEach(() => {
    setTokenHoverEnvVariables([]);
    clearGitCurrentSnapshot();
  });

  it('resolves e: from the hover env map', () => {
    setTokenHoverEnvVariables([
      {name: 'host', value: 'https://local.mmt.dev'},
      {name: 'age', value: 42},
    ]);
    expect(resolveDynamicTokenHoverValue('e:host')).toBe('https://local.mmt.dev');
    expect(resolveDynamicTokenHoverValue('e:age')).toBe(42);
    expect(resolveDynamicTokenHoverValue('e:missing')).toBeUndefined();
  });

  it('resolves c: from the current snapshot', () => {
    setGitCurrentSnapshot({branch: 'dev', commit: 'abcdef01'});
    expect(resolveDynamicTokenHoverValue('c:branch')).toBe('dev');
    expect(resolveDynamicTokenHoverValue('c:commit_short')).toBe('abcdef01');
  });

  it('resolves r:uuid to a uuid-shaped sample', () => {
    const value = resolveDynamicTokenHoverValue('r:uuid');
    expect(typeof value).toBe('string');
    expect(String(value)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('finds e:/r:/c: targets on a line', () => {
    const content = 'x: e:host\ny: <<c:day>>\nz: {{r:uuid}}\n';
    const model = fakeModel(content.split('\n'));
    expect(getDynamicTokenTargetAtPosition(
               monaco, model, content, {lineNumber: 1, column: 6})?.plain)
        .toBe('e:host');
    expect(getDynamicTokenTargetAtPosition(
               monaco, model, content, {lineNumber: 2, column: 8})?.prefix)
        .toBe('c');
    expect(getDynamicTokenTargetAtPosition(
               monaco, model, content, {lineNumber: 3, column: 8})?.prefix)
        .toBe('r');
  });

  it('formats hover values', () => {
    expect(formatTokenHoverValue('hi')).toBe('hi');
    expect(formatTokenHoverValue(3)).toBe('3');
    expect(formatTokenHoverValue(true)).toBe('true');
    expect(formatTokenHoverValue({a: 1})).toBe('{"a":1}');
  });
});
