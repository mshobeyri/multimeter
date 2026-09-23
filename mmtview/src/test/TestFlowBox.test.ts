import { coerceRepeatOrDelayValue } from './TestFlowBox';

describe('coerceRepeatOrDelayValue', () => {
  it('coerces integer counts to numbers', () => {
    expect(coerceRepeatOrDelayValue('2')).toBe(2);
    expect(coerceRepeatOrDelayValue('100')).toBe(100);
  });

  it('keeps duration strings as strings', () => {
    expect(coerceRepeatOrDelayValue('1s')).toBe('1s');
    expect(coerceRepeatOrDelayValue('5m3s')).toBe('5m3s');
    expect(coerceRepeatOrDelayValue('2ms')).toBe('2ms');
  });

  it('returns empty string for blank input', () => {
    expect(coerceRepeatOrDelayValue('')).toBe('');
    expect(coerceRepeatOrDelayValue('   ')).toBe('');
  });
});
