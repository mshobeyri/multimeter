import {apiToYaml, yamlToAPI} from './apiParsePack';
import {curlToAPI, isCurlCommand} from './curlConvertor';

describe('curlConvertor', () => {
  it('detects curl commands only at the start', () => {
    expect(isCurlCommand('curl https://example.com')).toBe(true);
    expect(isCurlCommand('  curl https://example.com')).toBe(true);
    expect(isCurlCommand('echo curl https://example.com')).toBe(false);
  });

  it('converts method, headers, cookies, query, auth, and json body', () => {
    const api = curlToAPI(`curl -X POST 'https://example.com/users?active=true' \\
      -H 'Content-Type: application/json' \\
      -H 'X-Trace: abc' \\
      -H 'Cookie: sid=123; theme=dark' \\
      -u 'me:secret' \\
      --data-raw '{"name":"Jane","age":30}'`);

    expect(api).toEqual({
      type: 'api',
      url: 'https://example.com/users',
      protocol: 'http',
      method: 'post',
      format: 'json',
      query: {active: 'true'},
      headers: {
        'Content-Type': 'application/json',
        'X-Trace': 'abc',
      },
      cookies: {sid: '123', theme: 'dark'},
      auth: {type: 'basic', username: 'me', password: 'secret'},
      body: {name: 'Jane', age: 30},
    });
  });

  it('keeps simple https curl as an http protocol api', () => {
    const yaml = apiToYaml(curlToAPI('curl https://api.example.com/users'));

    expect(yaml).toContain('type: api');
    expect(yaml).toContain('url: https://api.example.com/users');
    expect(yaml).toContain('protocol: http');
    expect(yaml).toContain('method: get');
  });

  it('uses curl default http scheme when URL has no scheme', () => {
    const api = curlToAPI('curl api.example.com/users');

    expect(api.url).toBe('http://api.example.com/users');
    expect(api.protocol).toBe('http');
  });

  it('maps --get data to query values', () => {
    const api = curlToAPI("curl -G --data-urlencode 'q=hello world' --data 'page=1' https://example.com/search");

    expect(api.url).toBe('https://example.com/search');
    expect(api.method).toBe('get');
    expect(api.query).toEqual({q: 'hello world', page: '1'});
    expect(api.body).toBeUndefined();
  });

  it('handles curl aliases that map to current api fields', () => {
    const api = curlToAPI("curl --head --user-agent 'mmt-test' --referer https://ref.example --cookie 'a=b' --url https://example.com/status");

    expect(api.method).toBe('head');
    expect(api.url).toBe('https://example.com/status');
    expect(api.headers).toEqual({
      'User-Agent': 'mmt-test',
      Referer: 'https://ref.example',
    });
    expect(api.cookies).toEqual({a: 'b'});
  });

  it('handles compact short flags and ignores unsupported value flags safely', () => {
    const api = curlToAPI("curl -o response.json -XPOST -HAccept:application/json -d'{\"x\":1}' --url-query debug=true https://example.com/items");

    expect(api.url).toBe('https://example.com/items');
    expect(api.method).toBe('post');
    expect(api.query).toEqual({debug: 'true'});
    expect(api.headers).toEqual({Accept: 'application/json'});
    expect(api.body).toEqual({x: 1});
  });

  it('round-trips converted curl through api yaml', () => {
    const api = curlToAPI("curl --json '{\"ok\":true}' https://example.com/echo");
    const yaml = apiToYaml(api);
    const parsed = yamlToAPI(yaml);

    expect(parsed.type).toBe('api');
    expect(parsed.url).toBe('https://example.com/echo');
    expect(parsed.method).toBe('post');
    expect(parsed.headers).toMatchObject({Accept: 'application/json', 'Content-Type': 'application/json'});
    expect(parsed.body).toEqual({ok: true});
  });
});
