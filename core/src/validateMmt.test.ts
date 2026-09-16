import {validateMmtContent} from './validateMmt';

describe('validateMmtContent', () => {
  it('accepts a minimal API file', () => {
    const result = validateMmtContent(
        [
          'type: api',
          'title: Echo',
          'url: https://example.com',
          'method: get',
          '',
        ].join('\n'),
        'echo.mmt');
    expect(result).toEqual({valid: true, detectedType: 'api', errors: []});
  });

  it('rejects type mismatches', () => {
    const result = validateMmtContent('type: api\nurl: https://example.com\n', 'a.mmt', 'test');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Expected type "test"/);
  });

  it('accepts a minimal test file', () => {
    const result = validateMmtContent(
        ['type: test', 'steps:', '  - check: 1 == 1', ''].join('\n'),
        'ok.mmt');
    expect(result).toEqual({valid: true, detectedType: 'test', errors: []});
  });

  it('rejects unimplemented document types', () => {
    const result = validateMmtContent('type: suite\nitems:\n  - a.mmt\n', 's.mmt');
    expect(result.valid).toBe(false);
    expect(result.detectedType).toBe('suite');
    expect(result.errors[0]).toMatch(/not implemented/i);
  });

  it('returns parser errors for invalid YAML', () => {
    const result = validateMmtContent('type: api\nurl: [\n', 'bad.mmt');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
