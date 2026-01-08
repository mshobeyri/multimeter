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

function splitPathPrefix(raw: string): { folder: string; partial: string } {
  const v = String(raw ?? '');
  const trimmed = v.replace(/^\s+/, '').replace(/^["']/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash < 0) {
    return { folder: '.', partial: trimmed };
  }
  const folder = trimmed.slice(0, lastSlash + 1);
  const partial = trimmed.slice(lastSlash + 1);
  return { folder: folder || '.', partial };
}

describe('import file autocomplete path prefix parsing', () => {
  it('uses current folder when no slash', () => {
    expect(splitPathPrefix('ab')).toEqual({ folder: '.', partial: 'ab' });
  });

  it('keeps ../ folder prefix', () => {
    expect(splitPathPrefix('../')).toEqual({ folder: '../', partial: '' });
    expect(splitPathPrefix('../ex')).toEqual({ folder: '../', partial: 'ex' });
  });

  it('keeps nested folder prefix', () => {
    expect(splitPathPrefix('a/b/te')).toEqual({ folder: 'a/b/', partial: 'te' });
  });
});
