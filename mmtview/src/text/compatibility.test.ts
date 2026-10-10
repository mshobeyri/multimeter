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

  it('warns when api example uses deprecated name and click-expands to id/title', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - name: legacy',
      '    inputs:',
      '      x: 1',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      category: 'compatibility',
      severity: 'warning',
      message: expect.stringContaining('deprecated'),
      line: 4,
      applyFix: {
        kind: 'replaceRange',
        text: expect.stringContaining('id: legacy'),
      },
    });
    expect(problems[0].applyFix).toMatchObject({
      kind: 'replaceRange',
      text: expect.stringContaining('title: legacy'),
    });

    const issue = findCompatibilityIssueAtPosition(content, doc, 'api', 4, 5);
    expect(issue).not.toBeNull();
    const updated = applyCompatibilityFix(content, issue!.applyFix, issue!.line);
    expect(updated).toContain('id: legacy');
    expect(updated).toContain('title: legacy');
    expect(updated).not.toContain('name: legacy');
  });

  it('preserves the example list marker when expanding name on its first field', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - name: legacy',
      '    outputs:',
      '      status: 200',
    ].join('\n');
    const doc = parseDocument(content);
    const issue = findCompatibilityIssueAtPosition(content, doc, 'api', 4, 5);
    expect(issue).not.toBeNull();

    const expanded = applyCompatibilityFix(content, issue!.applyFix, issue!.line);
    expect(expanded).toBe([
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: legacy',
      '    title: legacy',
      '    outputs:',
      '      status: 200',
    ].join('\n'));
    expect(parseDocument(expanded!).errors).toHaveLength(0);

    const expandedDoc = parseDocument(expanded!);
    const outputsIssue = findCompatibilityIssueAtPosition(expanded!, expandedDoc, 'api', 6, 6);
    expect(outputsIssue).not.toBeNull();
    const migrated = applyCompatibilityFix(expanded!, outputsIssue!.applyFix, outputsIssue!.line);
    expect(migrated).toBe([
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: legacy',
      '    title: legacy',
      '    expect:',
      '      status: 200',
    ].join('\n'));
    expect(parseDocument(migrated!).errors).toHaveLength(0);
  });

  it('click-fix fills only the missing id or title when the other is present', () => {
    const withId = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: keep',
      '    name: only-title',
    ].join('\n');
    const docId = parseDocument(withId);
    const issueId = findCompatibilityIssueAtPosition(withId, docId, 'api', 5, 5);
    const fixedId = applyCompatibilityFix(withId, issueId!.applyFix, issueId!.line);
    expect(fixedId).toContain('id: keep');
    expect(fixedId).toContain('title: only-title');
    expect(fixedId).not.toContain('name:');

    const withBoth = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: keep',
      '    title: Keep',
      '    name: drop',
    ].join('\n');
    const docBoth = parseDocument(withBoth);
    const issueBoth = findCompatibilityIssueAtPosition(withBoth, docBoth, 'api', 6, 5);
    const fixedBoth = applyCompatibilityFix(withBoth, issueBoth!.applyFix, issueBoth!.line);
    expect(fixedBoth).toContain('id: keep');
    expect(fixedBoth).toContain('title: Keep');
    expect(fixedBoth).not.toContain('name:');
  });

  it('warns when api example uses deprecated outputs and click-renames to expect', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: ok',
      '    outputs:',
      '      status: 200',
    ].join('\n');
    const doc = parseDocument(content);
    const problems = findCompatibilityProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      category: 'compatibility',
      severity: 'warning',
      message: expect.stringContaining('deprecated'),
      applyFix: {kind: 'renameYamlKey', from: 'outputs', to: 'expect'},
    });
    const issue = findCompatibilityIssueAtPosition(content, doc, 'api', 5, 5);
    const updated = applyCompatibilityFix(content, issue!.applyFix, issue!.line);
    expect(updated).toContain('expect:');
    expect(updated).not.toContain('outputs:');
  });
});
