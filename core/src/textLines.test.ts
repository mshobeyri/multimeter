import { normalizeNewlines, splitNormalizedLines } from './textLines';

describe('textLines', () => {
  it('splits CRLF and bare CR into clean LF lines', () => {
    expect(splitNormalizedLines('a\r\nb\rc\n')).toEqual(['a', 'b', 'c', '']);
  });

  it('normalizes newlines without splitting', () => {
    expect(normalizeNewlines('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('keeps LF-only input unchanged when splitting', () => {
    expect(splitNormalizedLines('a\nb\n')).toEqual(['a', 'b', '']);
  });

  it('handles empty and nullish input', () => {
    expect(splitNormalizedLines('')).toEqual(['']);
    expect(splitNormalizedLines(undefined as any)).toEqual(['']);
    expect(normalizeNewlines(null as any)).toBe('');
  });
});
