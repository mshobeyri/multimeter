import {
  DEFAULT_TIME_VELOCITY,
  getTimeOperatorBase,
  getTimeOperatorVelocity,
  isTimeAnyOperator,
  makeTimeOperator,
  normalizeTimeVelocity,
  splitCheckOperatorPrefix,
} from './TestData';
import {evaluateComparison} from './expectCompare';
import {quoteExpectOperators} from './expectOperatorYaml';
import {parseComparisonParts} from './JSerTestFlow';
import {notTimeEquals_, timeDeltaMs_, timeEquals_, toEpochMs_} from './testHelper';

describe('time operator helpers', () => {
  it('embeds velocity as =5s~ / !5s~', () => {
    expect(makeTimeOperator('=s~', '5s')).toBe('=5s~');
    expect(makeTimeOperator('!s~', '1M30S')).toBe('!1m30s~');
    expect(makeTimeOperator('=s~', '')).toBe(`=${DEFAULT_TIME_VELOCITY}~`);
    expect(normalizeTimeVelocity('=2s~')).toBe('2s');
    expect(normalizeTimeVelocity('nope')).toBeUndefined();
    expect(getTimeOperatorVelocity('=s~')).toBe('1s');
    expect(getTimeOperatorVelocity('=100ms~')).toBe('100ms');
    expect(getTimeOperatorBase('!5s~')).toBe('!s~');
    expect(isTimeAnyOperator('=1m~')).toBe(true);
    expect(isTimeAnyOperator('=~')).toBe(false);
  });

  it('splits =5s~ prefixes without eating the expected value', () => {
    expect(splitCheckOperatorPrefix('=5s~ 2026-09-18T12:00:00Z')).toEqual({
      operator: '=5s~',
      expected: '2026-09-18T12:00:00Z',
    });
    expect(splitCheckOperatorPrefix('=s~ 14:30:00')).toEqual({
      operator: '=s~',
      expected: '14:30:00',
    });
    expect(splitCheckOperatorPrefix('=~ true')).toEqual({
      operator: '=~',
      expected: 'true',
    });
    expect(splitCheckOperatorPrefix('>80% John')).toEqual({
      operator: '>80%',
      expected: 'John',
    });
  });
});

describe('toEpochMs_ and timeEquals_', () => {
  it('parses ISO, epoch, Date, and time-of-day values', () => {
    expect(toEpochMs_('2026-09-18T12:00:00Z')).toBe(Date.parse('2026-09-18T12:00:00Z'));
    expect(toEpochMs_(1_000_000_000)).toBe(1_000_000_000_000);
    expect(toEpochMs_(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toEpochMs_(new Date('2026-01-01T00:00:00Z'))).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(toEpochMs_('14:30:00')).toBe(((14 * 60) + 30) * 60 * 1000);
    expect(toEpochMs_('not-a-time')).toBeUndefined();
  });

  it('passes when the difference is within velocity', () => {
    expect(timeEquals_('2026-09-18T12:00:00Z', '2026-09-18T12:00:04Z', '5s')).toBe(true);
    expect(timeEquals_('2026-09-18T12:00:00Z', '2026-09-18T12:00:06Z', '5s')).toBe(false);
    expect(timeEquals_('14:30:00', '14:30:01', '2s')).toBe(true);
    expect(timeEquals_('14:30:00', '2026-09-18T14:30:00Z', '1s')).toBe(false);
    expect(notTimeEquals_('2026-09-18T12:00:00Z', '2026-09-18T12:00:06Z', '5s')).toBe(true);
    expect(notTimeEquals_('2026-09-18T12:00:00Z', '2026-09-18T12:00:04Z', '5s')).toBe(false);
    expect(timeDeltaMs_('2026-09-18T12:00:00Z', '2026-09-18T12:00:04Z')).toBe(4000);
  });

  it('evaluateComparison understands =5s~ / !5s~ forms', () => {
    expect(evaluateComparison('2026-09-18T12:00:00Z', '=5s~', '2026-09-18T12:00:04Z')).toBe(true);
    expect(evaluateComparison('2026-09-18T12:00:00Z', '=s~', '2026-09-18T12:00:04Z')).toBe(false);
    expect(evaluateComparison(true, '=~', 'true')).toBe(true);
    expect(evaluateComparison('2026-09-18T12:00:00Z', '!1s~', '2026-09-18T12:00:04Z')).toBe(true);
  });
});

describe('time operator parsing and YAML quoting', () => {
  it('parses inline comparisons with combined durations', () => {
    expect(parseComparisonParts('created =1m30s~ 2026-09-18T12:00:00Z')).toEqual({
      actual: 'created',
      operator: '=1m30s~',
      expected: '2026-09-18T12:00:00Z',
    });
    expect(parseComparisonParts('created !s~ "14:30:00"')).toEqual({
      actual: 'created',
      operator: '!s~',
      expected: '"14:30:00"',
    });
  });

  it('quotes !5s~ velocity operators in expect blocks', () => {
    expect(quoteExpectOperators('expect:\n  createdAt: !5s~ 2026-09-18T12:00:00Z'))
        .toContain('createdAt: "!5s~ 2026-09-18T12:00:00Z"');
    expect(quoteExpectOperators('steps:\n  - check:\n      operator: !1m~'))
        .toContain('operator: "!1m~"');
  });
});
