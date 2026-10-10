import {envPanelValueView, resolveEnvPanelIncomingValue} from './envPanelValue';

describe('envPanelValue', () => {
  it('coerces manual text input to YAML types', () => {
    expect(resolveEnvPanelIncomingValue('10', 'manual')).toBe(10);
    expect(resolveEnvPanelIncomingValue('"10"', 'manual')).toBe('10');
    expect(resolveEnvPanelIncomingValue('true', 'manual')).toBe(true);
    expect(resolveEnvPanelIncomingValue('null', 'manual')).toBe(null);
    expect(resolveEnvPanelIncomingValue('hello', 'manual')).toBe('hello');
  });

  it('keeps already-typed file option values', () => {
    expect(resolveEnvPanelIncomingValue(10, 'file')).toBe(10);
    expect(resolveEnvPanelIncomingValue('10', 'file')).toBe('10');
    expect(resolveEnvPanelIncomingValue(true, 'file')).toBe(true);
    expect(resolveEnvPanelIncomingValue(null, 'file')).toBe(null);
  });

  it('formats display text and type chips like other value fields', () => {
    expect(envPanelValueView(10)).toEqual({displayValue: '10', typeLabel: 'num'});
    expect(envPanelValueView('10')).toEqual({
      displayValue: '"10"',
      typeLabel: 'str',
    });
    expect(envPanelValueView(true)).toEqual({
      displayValue: 'true',
      typeLabel: 'bool',
    });
    expect(envPanelValueView(null)).toEqual({
      displayValue: 'null',
      typeLabel: 'null',
    });
    expect(envPanelValueView('')).toEqual({displayValue: '', typeLabel: ''});
  });

  it('labels file-backed ./….mmt values as live', () => {
    expect(envPanelValueView('./create_session.mmt')).toEqual({
      displayValue: './create_session.mmt',
      typeLabel: 'live',
    });
    expect(envPanelValueView('./nested/x.mmt')).toEqual({
      displayValue: './nested/x.mmt',
      typeLabel: 'live',
    });
  });
});
