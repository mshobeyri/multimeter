import {
  valueToString,
  stringToValue,
  yamlValueToInputBox,
  inputBoxToYamlValue,
  yamlValueToInputBoxWithTokens,
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
