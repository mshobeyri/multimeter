import {beautify, beautifyWithContentType, contentTypeForFormat, formatBody, formattedBodyToYamlObject, packBodyForYamlCompare, packYaml} from './markupConvertor';
import {apiToYaml} from './apiParsePack';

describe('markupConvertor XML formats', () => {
  it('keeps normal xml self-closing for empty elements', () => {
    const xml = formatBody('xml', {
      root: {
        name: {_text: 'Alice'},
        empty: {}
      }
    }, true);

    expect(xml).toContain('<empty/>');
  });

  it('converts YAML/JSON object strings to XML when format is xml', () => {
    const jsonText = '{\n  "user": {\n    "name": "John"\n  }\n}';
    const xml = formatBody('xml', jsonText, true);
    expect(xml).toContain('<user>');
    expect(xml).toContain('<name>John</name>');
  });

  it('previews json and xml from the same YAML object without rewriting it', () => {
    const original = {user: {name: 'John'}};
    const asJson = formatBody('json', original, true);
    const asXml = formatBody('xml', original, true);
    expect(asXml).toContain('<name>John</name>');
    expect(formatBody('json', original, true)).toBe(asJson);
  });

  it('converts XML text back to JSON when format is json', () => {
    const xml = '<user><name>John</name></user>';
    const json = formatBody('json', xml, true);
    expect(JSON.parse(json)).toEqual({user: {name: 'John'}});
  });

  it('supports xmle expanded XML format for empty elements', () => {
    const xml = formatBody('xmle', {
      root: {
        name: {_text: 'Alice'},
        empty: {}
      }
    }, true);

    expect(xml).toContain('<empty></empty>');
  });

  it('beautifies xmle using expanded empty tags and still parses back', () => {
    const beautified = beautify('xmle', '<root><name>Alice</name><empty/></root>');
    expect(beautified).toContain('<empty></empty>');

    const parsed = formattedBodyToYamlObject('xmle', beautified);
    expect(parsed).toEqual({root: {name: 'Alice', empty: {}}});
  });

  it('detects JSON content after leading whitespace', () => {
    expect(beautifyWithContentType('', '  {"ok":true}')).toBe('{' +
      '\n  "ok": true' +
      '\n}');
  });
});

describe('markupConvertor urlencoded format', () => {
  it('encodes a YAML object as application/x-www-form-urlencoded', () => {
    const encoded = formatBody('urlencoded', {
      key: 'vale',
      key2: 'val2',
    }, false);

    expect(encoded).toBe('key=vale&key2=val2');
  });

  it('percent-encodes reserved characters and uses + for spaces', () => {
    const encoded = formatBody('urlencoded', {
      q: 'hello world',
      email: 'a+b@example.com',
      path: 'a/b',
      eq: 'x=y',
      amp: 'a&b',
    }, false);

    expect(encoded).toBe(
        'q=hello+world&email=a%2Bb%40example.com&path=a%2Fb&eq=x%3Dy&amp=a%26b');
  });

  it('stringifies numbers and booleans', () => {
    const encoded = formatBody('urlencoded', {
      count: 3,
      enabled: true,
      empty: null,
    }, false);

    expect(encoded).toBe('count=3&enabled=true&empty=');
  });

  it('parses urlencoded bodies back to objects', () => {
    const parsed = formattedBodyToYamlObject(
        'urlencoded', 'user=alice&pass=s%40cret&note=hello+world');
    expect(parsed).toEqual({
      user: 'alice',
      pass: 's@cret',
      note: 'hello world',
    });
  });

  it('round-trips object → encoded → object', () => {
    const original = {username: 'mehrdad', password: 'p@ss w0rd'};
    const encoded = formatBody('urlencoded', original, false);
    expect(formattedBodyToYamlObject('urlencoded', encoded)).toEqual(original);
  });

  it('beautifies urlencoded content type', () => {
    expect(beautifyWithContentType(
               'application/x-www-form-urlencoded', 'b=2&a=1'))
        .toBe('b=2&a=1');
    expect(contentTypeForFormat('urlencoded'))
        .toBe('application/x-www-form-urlencoded');
  });
});

describe('markupConvertor binary format', () => {
  it('keeps a file path string as-is', () => {
    expect(formatBody('binary', './payload.bin', false)).toBe('./payload.bin');
    expect(formatBody('binary', '  ./a.pdf  ', false)).toBe('./a.pdf');
  });

  it('round-trips path through formattedBodyToYamlObject', () => {
    expect(formattedBodyToYamlObject('binary', './payload.bin'))
        .toBe('./payload.bin');
  });

  it('uses application/octet-stream content type', () => {
    expect(contentTypeForFormat('binary')).toBe('application/octet-stream');
  });
});

