import {
  valueToString,
  stringToValue,
  yamlValueToInputBox,
  inputBoxToYamlValue,
  yamlValueToInputBoxWithTokens,
  inputBoxToYamlValueWithTokens,
  inputBoxToYamlString,
  stringFieldToYamlWithLiveTokens,
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

  it('shows omit as omit and quoted omit as text', () => {
    expect(yamlValueToInputBoxWithTokens(OMIT_SENTINEL, true)).toBe('omit');
    expect(inputBoxToYamlValueWithTokens('omit', true)).toBe(OMIT_SENTINEL);
    expect(yamlValueToInputBoxWithTokens('omit', true)).toBe('"omit"');
    expect(inputBoxToYamlValueWithTokens('"omit"', true)).toBe('omit');
  });

  it('turns a whole angle token into a live token', () => {
    const literal = `${LITERAL_TOKEN_PREFIX}<<c:city>>`;
    const quotedAngle = '"<<c:city>>"';
    expect(yamlValueToInputBoxWithTokens(literal, true, true)).toBe('{{c:city}}');
    expect(yamlValueToInputBoxWithTokens('<<i:username>>', true, true)).toBe('{{i:username}}');
    expect(inputBoxToYamlValueWithTokens('{{c:city}}', true, true)).toBe('c:city');
    expect(inputBoxToYamlValueWithTokens(quotedAngle, true, true)).toBe('c:city');
    expect(yamlValueToInputBoxWithTokens(`${LITERAL_TOKEN_PREFIX}i:username`, true, true))
        .toBe('"i:username"');
    expect(inputBoxToYamlValueWithTokens('"i:username"', true, true))
        .toBe(`${LITERAL_TOKEN_PREFIX}i:username`);
    expect(yamlValueToInputBoxWithTokens(literal, true)).toBe(quotedAngle);
  });

  it('spells a nested object with omit and live tokens', () => {
    const source = {
      a: 1,
      note: OMIT_SENTINEL,
      keep: 'omit',
      id: `${LITERAL_TOKEN_PREFIX}<<c:city>>`,
      live: 'c:city',
      qn: '112',
      str: `${LITERAL_TOKEN_PREFIX}i:username`,
      list: [1, 2],
    };
    const ui = yamlValueToInputBoxWithTokens(source, true, true);
    expect(ui).not.toContain('__MMT_');
    expect(ui).toContain('"note":omit');
    expect(ui).toContain('"keep":"omit"');
    expect(ui).toContain('"qn":"112"');
    expect(ui).toContain('"str":"i:username"');
    expect(ui).toContain('"list":[1,2]');
    const saved = inputBoxToYamlValueWithTokens(ui, true, true) as Record<string, unknown>;
    expect(saved.a).toBe(1);
    expect(saved.note).toBe(OMIT_SENTINEL);
    expect(saved.keep).toBe('omit');
    expect(saved.id).toBe('c:city');
    expect(saved.live).toBe('c:city');
    expect(saved.qn).toBe('112');
    expect(saved.str).toBe(`${LITERAL_TOKEN_PREFIX}i:username`);
    expect(saved.list).toEqual([1, 2]);
  });

  it('keeps auth text typed as text and live angle tokens bare', () => {
    expect(stringFieldToYamlWithLiveTokens('{{c:city}}')).toBe('c:city');
    expect(stringFieldToYamlWithLiveTokens('"<<c:city>>"')).toBe('c:city');
    expect(stringFieldToYamlWithLiveTokens('100')).toBe('100');
    expect(stringFieldToYamlWithLiveTokens('"112"')).toBe('112');
    expect(stringFieldToYamlWithLiveTokens('true')).toBe('true');
    expect(stringFieldToYamlWithLiveTokens('omit')).toBe('omit');
    expect(stringFieldToYamlWithLiveTokens('"omit"')).toBe('omit');
    expect(stringFieldToYamlWithLiveTokens('"i:username"'))
        .toBe(`${LITERAL_TOKEN_PREFIX}i:username`);
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
