import { replaceInputRefsWithBrace, replaceInputRefsWithNone, replaceAllRefs } from './variableReplacer';

describe('variableReplacer', () => {
  it('replaceInputRefsWithBrace replaces full and partial tokens with correct types', () => {
    const inputs = { 'i:name': 'mehrdad', 'i:age': 35 } as any;
    // Full replacement preserves type
    expect(replaceInputRefsWithBrace('<<i:age>>', inputs)).toBe(35);
    // Partial replacement converts to string
    expect(replaceInputRefsWithBrace('Hello <<i:name>>', inputs)).toBe('Hello mehrdad');
    // Arrays and objects
    const obj = {
      a: '<<i:name>>',
      b: ['X', '<<i:name>>', 1],
      c: { n: '<<i:age>>' },
    };
    const out = replaceInputRefsWithBrace(obj, inputs);
    expect(out).toEqual({ a: 'mehrdad', b: ['X', 'mehrdad', 1], c: { n: 35 } });
  });

  it('replaceInputRefsWithNone replaces plain tokens only after colon-space', () => {
    const inputs = { 'i:key': 'VAL', 'e:HOST': 'api.local' } as any;
    expect(replaceInputRefsWithNone('url: i:key host: e:HOST', inputs))
        .toBe('url: VAL host: api.local');
    // Should not touch plain tokens that are not values after colon-space,
    // but allow replacing when prefixed with a colon and space in mid-string.
    expect(replaceInputRefsWithNone('hi:i:key there e:HOST', inputs))
		.toBe('hi:i:key there e:HOST');
  });

  it('replaceAllRefs merges defaults, inputs and envs with prefixes', () => {
    const iface = {
      url: 'http://<<e:HOST>>/users',
      body: { name: '<<i:name>>', age: 'i:age', admin: false },
      tags: ['i:tag1', 'x', '<<i:tag2>>']
    } as any;
    const defaults = { name: 'john', age: 20, tag1: 'A' } as any;
    const inputs = { age: 30, tag2: 'B' } as any;
    const envs = { HOST: 'api.local' } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.url).toBe('http://api.local/users');
    // Full replacement preserves type for <<i:name>> (string stays string)
    expect(out.body).toEqual({ name: 'john', age: 30, admin: false });
    expect(out.tags).toEqual(['A', 'x', 'B']);
  });

  it('resolves embedded e: and r: tokens inside input/default values', () => {
    const defaults = { host: 'e:HOST', emailTmpl: 'User r:email at <<e:HOST>>' } as any;
    const inputs = { alt: 'r:uuid', host: '<<e:HOST>>' } as any;
    const envs = { HOST: 'api.local' } as any;
    const iface = {
      url: 'http://i:host/users',
      meta: 'i:emailTmpl',
      id: 'i:alt'
    } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.url).toBe('http://i:host/users');
    expect(out.meta).toMatch(/User .*@.* at api\.local/);
    expect(out.meta).not.toMatch(/r:email|e:HOST/);
    expect(out.id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
  });

  it('resolves chained i: -> e: references (input default pointing to env)', () => {
    // User scenario: inputs.xxx = 'e:test', body.username = 'i:xxx'
    // When i:xxx is resolved, it should get 'e:test' from defaults,
    // and then 'e:test' should be resolved to the environment value.
    const defaults = { xxx: 'e:test' } as any;
    const inputs = {} as any;
    const envs = { test: 'actualValue' } as any;
    const iface = {
      body: { username: '<<i:xxx>>' }
    } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.body.username).toBe('actualValue');
  });

  it('resolves chained i: -> e: references with plain token syntax', () => {
    // Same scenario but using plain i:xxx syntax (after colon-space)
    const defaults = { xxx: 'e:test' } as any;
    const inputs = {} as any;
    const envs = { test: 'envValue' } as any;
    const iface = {
      body: 'username: i:xxx'
    } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.body).toBe('username: envValue');
  });

  it('resolves chained i: -> e: in nested objects', () => {
    const defaults = { user: 'e:USER', pass: 'e:PASS' } as any;
    const inputs = {} as any;
    const envs = { USER: 'admin', PASS: 'secret123' } as any;
    const iface = {
      body: {
        credentials: {
          username: '<<i:user>>',
          password: '<<i:pass>>'
        }
      }
    } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.body.credentials.username).toBe('admin');
    expect(out.body.credentials.password).toBe('secret123');
  });
});
