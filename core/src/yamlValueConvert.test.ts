import {
  inputBoxToYamlValue,
  isIncompleteJsonLiteral,
  needsYamlDoubleQuotes,
  yamlValueToInputBox,
  yamlValueTypeLabel,
} from './yamlValueConvert';
import {OMIT_SENTINEL} from './omitKeyword';
import {LITERAL_TOKEN_PREFIX} from './literalToken';
import {apiToYaml, yamlToAPIStrict} from './apiParsePack';

describe('yamlValueConvert', () => {
  it('keeps quoted numeric strings quoted in the input box', () => {
    expect(yamlValueToInputBox('112')).toBe('"112"');
    expect(yamlValueToInputBox(112)).toBe('112');
    expect(inputBoxToYamlValue('"112"')).toBe('112');
    expect(typeof inputBoxToYamlValue('"112"')).toBe('string');
    expect(inputBoxToYamlValue('112')).toBe(112);
  });

  it('round-trips quoted and bare scalars', () => {
    expect(inputBoxToYamlValue(yamlValueToInputBox('112'))).toBe('112');
    expect(inputBoxToYamlValue(yamlValueToInputBox(112))).toBe(112);
    expect(inputBoxToYamlValue(yamlValueToInputBox(null))).toBe(null);
    expect(inputBoxToYamlValue(yamlValueToInputBox(OMIT_SENTINEL))).toBe(
        OMIT_SENTINEL);
    expect(inputBoxToYamlValue(yamlValueToInputBox(true))).toBe(true);
    expect(inputBoxToYamlValue(yamlValueToInputBox('true'))).toBe('true');
  });

  it('marks needsYamlDoubleQuotes for ambiguous strings only', () => {
    expect(needsYamlDoubleQuotes('112')).toBe(true);
    expect(needsYamlDoubleQuotes('true')).toBe(true);
    expect(needsYamlDoubleQuotes('null')).toBe(true);
    expect(needsYamlDoubleQuotes('omit')).toBe(true);
    expect(needsYamlDoubleQuotes('hello')).toBe(false);
    expect(needsYamlDoubleQuotes('r:uuid')).toBe(false);
  });

  it('round-trips quoted token literals', () => {
    expect(yamlValueToInputBox(`${LITERAL_TOKEN_PREFIX}r:uuid`)).toBe(
        '"r:uuid"');
    expect(inputBoxToYamlValue('"r:uuid"')).toBe(
        `${LITERAL_TOKEN_PREFIX}r:uuid`);
    expect(inputBoxToYamlValue('r:uuid')).toBe('r:uuid');
  });

  it('labels omit / null / numbers for UI type chips', () => {
    expect(yamlValueTypeLabel(null)).toBe('null');
    expect(yamlValueTypeLabel(OMIT_SENTINEL)).toBe('omit');
    expect(yamlValueTypeLabel(112)).toBe('num');
    expect(yamlValueTypeLabel('112')).toBe('str');
    expect(yamlValueTypeLabel(true)).toBe('bool');
    expect(yamlValueTypeLabel({a: 1})).toBe('obj');
    expect(yamlValueTypeLabel([1])).toBe('list');
  });

  it('detects incomplete JSON object/array literals', () => {
    expect(isIncompleteJsonLiteral('{')).toBe(true);
    expect(isIncompleteJsonLiteral('{"a":')).toBe(true);
    expect(isIncompleteJsonLiteral('[1,')).toBe(true);
    expect(isIncompleteJsonLiteral('{}')).toBe(false);
    expect(isIncompleteJsonLiteral('{"a":1}')).toBe(false);
    expect(isIncompleteJsonLiteral('[1,2]')).toBe(false);
    expect(isIncompleteJsonLiteral('hello')).toBe(false);
    expect(isIncompleteJsonLiteral('{{i:username}}')).toBe(false);
    expect(isIncompleteJsonLiteral('{{r:uuid}}')).toBe(false);
    expect(isIncompleteJsonLiteral('{"note":omit}')).toBe(false);
    expect(isIncompleteJsonLiteral('{"id":"{{c:city}}"}')).toBe(false);
    expect(isIncompleteJsonLiteral('{"note":omi')).toBe(true);
  });

  it('round-trips objects through the input box as JSON text', () => {
    const obj = {name: 10, ssd: {message: 'Hello from mmt!'}};
    const display = yamlValueToInputBox(obj as any);
    expect(display.startsWith('{')).toBe(true);
    expect(display).toContain('"name":10');
    expect(inputBoxToYamlValue(display)).toEqual(obj);
  });

  it('preserves inputs xxx: "112" through parse → pack', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: get
inputs:
  xxx: "112"
  yyy: 112
`);
    expect(api.inputs?.xxx).toBe('112');
    expect(typeof api.inputs?.xxx).toBe('string');
    expect(api.inputs?.yyy).toBe(112);
    expect(yamlValueToInputBox(api.inputs?.xxx as any)).toBe('"112"');
    expect(yamlValueToInputBox(api.inputs?.yyy as any)).toBe('112');

    const yaml = apiToYaml(api as any);
    expect(yaml).toMatch(/xxx:\s*"112"/);
    expect(yaml).toMatch(/yyy:\s*112/);
  });
});
