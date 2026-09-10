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
});
