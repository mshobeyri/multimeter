import { extractEndpoint } from './docHtml';

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
