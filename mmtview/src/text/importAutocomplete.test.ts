import {describe, expect, it} from '@jest/globals';

function shouldOfferImportFileCompletion(lineContent: string, positionColumn: number) {
  const keyValueMatch = lineContent.match(/^(\s*)(\w+):\s*(.*)$/);
  if (!keyValueMatch) {
    return false;
  }
  const key = keyValueMatch[2];
  const colonPosition = lineContent.indexOf(':');
  const valueStartColumn = colonPosition + 2;
  return (key === 'import' || key === 'imports') && positionColumn >= valueStartColumn;
}

describe('import file autocomplete trigger', () => {
  it('triggers on `import:` value position', () => {
    expect(shouldOfferImportFileCompletion('import: ', 9)).toBe(true);
  });

  it('does not trigger for other keys', () => {
    expect(shouldOfferImportFileCompletion('title: ', 8)).toBe(false);
  });
});
