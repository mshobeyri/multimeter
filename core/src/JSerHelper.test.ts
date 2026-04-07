import {normalizeTokenName, timeUnitToMs, toInputsParams} from './JSerHelper';

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
