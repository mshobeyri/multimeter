import {parseDocument} from 'yaml';
import {
  applyCompatibilityFix,
  applyRenameYamlKeyOnLine,
  findCompatibilityProblems,
} from './compatibility';
import {validateYamlContent} from './Validate';

describe('compatibility deprecations', () => {
  it('warns when suite uses legacy tests instead of items', () => {
    const content = [
      'type: suite',
      'title: Legacy',
      'tests:',
      '  - login.mmt',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'suite');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      category: 'compatibility',
      severity: 'warning',
      message: expect.stringContaining('deprecated'),
      line: 3,
      applyFix: {kind: 'renameYamlKey', from: 'tests', to: 'items'},
    });
  });

  it('does not warn when suite already uses items', () => {
    const content = [
      'type: suite',
      'items:',
      '  - login.mmt',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'suite');
    expect(problems).toHaveLength(0);
  });

  it('renames tests: to items: on the matching line', () => {
    expect(applyRenameYamlKeyOnLine('tests:', 'tests', 'items')).toBe('items:');
    expect(applyRenameYamlKeyOnLine('  tests :', 'tests', 'items')).toBe('  items :');
    const updated = applyCompatibilityFix('type: suite\ntests:\n', {kind: 'renameYamlKey', from: 'tests', to: 'items'}, 2);
    expect(updated).toBe('type: suite\nitems:\n');
  });
});

describe('validateYamlContent suite legacy tests', () => {
  it('accepts legacy tests without requiring items', () => {
    const errors = validateYamlContent([
      'type: suite',
      'tests:',
      '  - ./tests/login.mmt',
    ].join('\n'));
    expect(errors.some((error) => String(error.message).includes("required property 'items'"))).toBe(false);
  });

  it('still requires items or tests on suite files', () => {
    const errors = validateYamlContent([
      'type: suite',
      'title: Empty',
    ].join('\n'));
    expect(errors.length).toBeGreaterThan(0);
  });
});
