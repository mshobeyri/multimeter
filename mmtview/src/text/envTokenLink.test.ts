import {getEnvTokenTargetAtPosition} from './envTokenLink';

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

describe('getEnvTokenTargetAtPosition', () => {
  const monaco = fakeMonaco();

  it('hits a bare e:name in a YAML value', () => {
    const content = 'body:\n  session: e:session_api\n';
    const model = fakeModel(content.split('\n'));
    const hit = getEnvTokenTargetAtPosition(
        monaco, model, content, {lineNumber: 2, column: 16});
    expect(hit?.name).toBe('session_api');
    expect(hit?.range.startColumn).toBe(12);
  });

  it('hits <<e:name>> and {{e:name}} forms', () => {
    const angle = 'x: "<<e:host>>"\n';
    const curly = 'x: "{{e:host}}"\n';
    expect(getEnvTokenTargetAtPosition(
               monaco, fakeModel(angle.split('\n')), angle,
               {lineNumber: 1, column: 10})?.name)
        .toBe('host');
    expect(getEnvTokenTargetAtPosition(
               monaco, fakeModel(curly.split('\n')), curly,
               {lineNumber: 1, column: 10})?.name)
        .toBe('host');
  });

  it('uses the base name when an accessor is present', () => {
    const content = 'url: <<e:service_url[0:8]>>\n';
    const hit = getEnvTokenTargetAtPosition(
        monaco, fakeModel(content.split('\n')), content,
        {lineNumber: 1, column: 12});
    expect(hit?.name).toBe('service_url');
  });

  it('returns null when the cursor is outside any e: token', () => {
    const content = 'session: e:session_api\n';
    expect(getEnvTokenTargetAtPosition(
               monaco, fakeModel(content.split('\n')), content,
               {lineNumber: 1, column: 3}))
        .toBeNull();
  });
});
