import {getFileLinkTargetAtPosition} from './yamlLinks';

function createMockModel(lines: string[]) {
  return {
    getLineContent: (lineNumber: number) => lines[lineNumber - 1] ?? '',
    getWordAtPosition: () => null,
    getValue: () => lines.join('\n'),
  };
}

const monaco = {
  Range: class {
    constructor(
        public startLineNumber: number, public startColumn: number,
        public endLineNumber: number, public endColumn: number) {}
  },
};

describe('getFileLinkTargetAtPosition', () => {
  it('resolves call alias via import block with LF line endings', () => {
    const content = [
      'type: test',
      'import:',
      '  api: ./api.mmt',
      'steps:',
      '  - call: api',
    ].join('\n');
    const model = createMockModel(content.split('\n'));
    const target = getFileLinkTargetAtPosition(
        monaco, model, content, {lineNumber: 5, column: 12});
    expect(target).toEqual({
      path: './api.mmt',
      range: expect.any(monaco.Range),
    });
  });

  it('resolves call alias via import block with CRLF line endings', () => {
    const content = [
      'type: test',
      'import:',
      '  api: ./api.mmt',
      'steps:',
      '  - call: api',
    ].join('\r\n');
    const model = createMockModel(content.replace(/\r\n/g, '\n').split('\n'));
    const target = getFileLinkTargetAtPosition(
        monaco, model, content, {lineNumber: 5, column: 12});
    expect(target).toEqual({
      path: './api.mmt',
      range: expect.any(monaco.Range),
    });
  });

  it('still resolves import paths directly when import map is unavailable', () => {
    const content = [
      'type: test',
      'import:',
      '  api: ./api.mmt',
    ].join('\r\n');
    const model = createMockModel(content.replace(/\r\n/g, '\n').split('\n'));
    const target = getFileLinkTargetAtPosition(
        monaco, model, content, {lineNumber: 3, column: 12});
    expect(target).toEqual({
      path: './api.mmt',
      range: expect.any(monaco.Range),
    });
  });

  it('resolves inline http URL to a temporary API preview link', () => {
    const content = [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    method: post',
    ].join('\n');
    const model = createMockModel(content.split('\n'));
    const target = getFileLinkTargetAtPosition(
        monaco, model, content, {lineNumber: 3, column: 18});
    expect(target?.httpStepPreview).toEqual({lineNumber: 3, column: 18});
    expect(target?.path).toBeUndefined();
    expect(target?.range).toEqual(expect.any(monaco.Range));
  });

  it('does not treat method lines as http preview links', () => {
    const content = [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    method: post',
    ].join('\n');
    const model = createMockModel(content.split('\n'));
    const target = getFileLinkTargetAtPosition(
        monaco, model, content, {lineNumber: 4, column: 10});
    expect(target).toBeNull();
  });
});
