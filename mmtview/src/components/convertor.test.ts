import {valueToString, stringToValue} from './convertor';
import {OMIT_SENTINEL} from 'mmt-core/omitKeyword';

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

  it('round-trips keyword values through display and parse', () => {
    expect(stringToValue(valueToString(null))).toBe(null);
    expect(stringToValue(valueToString(OMIT_SENTINEL))).toBe(OMIT_SENTINEL);
  });
});
