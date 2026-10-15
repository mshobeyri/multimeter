import {
  authoredExpectedFromComparison,
  formatExpectMetaValue,
  isNonPlainExpectedAuthored,
  shouldShowResolvedExpected,
} from '../reportExpectMeta';
import {OMIT_SENTINEL} from '../omitKeyword';

describe('authoredExpectedFromComparison', () => {
  it('reads the RHS after the operator', () => {
    expect(authoredExpectedFromComparison('status_code == 200')).toBe('200');
    expect(authoredExpectedFromComparison('token == c:uuid')).toBe('c:uuid');
    expect(authoredExpectedFromComparison('name >80% John')).toBe('John');
    expect(authoredExpectedFromComparison('created =1m30s~ 2026-09-18T12:00:00Z'))
        .toBe('2026-09-18T12:00:00Z');
  });

  it('returns null when comparison cannot be split', () => {
    expect(authoredExpectedFromComparison('')).toBeNull();
    expect(authoredExpectedFromComparison('not-an-operator')).toBeNull();
  });
});

describe('isNonPlainExpectedAuthored', () => {
  it('detects whole-value tokens', () => {
    expect(isNonPlainExpectedAuthored('c:uuid')).toBe(true);
    expect(isNonPlainExpectedAuthored('e:url')).toBe(true);
    expect(isNonPlainExpectedAuthored('i:userId')).toBe(true);
    expect(isNonPlainExpectedAuthored('<<c:day>>')).toBe(true);
    expect(isNonPlainExpectedAuthored('{{e:token}}')).toBe(true);
  });

  it('detects embedded tokens', () => {
    expect(isNonPlainExpectedAuthored('Bearer <<e:token>>')).toBe(true);
    expect(isNonPlainExpectedAuthored('hi {{c:name}}')).toBe(true);
  });

  it('treats plain literals as plain', () => {
    expect(isNonPlainExpectedAuthored('200')).toBe(false);
    expect(isNonPlainExpectedAuthored('John')).toBe(false);
    expect(isNonPlainExpectedAuthored('omit')).toBe(false);
    expect(isNonPlainExpectedAuthored('{"a":1}')).toBe(false);
  });
});

describe('shouldShowResolvedExpected', () => {
  it('is true only for non-plain RHS', () => {
    expect(shouldShowResolvedExpected('token == c:uuid')).toBe(true);
    expect(shouldShowResolvedExpected('url == e:base')).toBe(true);
    expect(shouldShowResolvedExpected('status_code == 200')).toBe(false);
    expect(shouldShowResolvedExpected('name == John')).toBe(false);
  });
});

describe('formatExpectMetaValue', () => {
  it('formats scalars, objects, and omit', () => {
    expect(formatExpectMetaValue('abc')).toBe('abc');
    expect(formatExpectMetaValue(200)).toBe('200');
    expect(formatExpectMetaValue({a: 1})).toBe('{"a":1}');
    expect(formatExpectMetaValue(OMIT_SENTINEL)).toBe('omit');
  });
});
