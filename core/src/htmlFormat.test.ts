import {formatHtmlBody, formatHtmlLenient} from './htmlFormat';

describe('htmlFormat', () => {
  it('pretty-prints well-formed HTML', () => {
    const html = '<html><body>hello</body></html>';
    const pretty = formatHtmlBody(html);
    expect(pretty).toContain('\n');
    expect(pretty).toContain('<body>hello</body>');
  });

  it('pretty-prints malformed HTML5 without throwing', () => {
    const html = [
      '<!doctype html><html><head>',
      '<meta charset=UTF-8>',
      '<script>if (a<b) { c = 1; }</script>',
      '</head><body><div>hi</div></body></html>',
    ].join('');
    expect(() => formatHtmlBody(html)).not.toThrow();
    const pretty = formatHtmlBody(html);
    expect(pretty).toContain('\n');
    expect(pretty).toContain('<div>');
    expect(pretty).toContain('hi');
    expect(pretty).toContain('if (a<b) { c = 1; }');
  });

  it('keeps script bodies intact in lenient mode', () => {
    const html = '<html><script>if (x<y) { z=1; }</script></html>';
    const pretty = formatHtmlLenient(html);
    expect(pretty).toContain('if (x<y) { z=1; }');
  });
});
