import {parseDocument} from 'yaml';
import {
  extractEnvRefSites,
  extractExampleLineInfo,
  extractInputRefSites,
  findTestCallAliasProblems,
  findTestCallInputsProblems,
  findMultilineDescriptionProblems,
  findStageAfterProblems,
  findAuthProblems,
  extractSuiteTestLineInfo,
  getUndefinedExpectKeyDecorations,
  offsetToLineNumber,
} from './validator';

describe('offsetToLineNumber', () => {
  it('maps byte offsets to 1-based lines with CRLF endings', () => {
    const content = ['line1', 'line2', 'line3'].join('\r\n');
    expect(offsetToLineNumber(content, 0)).toBe(1);
    expect(offsetToLineNumber(content, 7)).toBe(2); // start of "line2"
    expect(offsetToLineNumber(content, 14)).toBe(3); // start of "line3"
  });

  it('treats CRLF as a single line break (not two)', () => {
    const content = 'a\r\nb';
    expect(offsetToLineNumber(content, 1)).toBe(1); // \r before \n
    expect(offsetToLineNumber(content, 3)).toBe(2); // b on second line
  });
});

describe('extractExampleLineInfo', () => {
  it('uses the name key line when description precedes name', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - description: first',
      '    name: Example One',
      '    inputs:',
      '      user: alice',
      '  - name: Inline Example',
      '    inputs:',
      '      user: bob',
    ].join('\n');
    const doc = parseDocument(content);
    const lines = extractExampleLineInfo(doc, content);
    expect(lines).toEqual([
      {index: 0, line: 5},
      {index: 1, line: 8},
    ]);
  });

  it('aligns example run glyphs on name with Windows CRLF', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - description: first',
      '    name: Example One',
      '    inputs:',
      '      user: alice',
      '  - name: Inline Example',
      '    inputs:',
      '      user: bob',
    ].join('\r\n');
    const doc = parseDocument(content);
    const lines = extractExampleLineInfo(doc, content);
    expect(lines).toEqual([
      {index: 0, line: 5},
      {index: 1, line: 8},
    ]);
  });

  it('falls back to the list item line when name is missing', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - inputs:',
      '      user: alice',
    ].join('\n');
    const doc = parseDocument(content);
    const lines = extractExampleLineInfo(doc, content);
    expect(lines).toEqual([{index: 0, line: 4}]);
  });
});

describe('token site extraction', () => {
  it('extracts input refs with accessor syntax', () => {
    const content = [
      'type: api',
      'body:',
      '  first: <<i:message[0:1]>>',
      '  nested: i:profile.name',
    ].join('\n');
    const sites = extractInputRefSites(content);
    expect(sites.map((s) => s.name).sort()).toEqual(['message', 'profile']);
    expect(sites.some((s) => s.length >= 'i:message[0:1]'.length)).toBe(true);
  });

  it('extracts env refs with accessor syntax', () => {
    const content = [
      'type: api',
      'url: <<e:base_url[0:8]>>',
      'headers:',
      '  X-User: <<e:user.name>>',
      '  X-Token: e:token[0]'
    ].join('\n');
    const sites = extractEnvRefSites(content);
    expect(sites.map((s) => s.name).sort()).toEqual(['base_url', 'token', 'user']);
    expect(sites.some((s) => s.length >= 'e:base_url[0:8]'.length)).toBe(true);
  });
});

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

  it('does not warn for default response outputs or paths below them', () => {
    const content = [
      'type: test',
      'import:',
      '  login: ./login.api.mmt',
      'steps:',
      '  - call: login',
      '    expect:',
      '      status: 200',
      '      body.user.id: 123',
      '      headers.Content-Type: application/json',
      '      cookies.sessionId: != null',
    ].join('\n');
    const doc = buildDoc(content);
    const monaco = {
      Range: class Range {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number) {}
      },
    };
    const model = {
      getPositionAt: (offset: number) => {
        const before = content.slice(0, offset).split('\n');
        return {
          lineNumber: before.length,
          column: before[before.length - 1].length + 1,
        };
      },
    };

    const decorations = getUndefinedExpectKeyDecorations(
        monaco, model, content, doc, 'test',
        {login: ['body', 'headers', 'cookies', 'status', 'duration']},
        'warning');

    expect(decorations).toHaveLength(0);
  });

  it('allows hidden default output paths', () => {
    const content = [
      'type: test',
      'import:',
      '  login: ./login.api.mmt',
      'steps:',
      '  - call: login',
      '    expect:',
      '      _.body.body.message: hello',
      '      _.status: 200',
    ].join('\n');
    const doc = buildDoc(content);
    const monaco = {
      Range: class Range {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number) {}
      },
    };
    const model = {
      getPositionAt: (offset: number) => {
        const before = content.slice(0, offset).split('\n');
        return {
          lineNumber: before.length,
          column: before[before.length - 1].length + 1,
        };
      },
    };

    const decorations = getUndefinedExpectKeyDecorations(
        monaco, model, content, doc, 'test',
        {login: ['body', 'headers', 'cookies', 'status', 'duration']},
        'warning');

    expect(decorations).toHaveLength(0);
  });

  it('still warns for output paths with an unknown root', () => {
    const content = [
      'type: test',
      'import:',
      '  login: ./login.api.mmt',
      'steps:',
      '  - call: login',
      '    expect:',
      '      unknown.value: true',
    ].join('\n');
    const doc = buildDoc(content);
    const monaco = {
      Range: class Range {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number) {}
      },
    };
    const model = {
      getPositionAt: (offset: number) => {
        const before = content.slice(0, offset).split('\n');
        return {
          lineNumber: before.length,
          column: before[before.length - 1].length + 1,
        };
      },
    };

    const decorations = getUndefinedExpectKeyDecorations(
        monaco, model, content, doc, 'test',
        {login: ['body', 'headers', 'cookies', 'status', 'duration']},
        'warning');

    expect(decorations).toHaveLength(1);
  });

  it('still warns for paths below scalar default outputs', () => {
    const content = [
      'type: test',
      'import:',
      '  login: ./login.api.mmt',
      'steps:',
      '  - call: login',
      '    expect:',
      '      status.code: 200',
      '      duration.ms: 20',
    ].join('\n');
    const doc = buildDoc(content);
    const monaco = {
      Range: class Range {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number) {}
      },
    };
    const model = {
      getPositionAt: (offset: number) => {
        const before = content.slice(0, offset).split('\n');
        return {
          lineNumber: before.length,
          column: before[before.length - 1].length + 1,
        };
      },
    };

    const decorations = getUndefinedExpectKeyDecorations(
        monaco, model, content, doc, 'test',
        {login: ['body', 'headers', 'cookies', 'status', 'duration']},
        'warning');

    expect(decorations).toHaveLength(2);
  });
});

describe('suite file reference extraction', () => {
  it('extracts suite-level servers and items for missing file markers', () => {
    const content = [
      'type: suite',
      'servers:',
      '  - mocks/missing-server.mmt',
      'items:',
      '  - then',
      '  - tests/login.mmt',
    ].join('\n');
    const doc = parseDocument(content);
    const refs = extractSuiteTestLineInfo(doc, content);
    expect(refs).toEqual([
      {path: 'mocks/missing-server.mmt', line: 3},
      {path: 'tests/login.mmt', line: 6},
    ]);
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
