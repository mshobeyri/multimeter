import {
  isQuotedExpectLiteral,
  opsList,
  unquoteExpectLiteral,
} from './TestData';
import {
  checkToJSfunc,
  conditionalStatementToJSfunc,
  parseExpectValue,
} from './JSerTestFlow';
import {
  equals_,
  equalsAsString_,
  equalsIgnoreCase_,
  isNotOmitted_,
  isOmitted_,
  notEquals_,
  notEqualsAsString_,
  trimEquals_,
  trimEqualsIgnoreCase_,
} from './testHelper';
import { OMIT_KEYWORD, OMIT_SENTINEL } from './omitKeyword';
import { expectMapToUiRows, uiRowToExpectValue } from './expectUi';

/** Static ops that take a string expected (exclude fuzzy select bases covered separately). */
const STRING_OPS = opsList.filter(op => op !== '>%' && op !== '<%');

describe('unquoteExpectLiteral', () => {
  it('returns empty for empty quotes', () => {
    expect(unquoteExpectLiteral("''")).toBe('');
    expect(unquoteExpectLiteral('""')).toBe('');
    expect(unquoteExpectLiteral("  ''  ")).toBe('');
    expect(unquoteExpectLiteral('  ""  ')).toBe('');
  });

  it('strips matching double and single quotes', () => {
    expect(unquoteExpectLiteral('"fail test"')).toBe('fail test');
    expect(unquoteExpectLiteral("'fail test'")).toBe('fail test');
    expect(unquoteExpectLiteral('  "  spaced  "  ')).toBe('  spaced  ');
  });

  it('unescapes simple escapes inside quotes', () => {
    expect(unquoteExpectLiteral('"say \\"hi\\""')).toBe('say "hi"');
    expect(unquoteExpectLiteral("'it\\'s ok'")).toBe("it's ok");
    expect(unquoteExpectLiteral('"a\\\\b"')).toBe('a\\b');
  });

  it('leaves unquoted text unchanged', () => {
    expect(unquoteExpectLiteral('fail test')).toBe('fail test');
    expect(unquoteExpectLiteral('omit')).toBe('omit');
    expect(unquoteExpectLiteral(OMIT_SENTINEL)).toBe(OMIT_SENTINEL);
    expect(unquoteExpectLiteral('')).toBe('');
    expect(unquoteExpectLiteral('"')).toBe('"');
    expect(unquoteExpectLiteral("'unbalanced")).toBe("'unbalanced");
    expect(unquoteExpectLiteral('"mixed\'')).toBe('"mixed\'');
  });
});

describe('isQuotedExpectLiteral', () => {
  it('detects quoted literals', () => {
    expect(isQuotedExpectLiteral('""')).toBe(true);
    expect(isQuotedExpectLiteral("''")).toBe(true);
    expect(isQuotedExpectLiteral('"fail test"')).toBe(true);
    expect(isQuotedExpectLiteral("'fail test'")).toBe(true);
    expect(isQuotedExpectLiteral('  "x"  ')).toBe(true);
  });

  it('rejects unquoted and malformed quotes', () => {
    expect(isQuotedExpectLiteral('fail test')).toBe(false);
    expect(isQuotedExpectLiteral('omit')).toBe(false);
    expect(isQuotedExpectLiteral('')).toBe(false);
    expect(isQuotedExpectLiteral('"')).toBe(false);
    expect(isQuotedExpectLiteral('"x')).toBe(false);
    expect(isQuotedExpectLiteral('"a\'')).toBe(false);
  });
});

