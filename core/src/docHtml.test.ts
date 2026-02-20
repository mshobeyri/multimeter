import { extractEndpoint, parseParamDescriptions, buildDocHtml } from './docHtml';
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
    const matches = html.match(/has-desc/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  test('highlights <<i:xxx>> refs remaining in description', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Uses <<i:token>> for auth',
      inputs: { token: 'xxx' },
    }];
    const html = buildDocHtml(apis);
    expect(html).toContain('param-ref');
  });

  test('no Description column when no annotations', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Plain description',
      inputs: { userId: '123' },
    }];
    const html = buildDocHtml(apis);
    expect(html).not.toContain('class="param-table has-desc"');
    expect(html).not.toContain('<th>Description</th>');
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

  test('highlights <<i:xxx>> refs in markdown with bold', () => {
    const apis = [{
      title: 'Test API', method: 'GET', url: 'http://example.com/test', format: 'json',
      description: 'Uses <<i:token>> for auth',
      inputs: { token: 'xxx' },
    }];
    const md = buildDocMarkdown(apis);
    expect(md).toContain('**<<i:token>>**');
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
