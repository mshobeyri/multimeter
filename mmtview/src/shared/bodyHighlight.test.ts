import {
  beautifyBody,
  canBeautifyBody,
  detectBodyFormat,
  escapeHtml,
  highlightBodyHtml,
} from './bodyHighlight';

describe('bodyHighlight', () => {
  it('detects format from content-type and body sniff', () => {
    expect(detectBodyFormat('{"a":1}', { 'Content-Type': 'application/json' })).toBe('json');
    expect(detectBodyFormat('<root/>', { 'content-type': 'application/xml' })).toBe('xml');
    expect(detectBodyFormat('a=1&b=2', { 'Content-Type': 'application/x-www-form-urlencoded' }))
        .toBe('urlencoded');
    expect(detectBodyFormat('{"a":1}')).toBe('json');
    expect(detectBodyFormat('<note>hi</note>')).toBe('xml');
    expect(detectBodyFormat('plain')).toBe('text');
  });

  it('beautifies json and marks formatable bodies', () => {
    expect(canBeautifyBody('{"a":1}')).toBe(true);
    expect(beautifyBody('{"a":1}')).toContain('\n');
    expect(canBeautifyBody('plain')).toBe(false);
  });

  it('escapes html and colorizes json keys/strings', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
    const html = highlightBodyHtml('{"name":"ada","n":1, "ok":true}');
    expect(html).toContain('bh-key');
    expect(html).toContain('bh-string');
    expect(html).toContain('bh-number');
    expect(html).toContain('bh-keyword');
    expect(html).not.toContain('<script');
  });

  it('preserves newlines before closing braces in pretty json', () => {
    const pretty = '{\n  "message": "hello"\n}';
    const html = highlightBodyHtml(pretty);
    expect(html).toContain('&quot;hello&quot;');
    expect(html).toMatch(/hello[\s\S]*\n[\s\S]*\}/);
    expect(html.replace(/<[^>]+>/g, '')).toBe(
      pretty.replace(/"/g, '&quot;'),
    );
  });

  it('colorizes xml tags and attributes', () => {
    const html = highlightBodyHtml('<user id="1">ada</user>');
    expect(html).toContain('bh-tag');
    expect(html).toContain('bh-attr');
    expect(html).toContain('bh-string');
  });
});