describe('parseExpectValue quotes and omit', () => {
  it('unquotes "" and \'\' for every operator', () => {
    for (const op of STRING_OPS) {
      expect(parseExpectValue(`${op} ""`)).toEqual({ operator: op, expected: '' });
      expect(parseExpectValue(`${op} ''`)).toEqual({ operator: op, expected: '' });
    }
    expect(parseExpectValue('>% ""')).toEqual({ operator: '>%', expected: '' });
    expect(parseExpectValue('<75% ""')).toEqual({ operator: '<75%', expected: '' });
  });

  it('unquotes double-quoted expected for every operator', () => {
    for (const op of STRING_OPS) {
      expect(parseExpectValue(`${op} "fail test"`)).toEqual({
        operator: op,
        expected: 'fail test',
      });
    }
  });

  it('unquotes single-quoted expected for every operator', () => {
    for (const op of STRING_OPS) {
      expect(parseExpectValue(`${op} 'fail test'`)).toEqual({
        operator: op,
        expected: 'fail test',
      });
    }
  });

  it('keeps unquoted multi-word expected without adding quotes', () => {
    expect(parseExpectValue('== fail test')).toEqual({
      operator: '==',
      expected: 'fail test',
    });
    expect(parseExpectValue('=C hello world')).toEqual({
      operator: '=C',
      expected: 'hello world',
    });
  });

  it('treats bare omit as omit keyword for == and != only', () => {
    expect(parseExpectValue('== omit')).toEqual({ operator: '==', expected: null });
    expect(parseExpectValue('!= omit')).toEqual({ operator: '!=', expected: null });
    expect(parseExpectValue(`== ${OMIT_SENTINEL}`)).toEqual({ operator: '==', expected: null });
    expect(parseExpectValue(`!= ${OMIT_SENTINEL}`)).toEqual({ operator: '!=', expected: null });
  });

  it('does not treat bare omit as keyword for other operators', () => {
    expect(parseExpectValue('=C omit')).toEqual({ operator: '=C', expected: 'omit' });
    expect(parseExpectValue('=@ omit')).toEqual({ operator: '=@', expected: 'omit' });
    expect(parseExpectValue('=# omit')).toEqual({ operator: '=#', expected: 'omit' });
  });

  it('keeps quoted omit as the literal string omit', () => {
    expect(parseExpectValue('== "omit"')).toEqual({ operator: '==', expected: 'omit' });
    expect(parseExpectValue("== 'omit'")).toEqual({ operator: '==', expected: 'omit' });
    expect(parseExpectValue('!= "omit"')).toEqual({ operator: '!=', expected: 'omit' });
    expect(parseExpectValue('=C "omit"')).toEqual({ operator: '=C', expected: 'omit' });
  });

  it('maps omit sentinel value (non-string path) to == null', () => {
    expect(parseExpectValue(OMIT_SENTINEL as any)).toEqual({
      operator: '==',
      expected: null,
    });
  });

  it('unquotes plain quoted strings without an operator prefix', () => {
    expect(parseExpectValue('"hello world"')).toEqual({
      operator: '==',
      expected: 'hello world',
    });
    expect(parseExpectValue("'hello world'")).toEqual({
      operator: '==',
      expected: 'hello world',
    });
    expect(parseExpectValue('""')).toEqual({ operator: '==', expected: '' });
    expect(parseExpectValue("''")).toEqual({ operator: '==', expected: '' });
  });

  it('preserves interior quotes that are not wrapping the whole value', () => {
    expect(parseExpectValue('== say "hi"')).toEqual({
      operator: '==',
      expected: 'say "hi"',
    });
    expect(parseExpectValue(`== it's fine`)).toEqual({
      operator: '==',
      expected: "it's fine",
    });
  });
});

describe('comparison codegen for quotes and omit', () => {
  it('emits unquoted string compares for == "fail test"', () => {
    expect(conditionalStatementToJSfunc('${echoed} == "fail test"'))
      .toBe('equals_(`${echoed}`, `fail test`)');
    expect(conditionalStatementToJSfunc("${echoed} == 'fail test'"))
      .toBe('equals_(`${echoed}`, `fail test`)');
    expect(checkToJSfunc('${echoed} == "fail test"', false))
      .toContain('equals_(echoed, `fail test`)');
  });

  it('emits empty-string compares for "" and \'\'', () => {
    expect(conditionalStatementToJSfunc('${x} == ""')).toBe('equals_(`${x}`, ``)');
    expect(conditionalStatementToJSfunc("${x} == ''")).toBe('equals_(`${x}`, ``)');
    expect(conditionalStatementToJSfunc('${x} != ""')).toBe('notEquals_(`${x}`, ``)');
  });

  it('emits omit helpers for bare omit, not for quoted omit', () => {
    expect(conditionalStatementToJSfunc('${x} == omit')).toBe('isOmitted_(x)');
    expect(conditionalStatementToJSfunc('${x} != omit')).toBe('isNotOmitted_(x)');
    expect(conditionalStatementToJSfunc('${x} == "omit"')).toBe('equals_(`${x}`, `omit`)');
    expect(conditionalStatementToJSfunc("${x} == 'omit'")).toBe('equals_(`${x}`, `omit`)');
    expect(checkToJSfunc('${x} == omit', false)).toContain('isOmitted_(x)');
    expect(checkToJSfunc('${x} == "omit"', false)).toContain('equals_(x, `omit`)');
  });

  it('emits ignore-case and trim helpers with unquoted expected', () => {
    expect(conditionalStatementToJSfunc('${name} =i "John"'))
      .toBe('equalsIgnoreCase_(`${name}`, `John`)');
    expect(conditionalStatementToJSfunc('${name} =X "  hi  "'))
      .toBe('trimEquals_(`${name}`, `  hi  `)');
    expect(conditionalStatementToJSfunc('${name} =iX "  John "'))
      .toBe('trimEqualsIgnoreCase_(`${name}`, `  John `)');
  });

  it('emits quoted expected codegen for every string operator', () => {
    const helperByOp: Record<string, string> = {
      '==': 'equals_',
      '!=': 'notEquals_',
      '=i': 'equalsIgnoreCase_',
      '!i': 'notEqualsIgnoreCase_',
      '=X': 'trimEquals_',
      '!X': 'notTrimEquals_',
      '=iX': 'trimEqualsIgnoreCase_',
      '!iX': 'notTrimEqualsIgnoreCase_',
      '=@': 'isAt_',
      '!@': 'isNotAt_',
      '=C': 'contains_',
      '!C': 'notContains_',
      '=^': 'startsWith_',
      '!^': 'notStartsWith_',
      '=$': 'endsWith_',
      '!$': 'notEndsWith_',
      '=*': 'matches_',
      '!*': 'notMatches_',
      '=~': 'equalsAsString_',
      '!~': 'notEqualsAsString_',
      '=#': 'lengthEquals_',
      '!#': 'notLengthEquals_',
      '<#': 'lengthLess_',
      '<=#': 'lengthLessOrEqual_',
      '>#': 'lengthGreater_',
      '>=#': 'lengthGreaterOrEqual_',
      '<': 'less_',
      '>': 'greater_',
      '<=': 'lessOrEqual_',
      '>=': 'greaterOrEqual_',
    };
    for (const op of STRING_OPS) {
      const js = conditionalStatementToJSfunc(`\${v} ${op} "x"`);
      const helper = helperByOp[op];
      expect(helper).toBeDefined();
      expect(js).toContain(helper);
      expect(js).toContain('`x`');
      expect(js).not.toContain('`"x"`');
    }
  });
});

