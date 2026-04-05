import {parseDocument} from 'yaml';
import {
  findTestCallAliasProblems,
  findTestCallInputsProblems,
  findMultilineDescriptionProblems,
  findStageAfterProblems,
  findAuthProblems,
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

describe('findStageAfterProblems', () => {
  function buildDoc(content: string) {
    return parseDocument(content);
  }

  it('flags after referencing a non-existent stage id', () => {
    const content = [
      'type: test',
      'stages:',
      '  - id: auth',
      '    steps:',
      '      - call: login',
      '  - id: profile',
      '    after: nonexistent',
      '    steps:',
      '      - call: getProfile',
    ].join('\n');
    const doc = buildDoc(content);
    const problems = findStageAfterProblems(content, doc, 'test');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      message: '"nonexistent" is not a valid stage id',
      severity: 'error',
    });
  });

  it('does not flag after referencing a valid stage id', () => {
    const content = [
      'type: test',
      'stages:',
      '  - id: auth',
      '    steps:',
      '      - call: login',
      '  - id: profile',
      '    after: auth',
      '    steps:',
      '      - call: getProfile',
    ].join('\n');
    const doc = buildDoc(content);
    const problems = findStageAfterProblems(content, doc, 'test');
    expect(problems).toHaveLength(0);
  });

  it('flags invalid entries in after array', () => {
    const content = [
      'type: test',
      'stages:',
      '  - id: auth',
      '    steps:',
      '      - call: login',
      '  - id: setup',
      '    steps:',
      '      - call: init',
      '  - id: profile',
      '    after:',
      '      - auth',
      '      - missing',
      '    steps:',
      '      - call: getProfile',
    ].join('\n');
    const doc = buildDoc(content);
    const problems = findStageAfterProblems(content, doc, 'test');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      message: '"missing" is not a valid stage id',
      severity: 'error',
    });
  });

  it('returns no problems for non-test documents', () => {
    const content = 'type: api\nurl: http://example.com\n';
    const doc = buildDoc(content);
    const problems = findStageAfterProblems(content, doc, 'api');
    expect(problems).toHaveLength(0);
  });
});

describe('findAuthProblems', () => {
  function buildDoc(content: string) {
    return parseDocument(content);
  }

  it('returns no problems when auth is absent', () => {
    const content = 'type: api\nurl: http://example.com\n';
    const doc = buildDoc(content);
    expect(findAuthProblems(content, doc, 'api')).toHaveLength(0);
  });

  it('returns no problems for auth: none', () => {
    const content = 'type: api\nurl: http://example.com\nauth: none\n';
    const doc = buildDoc(content);
    expect(findAuthProblems(content, doc, 'api')).toHaveLength(0);
  });

  it('flags invalid string auth value', () => {
    const content = 'type: api\nurl: http://example.com\nauth: invalid\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe('error');
    expect(problems[0].message).toContain('invalid');
  });

  it('flags missing type field', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  token: abc\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('type');
  });

  it('flags bearer without token', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  type: bearer\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('token');
  });

  it('returns no problems for valid bearer', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  type: bearer\n  token: abc\n';
    const doc = buildDoc(content);
    expect(findAuthProblems(content, doc, 'api')).toHaveLength(0);
  });

  it('flags basic without username or password', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  type: basic\n  username: user\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('password');
  });

  it('flags api-key with both header and query', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  type: api-key\n  header: X-Key\n  query: key\n  value: abc\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('exactly one');
  });

  it('flags oauth2 without token_url', () => {
    const content = 'type: api\nurl: http://example.com\nauth:\n  type: oauth2\n  grant: client_credentials\n  client_id: id\n  client_secret: secret\n';
    const doc = buildDoc(content);
    const problems = findAuthProblems(content, doc, 'api');
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('token_url');
  });

  it('ignores non-api documents', () => {
    const content = 'type: test\nauth:\n  type: bearer\n';
    const doc = buildDoc(content);
    expect(findAuthProblems(content, doc, 'test')).toHaveLength(0);
  });
});
