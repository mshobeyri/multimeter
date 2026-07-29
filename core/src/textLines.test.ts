import { detectNewline, normalizeNewlines, splitNormalizedLines, withNewline } from './textLines';

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

  it('detects and reapplies newline styles', () => {
    expect(detectNewline('a\r\nb')).toBe('\r\n');
    expect(detectNewline('a\rb')).toBe('\r');
    expect(detectNewline('a\nb')).toBe('\n');
    expect(withNewline('a\r\nb\rc', '\n')).toBe('a\nb\nc');
    expect(withNewline('a\nb', '\r\n')).toBe('a\r\nb');
  });

  describe('Windows document sync (updateTextDocument)', () => {
    it('round-trips Monaco LF into a CRLF document without content drift', () => {
      const monacoLf = ['type: api', 'url: https://example.com', 'method: get', ''].join('\n');
      const onDiskCrlf = withNewline(monacoLf, '\r\n');
      expect(onDiskCrlf.includes('\r\n')).toBe(true);
      expect(normalizeNewlines(onDiskCrlf)).toBe(monacoLf);
      // Second sync with same logical text must be a no-op compare.
      expect(withNewline(monacoLf, '\r\n')).toBe(onDiskCrlf);
    });

    it('does not treat LF vs CRLF as a content change after conversion', () => {
      const webview = 'body: |\n  hello\n';
      const document = 'body: |\r\n  hello\r\n';
      expect(withNewline(webview, '\r\n')).toBe(document);
    });
  });
});
