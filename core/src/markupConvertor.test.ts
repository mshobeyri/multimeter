import {beautify, beautifyWithContentType, contentTypeForFormat, formatBody, formattedBodyToYamlObject, packYaml} from './markupConvertor';
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
