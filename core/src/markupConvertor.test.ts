import {beautify, formatBody, formattedBodyToYamlObject} from './markupConvertor';

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
});
