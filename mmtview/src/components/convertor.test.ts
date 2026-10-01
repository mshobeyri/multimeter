import {
  valueToString,
  stringToValue,
  yamlValueToInputBox,
  inputBoxToYamlValue,
  yamlValueToInputBoxWithTokens,
  inputBoxToYamlValueWithTokens,
  inputBoxToYamlString,
  withOptionalPeer,
  peerFieldToValue,
} from './convertor';
import {OMIT_SENTINEL} from 'mmt-core/omitKeyword';
import {LITERAL_TOKEN_PREFIX} from 'mmt-core/literalToken';

describe('convertor null and omit handling', () => {
  it('displays null and omit keywords instead of sentinel', () => {
    expect(valueToString(null)).toBe('null');
    expect(valueToString(OMIT_SENTINEL)).toBe('omit');
  });

  it('quotes literal null and omit strings for display', () => {
    expect(valueToString('null')).toBe('"null"');
    expect(valueToString('omit')).toBe('"omit"');
  });

  it('parses unquoted null and omit as keyword values', () => {
    expect(stringToValue('null')).toBe(null);
    expect(stringToValue('omit')).toBe(OMIT_SENTINEL);
  });

  it('parses quoted null and omit as literal strings', () => {
    expect(stringToValue('"null"')).toBe('null');
    expect(stringToValue('"omit"')).toBe('omit');
  });

  it('round-trips quoted token literals like omit', () => {
    expect(valueToString(`${LITERAL_TOKEN_PREFIX}r:uuid`)).toBe('"r:uuid"');
    expect(stringToValue('"r:uuid"')).toBe(`${LITERAL_TOKEN_PREFIX}r:uuid`);
    expect(stringToValue('r:uuid')).toBe('r:uuid');
    expect(stringToValue('"i:user"')).toBe(`${LITERAL_TOKEN_PREFIX}i:user`);
  });

  it('round-trips keyword values through display and parse', () => {
    expect(stringToValue(valueToString(null))).toBe(null);
    expect(stringToValue(valueToString(OMIT_SENTINEL))).toBe(OMIT_SENTINEL);
  });

  it('keeps quotes on numeric-looking input strings', () => {
    expect(yamlValueToInputBox('112')).toBe('"112"');
    expect(yamlValueToInputBox(112)).toBe('112');
    expect(inputBoxToYamlValue('"112"')).toBe('112');
    expect(typeof inputBoxToYamlValue('"112"')).toBe('string');
    expect(inputBoxToYamlValue('112')).toBe(112);
    expect(peerFieldToValue('"112"')).toBe('112');
    expect(typeof peerFieldToValue('"112"')).toBe('string');
    expect(yamlValueToInputBoxWithTokens('112', true)).toBe('"112"');
  });
});

describe('shared UI → YAML write pipeline', () => {
  it('withOptionalPeer only rewrites when tokens are enabled', () => {
    expect(withOptionalPeer('{{r:uuid}}', false)).toBe('{{r:uuid}}');
    expect(withOptionalPeer('{{r:uuid}}', true)).toBe('r:uuid');
    expect(withOptionalPeer('{{i:user}}', true)).toBe('i:user');
  });

  it('typed write: peer then coerce', () => {
    expect(inputBoxToYamlValueWithTokens('{{r:uuid}}', true)).toBe('r:uuid');
    expect(inputBoxToYamlValueWithTokens('112', true)).toBe(112);
    expect(inputBoxToYamlValueWithTokens('"112"', true)).toBe('112');
    expect(inputBoxToYamlValueWithTokens('112', false)).toBe(112);
  });

  it('string write: peer then coerce then stringify', () => {
    expect(inputBoxToYamlString('{{r:uuid}}', true)).toBe('r:uuid');
    expect(inputBoxToYamlString('112', true)).toBe('112');
    expect(typeof inputBoxToYamlString('112', true)).toBe('string');
    expect(inputBoxToYamlString('"112"', true)).toBe('112');
    expect(inputBoxToYamlString('true', true)).toBe('true');
    expect(inputBoxToYamlString('{{r:uuid}}', false)).toBe('{{r:uuid}}');
  });
});
