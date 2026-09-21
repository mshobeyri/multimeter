import { htmlWithBaseHref, resolveHtmlPreviewBase } from './htmlPreview';

describe('htmlPreview', () => {
  it('accepts only absolute http(s) request URLs as preview bases', () => {
    expect(resolveHtmlPreviewBase('https://example.com/page')).toBe('https://example.com/page');
    expect(resolveHtmlPreviewBase('http://localhost:3000/x')).toBe('http://localhost:3000/x');
    expect(resolveHtmlPreviewBase('file:///tmp/x.html')).toBeUndefined();
    expect(resolveHtmlPreviewBase('javascript:alert(1)')).toBeUndefined();
    expect(resolveHtmlPreviewBase('/relative')).toBeUndefined();
    expect(resolveHtmlPreviewBase(undefined)).toBeUndefined();
  });

  it('encodes quotes in the base href via the URL API', () => {
    const base = resolveHtmlPreviewBase('https://example.com/a"b');
    expect(base).toContain('%22');
    expect(base).not.toContain('"');
  });

  it('injects base after head unless one already exists', () => {
    const withHead = htmlWithBaseHref(
      '<html><head><title>t</title></head><body></body></html>',
      'https://example.com/',
    );
    expect(withHead).toContain('<head><base href="https://example.com/">');
    const already = '<html><head><base href="https://other/"></head></html>';
    expect(htmlWithBaseHref(already, 'https://example.com/')).toBe(already);
    expect(htmlWithBaseHref('<p>x</p>', 'https://example.com/'))
      .toBe('<base href="https://example.com/"><p>x</p>');
  });

  it('replaces quotes in a raw base href with %22', () => {
    expect(htmlWithBaseHref('<p>x</p>', 'https://example.com/a"b'))
      .toBe('<base href="https://example.com/a%22b"><p>x</p>');
  });
});
