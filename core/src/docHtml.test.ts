import { extractEndpoint, parseParamDescriptions, extractSources, buildDocHtml, simpleMarkdownToHtml, parseRefDescription, extractMarkdownSection, resolveRefPath } from './docHtml';
import { buildDocMarkdown } from './docMarkdown';

describe('parseParamDescriptions', () => {
  test('extracts <<i:xxx>> annotations', () => {
    const desc = `Some description
  <<i:userId>> The user identifier
  <<i:name>> The user name`;
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('Some description');
    expect(params.inputs).toEqual({ userId: 'The user identifier', name: 'The user name' });
    expect(params.outputs).toEqual({});
  });

  test('extracts <<o:xxx>> annotations', () => {
    const desc = `Get user info
  <<o:status>> The response status
  <<o:data>> The response data`;
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('Get user info');
    expect(params.outputs).toEqual({ status: 'The response status', data: 'The response data' });
    expect(params.inputs).toEqual({});
  });

  test('extracts mixed <<i:xxx>> and <<o:xxx>>', () => {
    const desc = `My API
  <<i:id>> The identifier
  <<o:result>> The result value`;
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('My API');
    expect(params.inputs).toEqual({ id: 'The identifier' });
    expect(params.outputs).toEqual({ result: 'The result value' });
  });

  test('returns empty maps when no annotations', () => {
    const desc = 'Just a plain description';
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('Just a plain description');
    expect(params.inputs).toEqual({});
    expect(params.outputs).toEqual({});
  });

  test('handles empty description', () => {
    const { cleaned, params } = parseParamDescriptions('');
    expect(cleaned).toBe('');
    expect(params.inputs).toEqual({});
    expect(params.outputs).toEqual({});
  });

  test('extracts inline <<o:xxx>> annotations (YAML-folded single line)', () => {
    const desc = 'Return list of all users. <<o:users>> List of users';
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('Return list of all users.');
    expect(params.outputs).toEqual({ users: 'List of users' });
    expect(params.inputs).toEqual({});
  });

  test('extracts inline <<i:xxx>> annotations (YAML-folded single line)', () => {
    const desc = 'Add a new user. <<i:username>> Should be email of the user.';
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('Add a new user.');
    expect(params.inputs).toEqual({ username: 'Should be email of the user.' });
    expect(params.outputs).toEqual({});
  });

  test('extracts multiple inline annotations on single line', () => {
    const desc = 'My API <<i:id>> The identifier <<o:result>> The result value';
    const { cleaned, params } = parseParamDescriptions(desc);
    expect(cleaned).toBe('My API');
    expect(params.inputs).toEqual({ id: 'The identifier' });
    expect(params.outputs).toEqual({ result: 'The result value' });
  });
});

