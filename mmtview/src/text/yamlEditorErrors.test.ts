import {collectYamlEditorErrors} from './yamlEditorErrors';

describe('collectYamlEditorErrors', () => {
  it('returns no errors for a valid API file', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'method: get',
      '',
    ].join('\n');
    expect(collectYamlEditorErrors(content)).toEqual([]);
  });

  it('returns parse errors for broken YAML', () => {
    const content = [
      'type: api',
      'url: { broken',
      '',
    ].join('\n');
    const errors = collectYamlEditorErrors(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
    expect(errors[0].line).toBeGreaterThan(0);
  });

  it('returns schema errors for unknown properties', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'method: get',
      'notARealField: true',
      '',
    ].join('\n');
    const errors = collectYamlEditorErrors(content);
    expect(errors.some((error) => error.message.includes('notARealField'))).toBe(true);
  });

  it('returns nothing for empty content', () => {
    expect(collectYamlEditorErrors('')).toEqual([]);
    expect(collectYamlEditorErrors('   \n')).toEqual([]);
  });
});
