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

  it('warns on deprecated =~ as-string operator and click-fixes to =S', () => {
    const content = [
      'type: test',
      'steps:',
      '  - check: ${xml.active} =~ true',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'test');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      category: 'compatibility',
      severity: 'warning',
      message: expect.stringContaining('deprecated'),
      applyFix: {kind: 'replaceRange', text: '=S'},
    });
    const issue = findCompatibilityIssueAtPosition(content, doc, 'test', problems[0].line, problems[0].column);
    expect(issue).not.toBeNull();
    const updated = applyCompatibilityFix(content, issue!.applyFix, issue!.line);
    expect(updated).toContain('${xml.active} =S true');
    expect(updated).not.toContain('=~');
  });

  it('warns on deprecated !~ and click-fixes to !S', () => {
    const content = [
      'type: test',
      'steps:',
      '  - check: ${code} !~ 0',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'test');
    expect(problems).toHaveLength(1);
    expect(problems[0].applyFix).toMatchObject({kind: 'replaceRange', text: '!S'});
    const updated = applyCompatibilityFix(content, problems[0].applyFix, problems[0].line);
    expect(updated).toContain('${code} !S 0');
    expect(updated).not.toContain('!~');
  });

  it('still warns on =~ when the YAML document has parse errors', () => {
    const content = [
      'type: test',
      'steps:',
      '  - check: ${xml.active} =~ true',
      '  - check: [',
    ].join('\n');
    const doc = parseDocument(content);
    expect(doc.errors.length).toBeGreaterThan(0);
    const problems = findCompatibilityProblems(content, doc, 'test');
    expect(problems).toHaveLength(1);
    expect(problems[0].applyFix).toMatchObject({kind: 'replaceRange', text: '=S'});
  });

  it('does not treat =5s~ time operators as deprecated as-string', () => {
    const content = [
      'type: test',
      'steps:',
      '  - check: ${createdAt} =5s~ 2026-09-18T12:00:00Z',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'test');
    expect(problems).toHaveLength(0);
  });
});