describe('runtime omit and quote-sensitive helpers', () => {
  it('isOmitted_ covers undefined, null, and sentinel', () => {
    expect(isOmitted_(undefined)).toBe(true);
    expect(isOmitted_(null)).toBe(true);
    expect(isOmitted_(OMIT_SENTINEL)).toBe(true);
    expect(isOmitted_(OMIT_KEYWORD)).toBe(false);
    expect(isOmitted_('')).toBe(false);
    expect(isOmitted_('omit')).toBe(false);
    expect(isNotOmitted_('value')).toBe(true);
  });

  it('equals_ treats sentinel as omit presence check', () => {
    expect(equals_(undefined, OMIT_SENTINEL)).toBe(true);
    expect(equals_(null, OMIT_SENTINEL)).toBe(true);
    expect(equals_(OMIT_SENTINEL, null)).toBe(true);
    expect(equals_('present', OMIT_SENTINEL)).toBe(false);
    expect(notEquals_('present', OMIT_SENTINEL)).toBe(true);
    expect(equals_('omit', 'omit')).toBe(true);
    expect(equals_('', '')).toBe(true);
  });

  it('=~ / equalsAsString_ compares XML strings to YAML bools/numbers without changing JSON ==', () => {
    expect(equalsAsString_('true', true)).toBe(true);
    expect(equalsAsString_('false', false)).toBe(true);
    expect(equalsAsString_('42', 42)).toBe(true);
    expect(equalsAsString_('01', 1)).toBe(false);
    expect(equalsAsString_('a1', 1)).toBe(false);
    expect(notEqualsAsString_('true', false)).toBe(true);
    // Strict == stays type-safe for JSON
    expect(equals_('true', true)).toBe(false);
    expect(equals_(true, true)).toBe(true);
  });

  it('trim and ignore-case helpers compare unquoted text', () => {
    expect(equalsIgnoreCase_('John', 'john')).toBe(true);
    expect(trimEquals_('  hi  ', 'hi')).toBe(true);
    expect(trimEqualsIgnoreCase_('  John ', 'john')).toBe(true);
  });
});

describe('expectUi quoted expected values', () => {
  it('strips quotes when loading operator-prefixed expect rows', () => {
    const rows = expectMapToUiRows({
      echoed: '== "fail test"',
      empty: '== ""',
      omitLit: '== "omit"',
      bareOmit: '== omit',
    });
    expect(rows.find(r => r.field === 'echoed')).toMatchObject({
      op: '==',
      expected: 'fail test',
      explicitOperator: true,
    });
    expect(rows.find(r => r.field === 'empty')).toMatchObject({
      op: '==',
      expected: '',
    });
    expect(rows.find(r => r.field === 'omitLit')).toMatchObject({
      op: '==',
      expected: 'omit',
    });
    expect(rows.find(r => r.field === 'bareOmit')).toMatchObject({
      op: '==',
      expected: 'omit',
    });
  });

  it('round-trips unquoted expected text back to operator form', () => {
    const rows = expectMapToUiRows({ echoed: '== "fail test"' });
    expect(uiRowToExpectValue(rows[0])).toBe('== fail test');
  });
});