describe('buildDocHtml param descriptions', () => {
  test('renders Description column in inputs table when <<i:xxx>> present', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<i:userId>> The user ID\n  <<i:name>> The user name',
      inputs: { userId: '123', name: 'test' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Description</th>');
    expect(html).toContain('The user ID');
    expect(html).toContain('The user name');
    expect(html).toContain('param-desc');
  });

  test('renders Description column in outputs table when <<o:xxx>> present', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<o:status>> The HTTP status',
      outputs: { status: '$.status' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('The HTTP status');
    expect(html).toContain('param-desc');
  });

  test('both tables get Description column when only one side annotated', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<i:userId>> The user ID',
      inputs: { userId: '123' },
      outputs: { status: '$.status' },
    }];
    const html = buildDocHtml(apis);
    const matches = html.match(/cols-3/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  test('extracts inline <<i:xxx>> into table Description column', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Uses <<i:token>> for auth',
      inputs: { token: 'xxx' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Description</th>');
    expect(html).toContain('for auth');
    expect(html).toContain('param-desc');
    // The annotation should be extracted, not left as raw text in description
    expect(html).not.toContain('&lt;&lt;i:token&gt;&gt;');
  });

  test('no Description column when no annotations', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Plain description',
      inputs: { userId: '123' },
    }];
    const html = buildDocHtml(apis);
    expect(html).not.toContain('class="param-table cols-3"');
    expect(html).not.toContain('<th>Description</th>');
  });

  test('renders Description column in outputs table with inline <<o:xxx>> (YAML-folded)', () => {
    const apis = [{
      title: 'Get Users', method: 'GET', url: 'http://example.com/users', format: 'json',
      description: 'Return list of all users. <<o:users>> List of users',
      outputs: { users: 'body[users]' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Description</th>');
    expect(html).toContain('List of users');
    expect(html).toContain('param-desc');
    // The annotation should NOT appear as raw text in the description div
    expect(html).not.toContain('&lt;&lt;o:users&gt;&gt;');
  });
});

describe('buildDocMarkdown param descriptions', () => {
  test('renders Description column in inputs table when <<i:xxx>> present', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<i:userId>> The user ID',
      inputs: { userId: '123' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('|Parameter|Default|Description|');
    expect(md).toContain('The user ID');
  });

  test('renders Description column in outputs table when <<o:xxx>> present', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<o:data>> The response body',
      outputs: { data: '$.body' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('|Parameter|Path|Description|');
    expect(md).toContain('The response body');
  });

  test('both tables get Description column when only one side annotated', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'My API\n  <<o:data>> The response body',
      inputs: { userId: '123' },
      outputs: { data: '$.body' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('|Parameter|Default|Description|');
    expect(md).toContain('|Parameter|Path|Description|');
  });

  test('extracts inline <<i:xxx>> into table Description column in markdown', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Uses <<i:token>> for auth',
      inputs: { token: 'xxx' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('Description|');
    expect(md).toContain('for auth');
    // The annotation should be extracted, not left in description
    expect(md).not.toContain('<<i:token>>');
  });
});

describe('extractSources', () => {
  test('extracts i:xxx references', () => {
    expect(extractSources('Bearer i:token')).toBe('i:token');
  });

  test('extracts e:xxx references', () => {
    expect(extractSources('e:baseUrl/api')).toBe('e:baseUrl');
  });

  test('extracts multiple references', () => {
    expect(extractSources('i:user and e:env_key')).toBe('i:user, e:env_key');
  });

  test('returns empty for fixed values', () => {
    expect(extractSources('application/json')).toBe('');
    expect(extractSources('12345')).toBe('');
  });

  test('deduplicates references', () => {
    expect(extractSources('i:token i:token')).toBe('i:token');
  });
});

describe('buildDocHtml Source column', () => {
  test('renders Source column in headers table when values contain i: or e: references', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      headers: { Authorization: 'Bearer i:token', 'Content-Type': 'application/json' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Source</th>');
    expect(html).toContain('i:token');
    expect(html).toContain('param-source');
  });

  test('Source column always present in headers table even with fixed values', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      headers: { 'Content-Type': 'application/json' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Source</th>');
  });

  test('renders Source column in query table when values have references', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      query: { userId: 'i:userId', page: '1' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('<th>Source</th>');
    expect(html).toContain('i:userId');
  });
});

describe('buildDocMarkdown Source column', () => {
  test('renders Source column in headers table when values contain references', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      headers: { Authorization: 'Bearer i:token', 'Content-Type': 'application/json' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('Source|');
    expect(md).toContain('i:token');
  });

  test('Source column always present in headers table even with fixed values', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      headers: { 'Content-Type': 'application/json' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('Source|');
  });
});

describe('extractEndpoint', () => {
  test('handles http URL', () => {
    expect(extractEndpoint('http://example.com/as?x=1')).toBe('/as');
    expect(extractEndpoint('https://example.com/api/v1/users?id=2')).toBe('/api/v1/users');
  });

  test('handles env-style e:url prefix', () => {
    expect(extractEndpoint('e:url/as')).toBe('/as');
    expect(extractEndpoint('E:URL/users/list?debug=true')).toBe('/users/list');
  });

  test('handles plain absolute path', () => {
    expect(extractEndpoint('/xxx/yyy')).toBe('/xxx/yyy');
    expect(extractEndpoint('/xxx/yyy?z=1')).toBe('/xxx/yyy');
  });

  test('ignores schemes and double slashes', () => {
    expect(extractEndpoint('http://host//double//slashes?x=1')).toBe('/double//slashes');
  });

  test('returns empty for no slash', () => {
    expect(extractEndpoint('noslash')).toBe('');
    expect(extractEndpoint('abc?query')).toBe('');
  });
});

describe('simpleMarkdownToHtml', () => {
  test('converts bold, italic, and inline code', () => {
    const html = simpleMarkdownToHtml('**bold** and *italic* and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  test('converts > heading to default h4', () => {
    const html = simpleMarkdownToHtml('> My Section');
    expect(html).toBe('<h4>My Section</h4>');
  });

  test('converts > heading to specified tag', () => {
    const html = simpleMarkdownToHtml('> My Section', 'h3');
    expect(html).toBe('<h3>My Section</h3>');
  });

  test('converts ## heading to h3', () => {
    const html = simpleMarkdownToHtml('## Sub Heading');
    expect(html).toBe('<h3>Sub Heading</h3>');
  });

  test('converts ### heading to h4', () => {
    const html = simpleMarkdownToHtml('### Minor Heading');
    expect(html).toBe('<h4>Minor Heading</h4>');
  });

  test('converts mixed ## and ### headings with content', () => {
    const html = simpleMarkdownToHtml('## Section\nSome text\n### Sub-section\nMore text');
    expect(html).toContain('<h3>Section</h3>');
    expect(html).toContain('<h4>Sub-section</h4>');
    expect(html).toContain('Some text');
    expect(html).toContain('More text');
  });

  test('converts unordered list', () => {
    const html = simpleMarkdownToHtml('- item one\n- item two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<li>item two</li>');
    expect(html).toContain('</ul>');
  });

  test('converts ordered list', () => {
    const html = simpleMarkdownToHtml('1. first\n2. second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
    expect(html).toContain('</ol>');
  });

  test('converts markdown table', () => {
    const md = '| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<th>Value</th>');
    expect(html).toContain('<td>a</td>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>b</td>');
    expect(html).toContain('</table>');
  });

  test('handles mixed content', () => {
    const md = '> Header\n\nSome **text** here.\n\n- bullet one\n- bullet two\n\n1. numbered\n2. items';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<h4>Header</h4>');
    expect(html).toContain('<strong>text</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
  });

  test('escapes HTML in content', () => {
    const html = simpleMarkdownToHtml('Use <div> tag');
    expect(html).toContain('&lt;div&gt;');
    expect(html).not.toContain('<div>');
  });

  test('returns empty string for empty input', () => {
    expect(simpleMarkdownToHtml('')).toBe('');
  });

  test('handles plain text as paragraph', () => {
    const html = simpleMarkdownToHtml('Just some text');
    expect(html).toBe('<p>Just some text</p>');
  });

  test('joins consecutive text lines into single paragraph', () => {
    const html = simpleMarkdownToHtml('line one\nline two');
    expect(html).toBe('<p>line one line two</p>');
  });

  test('separates paragraphs with blank lines', () => {
    const html = simpleMarkdownToHtml('para one\n\npara two');
    expect(html).toContain('<p>para one</p>');
    expect(html).toContain('<p>para two</p>');
  });

  test('list items separated by blank lines stay in one list', () => {
    const html = simpleMarkdownToHtml('- item one\n\n- item two\n\n- item three');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<li>item two</li>');
    expect(html).toContain('<li>item three</li>');
    expect(html).toContain('</ul>');
    // Should be a single list, not multiple
    expect(html.match(/<ul>/g)?.length).toBe(1);
    expect(html.match(/<\/ul>/g)?.length).toBe(1);
  });

  test('numbered list items separated by blank lines stay in one list', () => {
    const html = simpleMarkdownToHtml('1. first\n\n2. second\n\n3. third');
    expect(html).toContain('<ol>');
    expect(html.match(/<ol>/g)?.length).toBe(1);
    expect(html.match(/<\/ol>/g)?.length).toBe(1);
  });

  test('table rows separated by blank lines stay in one table', () => {
    const md = '|Name|Value|\n\n|a|1|\n\n|b|2|';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>a</td>');
    expect(html).toContain('<td>b</td>');
    expect(html.match(/<table>/g)?.length).toBe(1);
    expect(html.match(/<\/table>/g)?.length).toBe(1);
  });

  test('blank line between list and different content closes the list', () => {
    const html = simpleMarkdownToHtml('- item\n\nsome text');
    expect(html).toContain('<ul>');
    expect(html).toContain('</ul>');
    expect(html).toContain('<p>some text</p>');
  });
});

describe('parseRefDescription', () => {
  test('parses ref with fragment', () => {
    expect(parseRefDescription('ref README.md#-why-multimeter')).toEqual({
      path: 'README.md', fragment: '-why-multimeter'
    });
  });

  test('parses ref without fragment', () => {
    expect(parseRefDescription('ref docs/guide.md')).toEqual({
      path: 'docs/guide.md', fragment: ''
    });
  });

  test('parses ref with leading/trailing whitespace', () => {
    expect(parseRefDescription('  ref ./doc.md#section  ')).toEqual({
      path: './doc.md', fragment: 'section'
    });
  });

  test('returns null for non-ref descriptions', () => {
    expect(parseRefDescription('Just a plain description')).toBeNull();
    expect(parseRefDescription('reference to something')).toBeNull();
    expect(parseRefDescription('See ref docs.md for info')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseRefDescription('')).toBeNull();
  });

  test('parses ref with +/ project root path', () => {
    expect(parseRefDescription('ref +/docs/doc.md#-sample')).toEqual({
      path: '+/docs/doc.md', fragment: '-sample'
    });
  });

  test('strips trailing slash before fragment', () => {
    expect(parseRefDescription('ref +/docs/doc.md/#-sample')).toEqual({
      path: '+/docs/doc.md', fragment: '-sample'
    });
  });

  test('strips trailing slash on relative path before fragment', () => {
    expect(parseRefDescription('ref ./doc.md/#section')).toEqual({
      path: './doc.md', fragment: 'section'
    });
  });
});

describe('resolveRefPath', () => {
  test('returns refPath as-is when no basePath', () => {
    expect(resolveRefPath('./doc.md')).toBe('./doc.md');
  });

  test('returns absolute-like paths as-is', () => {
    expect(resolveRefPath('+/docs/doc.md', 'api/api1.mmt')).toBe('+/docs/doc.md');
    expect(resolveRefPath('docs/doc.md', 'api/api1.mmt')).toBe('docs/doc.md');
  });

  test('resolves relative ref from API file in subfolder', () => {
    // doc.mmt is at root, api1.mmt is at api/api1.mmt, doc.md is at api/doc.md
    // api1.mmt has description: ref ./doc.md
    // basePath = 'api/api1.mmt' → dir = 'api'
    // refPath = './doc.md' → resolved = 'api/doc.md'
    expect(resolveRefPath('./doc.md', 'api/api1.mmt')).toBe('api/doc.md');
  });

  test('resolves ../ relative paths', () => {
    // api1.mmt at api/api1.mmt, doc.md at root doc.md
    // refPath = '../doc.md', basePath = 'api/api1.mmt'
    expect(resolveRefPath('../doc.md', 'api/api1.mmt')).toBe('doc.md');
  });

  test('resolves nested relative paths', () => {
    // api1.mmt at api/sub/api1.mmt, doc.md at api/doc.md
    expect(resolveRefPath('../doc.md', 'api/sub/api1.mmt')).toBe('api/doc.md');
  });

  test('resolves ./sibling in same directory', () => {
    expect(resolveRefPath('./other.md', 'folder/file.mmt')).toBe('folder/other.md');
  });
});describe('extractMarkdownSection', () => {
  const md = [
    '# Top',
    'Intro text.',
    '',
    '## Why',
    'Because reasons.',
    '',
    '### Sub-section',
    'Details here.',
    '',
    '## How',
    'Steps to follow.',
  ].join('\n');

  test('extracts section by heading slug', () => {
    const result = extractMarkdownSection(md, 'why');
    expect(result).toContain('Because reasons.');
    expect(result).toContain('### Sub-section');
    expect(result).toContain('Details here.');
    expect(result).not.toContain('Steps to follow.');
  });

  test('extracts top-level section stopping at same level', () => {
    const result = extractMarkdownSection(md, 'how');
    expect(result).toBe('Steps to follow.');
  });

  test('returns empty string if section not found', () => {
    expect(extractMarkdownSection(md, 'nonexistent')).toBe('');
  });

  test('returns full content when fragment is empty', () => {
    expect(extractMarkdownSection(md, '')).toBe(md);
  });

  test('handles fragment with leading dash', () => {
    const result = extractMarkdownSection(md, '-why');
    expect(result).toContain('Because reasons.');
  });
});

describe('service grouping with overlapping directory names', () => {
  test('source "api" should not match files from "markdown_api" directory', () => {
    const apis = [
      { title: 'Get Users', method: 'GET', url: '/users', format: 'json', __file: 'api/get_users.mmt' },
      { title: 'Create User', method: 'POST', url: '/users', format: 'json', __file: 'api/post_create_user.mmt' },
      { title: 'Health Check', method: 'GET', url: '/health', format: 'json', __file: 'markdown_api/health_check.mmt' },
      { title: 'Search Products', method: 'GET', url: '/search', format: 'json', __file: 'markdown_api/search_products.mmt' },
    ];
    const html = buildDocHtml(apis, {
      title: 'Test',
      services: [
        { name: 'Group A', description: 'First group', sources: ['api'] },
        { name: 'Group B', description: 'Second group', sources: ['markdown_api'] },
      ],
    });
    // Group A should contain only api/ items
    const groupAIdx = html.indexOf('Group A');
    const groupBIdx = html.indexOf('Group B');
    expect(groupAIdx).toBeGreaterThan(-1);
    expect(groupBIdx).toBeGreaterThan(-1);
    // Health Check and Search should appear AFTER Group B header, not under Group A
    const healthIdx = html.indexOf('Health Check');
    const searchIdx = html.indexOf('Search Products');
    expect(healthIdx).toBeGreaterThan(groupBIdx);
    expect(searchIdx).toBeGreaterThan(groupBIdx);
    // Get Users and Create User should appear between Group A and Group B
    const getUsersIdx = html.indexOf('Get Users');
    const createUserIdx = html.indexOf('Create User');
    expect(getUsersIdx).toBeGreaterThan(groupAIdx);
    expect(getUsersIdx).toBeLessThan(groupBIdx);
    expect(createUserIdx).toBeGreaterThan(groupAIdx);
    expect(createUserIdx).toBeLessThan(groupBIdx);
  });

  test('markdown doc: source "api" should not match "markdown_api" files', () => {
    const apis = [
      { title: 'Get Users', method: 'GET', url: '/users', format: 'json', __file: 'api/get_users.mmt' },
      { title: 'Health Check', method: 'GET', url: '/health', format: 'json', __file: 'markdown_api/health_check.mmt' },
    ];
    const md = buildDocMarkdown(apis, {
      title: 'Test',
      services: [
        { name: 'Group A', sources: ['api'] },
        { name: 'Group B', sources: ['markdown_api'] },
      ],
    });
    const groupAIdx = md.indexOf('Group A');
    const groupBIdx = md.indexOf('Group B');
    expect(groupAIdx).toBeGreaterThan(-1);
    expect(groupBIdx).toBeGreaterThan(-1);
    const healthIdx = md.indexOf('Health Check');
    expect(healthIdx).toBeGreaterThan(groupBIdx);
  });
});
