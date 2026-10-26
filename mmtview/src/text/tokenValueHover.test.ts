import {clearGitCurrentSnapshot, setGitCurrentSnapshot} from 'mmt-core/tokens/Current';
import {
  clearTokenFieldPreviewRandomCache,
  projectTokenFieldPreview,
  seedTokenFieldPreviewFromRequest,
} from 'mmt-core/tokens/bodyRuntimeTokens';

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
    clearTokenFieldPreviewRandomCache();
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

  it('reuses the field-preview cache for r: and seeded c:', () => {
    seedTokenFieldPreviewFromRequest(
        {
          url: 'https://x/{{r:uuid}}',
          headers: {stamp: 'c:time'},
          body: {id: 'r:uuid'},
        },
        {
          url: 'https://x/url-id',
          headers: {stamp: '01:02:03'},
          body: {id: 'body-id'},
        },
    );
    const content =
        'url: https://x/<<r:uuid>>\nheaders:\n  stamp: c:time\nbody:\n  id: r:uuid\n';
    const urlOffset = content.indexOf('<<r:uuid>>');
    const bodyOffset = content.lastIndexOf('r:uuid');
    const stampOffset = content.indexOf('c:time');
    expect(resolveDynamicTokenHoverValue('r:uuid', {content, offset: urlOffset}))
        .toBe('url-id');
    expect(resolveDynamicTokenHoverValue(
               'r:uuid', {content, offset: bodyOffset}))
        .toBe('body-id');
    expect(resolveDynamicTokenHoverValue(
               'c:time', {content, offset: stampOffset}))
        .toBe('01:02:03');
  });

  it('shares the first mint between hover and telescope preview', () => {
    const fromHover = resolveDynamicTokenHoverValue('r:uuid');
    expect(projectTokenFieldPreview('{{r:uuid}}', {env: {}, inputs: {}}).text)
        .toBe(String(fromHover));

    clearTokenFieldPreviewRandomCache();
    const fromUi =
        projectTokenFieldPreview('{{r:uuid}}', {env: {}, inputs: {}}).text;
    expect(resolveDynamicTokenHoverValue('r:uuid')).toBe(fromUi);
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
