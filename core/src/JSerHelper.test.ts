import {durationToJsMsExpr, isDurationExpression, normalizeTokenName, parseDurationString, timeUnitToMs, toInputsParams, toLowerUnderscore} from './JSerHelper';

describe('toLowerUnderscore', () => {
  test('replaces spaces with underscores and lowercases', () => {
    expect(toLowerUnderscore('First Title')).toBe('first_title');
  });

  test('removes invalid identifier characters such as em dashes', () => {
    expect(toLowerUnderscore('Control Flow — for loop')).toBe('control_flow_for_loop');
  });

  test('collapses consecutive separators', () => {
    expect(toLowerUnderscore('a---b')).toBe('a_b');
    expect(toLowerUnderscore('a   b')).toBe('a_b');
  });

  test('prefixes names that start with a digit', () => {
    expect(toLowerUnderscore('404 Not Found')).toBe('_404_not_found');
  });

  test('returns empty string for blank input', () => {
    expect(toLowerUnderscore('   ')).toBe('');
    expect(toLowerUnderscore('---')).toBe('');
  });

  test('preserves trailing underscores from already-normalized names', () => {
    expect(toLowerUnderscore('first_')).toBe('first_');
  });
});

describe('normalizeTokenName', () => {
  test('converts camelCase to snake_case', () => {
    expect(normalizeTokenName('firstName')).toBe('first_name');
  });

  test('converts PascalCase to snake_case', () => {
    expect(normalizeTokenName('FirstName')).toBe('first_name');
  });

  test('replaces hyphens with underscores', () => {
    expect(normalizeTokenName('my-token')).toBe('my_token');
  });

  test('replaces spaces with underscores', () => {
    expect(normalizeTokenName('my token')).toBe('my_token');
  });

  test('handles multiple consecutive separators', () => {
    expect(normalizeTokenName('my--token')).toBe('my_token');
    expect(normalizeTokenName('my  token')).toBe('my_token');
  });

  test('lowercases everything', () => {
    expect(normalizeTokenName('ALLCAPS')).toBe('allcaps');
  });

  test('handles already normalized input', () => {
    expect(normalizeTokenName('already_normalized')).toBe('already_normalized');
  });
});

describe('timeUnitToMs', () => {
  test('converts nanoseconds', () => {
    expect(timeUnitToMs(1000000, 'ns')).toBe(1);
    expect(timeUnitToMs(500, 'ns')).toBeCloseTo(0.0005);
  });

  test('passes milliseconds through', () => {
    expect(timeUnitToMs(100, 'ms')).toBe(100);
  });

  test('converts seconds', () => {
    expect(timeUnitToMs(1, 's')).toBe(1000);
    expect(timeUnitToMs(2.5, 's')).toBe(2500);
  });

  test('converts minutes', () => {
    expect(timeUnitToMs(1, 'm')).toBe(60000);
  });

  test('converts hours', () => {
    expect(timeUnitToMs(1, 'h')).toBe(3600000);
  });

  test('defaults to pass-through for unknown units', () => {
    expect(timeUnitToMs(42, 'x')).toBe(42);
  });
});

describe('parseDurationString', () => {
  test('parses single-unit durations', () => {
    expect(parseDurationString('2s')).toBe(2000);
    expect(parseDurationString('5m')).toBe(300000);
    expect(parseDurationString('1h')).toBe(3600000);
    expect(parseDurationString('500ms')).toBe(500);
  });

  test('parses combined durations', () => {
    expect(parseDurationString('1h5m')).toBe(3900000);
    expect(parseDurationString('5m3s')).toBe(303000);
    expect(parseDurationString('1h30m15s')).toBe(5415000);
    expect(parseDurationString('1s500ms')).toBe(1500);
  });

  test('rejects bare numbers and inf', () => {
    expect(parseDurationString('500')).toBeUndefined();
    expect(parseDurationString('3')).toBeUndefined();
    expect(parseDurationString('inf')).toBeUndefined();
    expect(parseDurationString('')).toBeUndefined();
  });

  test('accepts numeric input as milliseconds', () => {
    expect(parseDurationString(250)).toBe(250);
  });

  test('isDurationExpression identifies duration strings', () => {
    expect(isDurationExpression('1h5m')).toBe(true);
    expect(isDurationExpression('3')).toBe(false);
    expect(isDurationExpression('inf')).toBe(false);
  });
});

describe('durationToJsMsExpr', () => {
  test('inlines static combined durations', () => {
    expect(durationToJsMsExpr('1h5m')).toBe('3900000');
    expect(durationToJsMsExpr(500)).toBe('500');
    expect(durationToJsMsExpr('500')).toBe('500');
  });

  test('uses runtime parser for dynamic values', () => {
    expect(durationToJsMsExpr('${delay}')).toContain('__parseDurationMs');
  });
});

describe('toInputsParams – env token handling', () => {
  test('two <<e:VAR>> tokens separated by underscore', () => {
    const result = toInputsParams({message: '<<e:base_url>>_<<e:base_url>>'}, ': ');
    expect(result).toBe('message: `${envVariables.base_url}_${envVariables.base_url}`');
  });

  test('single <<e:VAR>> as full value returns bare reference', () => {
    const result = toInputsParams({host: '<<e:base_url>>'}, ': ');
    expect(result).toBe('host: envVariables.base_url');
  });

  test('e:VAR mixed with static text', () => {
    const result = toInputsParams({url: 'https://<<e:host>>/api'}, ': ');
    expect(result).toBe('url: `https://${envVariables.host}/api`');
  });
});
