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

  it('replaceInputRefsWithNone replaces plain tokens', () => {
    const inputs = { 'i:key': 'VAL', 'e:HOST': 'api.local' } as any;
    expect(replaceInputRefsWithNone('url=i:key host=e:HOST', inputs)).toBe('url=VAL host=api.local');
  });

  it('replaceAllRefs merges defaults, inputs and envs with prefixes', () => {
    const iface = {
      url: 'http://e:HOST/users',
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
});
