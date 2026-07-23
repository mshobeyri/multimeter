import {beautify, beautifyWithContentType, contentTypeForFormat, formatBody, formattedBodyToYamlObject} from './markupConvertor';

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
