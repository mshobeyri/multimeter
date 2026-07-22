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
});
