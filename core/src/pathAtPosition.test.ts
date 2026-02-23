import {extractPathAtPosition} from './outputExtractor';

function posOf(content: string, needle: string) {
  const idx = content.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  const pre = content.slice(0, idx);
  const lines = pre.split(/\n/);
  const line = lines.length;  // 1-based
  const lastNl = pre.lastIndexOf('\n');
  const col = idx - (lastNl >= 0 ? lastNl + 1 : 0) + 1;  // 1-based
  return {line, col};
}

describe('extractPathAtPosition - JSON', () => {
  it('returns path for nested object value', () => {
    const json = `{
  "user": {
    "profile": {
      "name": "mehrdad"
    }
  }
}`;
    const path = extractPathAtPosition(json, 'json', 4, 16);
    expect(path).toEqual(['user', 'profile', 'name']);
  });

  it('returns path including array index', () => {
    const json = `{
  "items": [
    { "name": "a" },
    { "name": "b" }
  ]
}`;
    const pos = posOf(json, '"b"');
    const path = extractPathAtPosition(json, 'json', pos.line, pos.col);
    expect(path).toEqual(['items', 1, 'name']);
  });

  it('returns path when clicking on a key name', () => {
    const json = `{ "user": { "name": "mehrdad" } }`;
    const pos = posOf(json, '"name"');
    const path = extractPathAtPosition(json, 'json', pos.line, pos.col);
    expect(path).toEqual(['user', 'name']);
  });

  it('returns path when clicking on a key with empty string value', () => {
    const json = `{ "data": { "value": "" } }`;
    const pos = posOf(json, '"value"');
    const path = extractPathAtPosition(json, 'json', pos.line, pos.col);
    expect(path).toEqual(['data', 'value']);
  });

  it('returns path when clicking on a key with null value', () => {
    const json = `{ "item": null }`;
    const pos = posOf(json, '"item"');
    const path = extractPathAtPosition(json, 'json', pos.line, pos.col);
    expect(path).toEqual(['item']);
  });
});

describe('extractPathAtPosition - JSON with \n', () => {
  it('returns path for nested object value', () => {
    const json = `{\n"user": {\n"profile": {\n"name": "mehrdad"\n}\n}\n}`;
    const path = extractPathAtPosition(json, 'json', 4, 16);
    expect(path).toEqual(['user', 'profile', 'name']);
  });
});

describe('extractPathAtPosition - XML', () => {
  it('returns path for nested element text', () => {
    const xml =
        `<root>\n  <user>\n    <profile>\n      <name>mehrdad</name>\n    </profile>\n  </user>\n</root>`;
    const pos = posOf(xml, 'mehrdad');
    const path = extractPathAtPosition(xml, 'xml', pos.line, pos.col);
    expect(path).toEqual(['root', 'user', 'profile', 'name']);
  });

  it('returns path including index for repeated elements', () => {
    const xml =
        `<root>\n  <items>\n    <item><name>a</name></item>\n    <item><name>b</name></item>\n  </items>\n</root>`;
    const pos = posOf(xml, '<name>b</name>');
    // Adjust to inside 'b'
    const adjusted = {line: pos.line, col: pos.col + '<name>'.length};
    const path = extractPathAtPosition(xml, 'xml', adjusted.line, adjusted.col);
    expect(path).toEqual(['root', 'items', 'item', 1, 'name']);
  });

  it('returns path when clicking on opening tag name', () => {
    const xml = `<root>\n  <user>\n    <name>mehrdad</name>\n  </user>\n</root>`;
    // Click on the 'n' in '<name>'
    const pos = posOf(xml, 'name>mehrdad');
    const path = extractPathAtPosition(xml, 'xml', pos.line, pos.col);
    expect(path).toEqual(['root', 'user', 'name']);
  });

  it('returns path when clicking on closing tag name', () => {
    const xml = `<root>\n  <user>\n    <name>mehrdad</name>\n  </user>\n</root>`;
    // Click on the 'n' in '</name>'
    const pos = posOf(xml, 'name>\n  </user>');
    const path = extractPathAtPosition(xml, 'xml', pos.line, pos.col);
    expect(path).toEqual(['root', 'user', 'name']);
  });

  it('returns path when clicking on tag name of empty element', () => {
    const xml = `<root>\n  <data></data>\n</root>`;
    // Click on 'd' in '<data>'
    const pos = posOf(xml, 'data>');
    const path = extractPathAtPosition(xml, 'xml', pos.line, pos.col);
    expect(path).toEqual(['root', 'data']);
  });
});
