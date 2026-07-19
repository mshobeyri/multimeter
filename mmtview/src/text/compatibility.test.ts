import {parseDocument} from 'yaml';
import {
  applyCompatibilityFix,
  applyRenameYamlKeyOnLine,
  findCompatibilityIssueAtPosition,
  findCompatibilityProblems,
} from './compatibility';

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

  it('finds the compatibility issue at a clicked position', () => {
    const content = [
      'type: suite',
      'title: Legacy',
      'tests:',
      '  - login.mmt',
    ].join('\n');
    const doc = parseDocument(content);
    const issue = findCompatibilityIssueAtPosition(content, doc, 'suite', 3, 2);
    expect(issue).toMatchObject({
      id: 'suite-tests-deprecated',
      applyFix: {kind: 'renameYamlKey', from: 'tests', to: 'items'},
    });
  });

  it('warns when api setenv references an outputs key name', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'outputs:',
      '  token: body.access_token',
      'setenv:',
      '  TOKEN: token',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      category: 'compatibility',
      severity: 'warning',
      message: expect.stringContaining('deprecated'),
      applyFix: {
        kind: 'replaceRange',
        text: 'body.access_token',
      },
    });
  });

  it('click-fix replaces legacy setenv output key with extraction expression', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'outputs:',
      '  token: body.access_token',
      'setenv:',
      '  TOKEN: token',
    ].join('\n');
    const doc = parseDocument(content);
    const issue = findCompatibilityIssueAtPosition(content, doc, 'api', 6, 10);
    expect(issue).not.toBeNull();
    const updated = applyCompatibilityFix(content, issue!.applyFix, issue!.line);
    expect(updated).toContain('TOKEN: body.access_token');
    expect(updated).not.toContain('TOKEN: token');
  });

  it('does not warn when setenv already uses extraction expressions', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'outputs:',
      '  token: body.access_token',
      'setenv:',
      '  TOKEN: body.access_token',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'api');
    expect(problems).toHaveLength(0);
  });
});
