import {parseDocument} from 'yaml';
import {
  findTestCallAliasProblems,
  findTestCallInputsProblems,
  findMultilineDescriptionProblems,
} from './validator';

describe('validator test call checks', () => {
  function buildDoc(content: string) {
    return parseDocument(content);
  }

  it('flags missing call aliases for test documents', () => {
    const content = `type: test\nimport:\n  foo: ./api.mmt\nsteps:\n  - call: bar\n`;
    const doc = buildDoc(content);
    const problems = findTestCallAliasProblems(content, doc, 'test', {foo: './api.mmt'});
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      message: 'bar is not imported',
      severity: 'warning',
    });
  });

  it('ignores call alias issues when alias exists', () => {
    const content = `type: test\nimport:\n  foo: ./api.mmt\nsteps:\n  - call: foo\n`;
    const doc = buildDoc(content);
    const problems = findTestCallAliasProblems(content, doc, 'test', {foo: './api.mmt'});
    expect(problems).toHaveLength(0);
  });

  it('flags unknown call inputs based on imported schema', () => {
    const content = `type: test\nimport:\n  foo: ./api.mmt\nsteps:\n  - call: foo\n    inputs:\n      id: 1\n      extra: 2\n`;
    const doc = buildDoc(content);
    const problems = findTestCallInputsProblems(content, doc, 'test', {foo: ['id']});
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      message: 'Input "extra" is not defined in imported "foo"',
    });
  });

  it('allows known inputs when imported schema matches', () => {
    const content = `type: test\nimport:\n  foo: ./api.mmt\nsteps:\n  - call: foo\n    inputs:\n      id: 1\n`;
    const doc = buildDoc(content);
    const problems = findTestCallInputsProblems(content, doc, 'test', {foo: ['id']});
    expect(problems).toHaveLength(0);
  });
});

describe('findMultilineDescriptionProblems', () => {
  it('warns when multiline description has no block-scalar indicator', () => {
    const content = [
      'type: api',
      'description: first line',
      '  second line',
      'url: http://example.com',
    ].join('\n');
    const problems = findMultilineDescriptionProblems(content);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      message: 'Multiline description should use "|" block scalar indicator',
      severity: 'warning',
      line: 2,
    });
  });

  it('does not warn when block-scalar indicator is present', () => {
    const content = [
      'type: api',
      'description: |',
      '  first line',
      '  second line',
      'url: http://example.com',
    ].join('\n');
    const problems = findMultilineDescriptionProblems(content);
    expect(problems).toHaveLength(0);
  });

  it('does not warn for single-line description', () => {
    const content = [
      'type: api',
      'description: just one line',
      'url: http://example.com',
    ].join('\n');
    const problems = findMultilineDescriptionProblems(content);
    expect(problems).toHaveLength(0);
  });

  it('does not warn when folded-style indicator is used', () => {
    const content = [
      'type: api',
      'description: >',
      '  first line',
      '  second line',
    ].join('\n');
    const problems = findMultilineDescriptionProblems(content);
    expect(problems).toHaveLength(0);
  });
});