describe('markupConvertor Windows CRLF bodies', () => {
  const crlfXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '  <note>',
    '  <to>Tove</to>',
    '  <from>Jani</from>',
    '  <heading>Reminder</heading>',
    '  <body>Don\'t forget me this weekend!</body>',
    '</note>',
    '',
  ].join('\r\n');

  it('parses CRLF XML into a structured object without CR characters', () => {
    const parsed = formattedBodyToYamlObject('xml', crlfXml);
    expect(parsed).toMatchObject({
      note: {
        to: 'Tove',
        from: 'Jani',
        heading: 'Reminder',
        body: "Don't forget me this weekend!",
      },
    });
    expect(JSON.stringify(parsed)).not.toContain('\\r');
  });

  it('keeps CRLF text bodies as LF when applying to YAML', () => {
    const text = formattedBodyToYamlObject('text', crlfXml);
    expect(text).toBe(crlfXml.replace(/\r\n/g, '\n'));
    expect(text).not.toContain('\r');
  });

  it('does not emit escaped \\r when packing a CRLF XML string body', () => {
    // API tester stores the body as a raw Monaco string (CRLF on Windows).
    const yaml = apiToYaml({
      type: 'api',
      url: 'https://example.com',
      method: 'post',
      format: 'xml',
      body: crlfXml,
    } as any);
    expect(yaml).not.toMatch(/\\r/);
    expect(yaml).not.toContain('\r');
    expect(yaml).toContain('<note>');
    expect(yaml).toContain('<to>Tove</to>');
  });

  it('packYaml normalizes CRLF in nested string leaves', () => {
    const out = packYaml({
      type: 'api',
      body: 'line1\r\nline2\rline3',
      headers: {'X-Note': 'a\r\nb'},
    });
    expect(out).not.toMatch(/\\r/);
    expect(out).not.toContain('\r');
    expect(out).toMatch(/body: \|-\n\s+line1\n\s+line2\n\s+line3/);
    expect(out).toMatch(/X-Note: \|-\n\s+a\n\s+b/);
  });

  it('formatBody normalizes CRLF before formatting text', () => {
    expect(formatBody('text', 'a\r\nb\rc', false)).toBe('a\nb\nc');
  });
});

describe('markupConvertor none format', () => {
  it('keeps body text and has no content type', () => {
    expect(formatBody('none', 'keep me', false)).toBe('keep me');
    expect(formattedBodyToYamlObject('none', 'keep me')).toBe('keep me');
    expect(contentTypeForFormat('none')).toBe('');
  });
});

describe('markupConvertor html format', () => {
  it('pretty-prints HTML and uses text/html', () => {
    const html = '<html><body>hello</body></html>';
    expect(formatBody('html', html, false)).toBe(html);
    expect(formatBody('html', html, true)).toContain('\n');
    expect(formattedBodyToYamlObject('html', html)).toBe(html);
    expect(contentTypeForFormat('html')).toBe('text/html');
    expect(beautifyWithContentType('text/html', html)).toContain('\n');
    expect(beautify('html', html)).toContain('<body>hello</body>');
  });

  it('pretty-prints malformed HTML5 without throwing', () => {
    const html = [
      '<!doctype html><html><head>',
      '<meta charset=UTF-8>',
      '<script>if (a<b) { c = 1; }</script>',
      '</head><body><div>hi</div></body></html>',
    ].join('');
    expect(() => beautifyWithContentType('text/html', html)).not.toThrow();
    const pretty = beautifyWithContentType('text/html', html);
    expect(pretty).toContain('\n');
    expect(pretty).toContain('<div>');
    expect(pretty).toContain('hi');
    expect(pretty).toContain('if (a<b) { c = 1; }');
  });
});

describe('markupConvertor multipart format', () => {
  it('formats multipart parts as JSON for the editor', () => {
    const parts = [{name: 'meta', value: 'hello'}];
    expect(formatBody('multipart', parts, true)).toContain('"name": "meta"');
    expect(formattedBodyToYamlObject('multipart', formatBody('multipart', parts, true)))
        .toEqual(parts);
    expect(contentTypeForFormat('multipart')).toBe('multipart/form-data');
  });
});

describe('packBodyForYamlCompare', () => {
  it('keeps UI body when YAML body is already text', () => {
    expect(packBodyForYamlCompare('raw text', '<a>1</a>', 'xml')).toBe('<a>1</a>');
  });

  it('packs UI text to object when YAML body is structured', () => {
    const yamlBody = {token: 'i:token'};
    const uiXml = formatBody('xml', {token: 'placeholder'}, true);
    const packed = packBodyForYamlCompare(yamlBody, uiXml, 'xml');
    expect(packed).toEqual({token: 'placeholder'});
  });

  it('falls back to UI text when packing fails', () => {
    const yamlBody = {token: 'i:token'};
    expect(packBodyForYamlCompare(yamlBody, '<<<not-xml', 'xml')).toBe('<<<not-xml');
  });

  it('passes through non-string UI bodies unchanged', () => {
    const yamlBody = {a: 1};
    const uiBody = {a: 2};
    expect(packBodyForYamlCompare(yamlBody, uiBody, 'json')).toEqual({a: 2});
  });
});
