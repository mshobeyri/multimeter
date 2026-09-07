import { replaceInputRefsWithBrace, replaceInputRefsWithNone, replaceAllRefs, resolveInputsMap, normalizeEnvTokens, toTemplateWithEnvVars, toTemplateValueJs, replaceEnvTokensPlain, resolveEnvTokenValues, collectInputRefsFromObject, embedDynamicTokensAsJsInterpolations, replaceDynamicTokensToJsInterpolations, replaceOutputTokenRefs, replaceOutputTokensPlain, rewriteOutputSetKey } from './variableReplacer';

describe('normalizeEnvTokens', () => {
  it('normalizes <<e:VAR>> to envVariables.VAR', () => {
    expect(normalizeEnvTokens('url=<<e:HOST>>')).toBe('url=envVariables.HOST');
  });

  it('normalizes <e:VAR> to envVariables.VAR', () => {
    expect(normalizeEnvTokens('url=<e:HOST>')).toBe('url=envVariables.HOST');
  });

  it('normalizes e:{VAR} to envVariables.VAR', () => {
    expect(normalizeEnvTokens('url=e:{HOST}')).toBe('url=envVariables.HOST');
  });

  it('normalizes plain e:VAR to envVariables.VAR', () => {
    expect(normalizeEnvTokens('url=e:HOST/path')).toBe('url=envVariables.HOST/path');
  });

  it('normalizes multiple mixed forms in one string', () => {
    const input = '<<e:A>> and <e:B> and e:{C} and e:D';
    const out = normalizeEnvTokens(input);
    expect(out).toBe('envVariables.A and envVariables.B and envVariables.C and envVariables.D');
  });

  it('handles whitespace in angle brackets', () => {
    expect(normalizeEnvTokens('<< e:HOST >>')).toBe('envVariables.HOST');
    expect(normalizeEnvTokens('< e:HOST >')).toBe('envVariables.HOST');
  });

  it('leaves strings without env tokens unchanged', () => {
    expect(normalizeEnvTokens('hello world')).toBe('hello world');
    expect(normalizeEnvTokens('${foo}')).toBe('${foo}');
  });
});

describe('toTemplateWithEnvVars', () => {
  it('converts e:VAR to template literal with ${envVariables.VAR}', () => {
    expect(toTemplateWithEnvVars('hello e:NAME')).toBe('`hello ${envVariables.NAME}`');
  });

  it('converts <<e:VAR>> to template literal', () => {
    expect(toTemplateWithEnvVars('<<e:NAME>>')).toBe('`${envVariables.NAME}`');
  });

  it('does not double-wrap existing ${envVariables.VAR}', () => {
    const input = '${envVariables.HOST}/path';
    const result = toTemplateWithEnvVars(input);
    expect(result).toBe('`${envVariables.HOST}/path`');
    expect(result).not.toContain('${${');
  });

  it('does not double-wrap when normalizeEnvTokens output is already inside ${...}', () => {
    // Simulate a string that already had ${envVariables.FOO}
    const input = 'prefix ${envVariables.FOO} suffix';
    const result = toTemplateWithEnvVars(input);
    expect(result).toBe('`prefix ${envVariables.FOO} suffix`');
    expect(result).not.toContain('${${');
  });

  it('collapses nested ${ ${envVariables.VAR} } patterns', () => {
    const input = '${${envVariables.NAME}}';
    const result = toTemplateWithEnvVars(input);
    expect(result).toBe('`${envVariables.NAME}`');
  });

  it('handles multiple env tokens in one string', () => {
    const result = toTemplateWithEnvVars('http://e:HOST:e:PORT/path');
    expect(result).toContain('${envVariables.HOST}');
    expect(result).toContain('${envVariables.PORT}');
    expect(result).not.toContain('${${');
  });

  it('preserves non-env ${...} expressions', () => {
    const result = toTemplateWithEnvVars('${callId.result} and e:HOST');
    expect(result).toContain('${callId.result}');
    expect(result).toContain('${envVariables.HOST}');
  });

  it('escapes backticks in the value', () => {
    const result = toTemplateWithEnvVars('hello `world` e:NAME');
    expect(result).toContain('\\`world\\`');
  });

  it('handles null/undefined gracefully', () => {
    expect(toTemplateWithEnvVars(null as any)).toBe('``');
    expect(toTemplateWithEnvVars(undefined as any)).toBe('``');
  });
});

describe('toTemplateValueJs', () => {
  it('full <<e:VAR>> returns bare envVariables reference', () => {
    expect(toTemplateValueJs('<<e:HOST>>')).toBe('envVariables.HOST');
  });

  it('full e:VAR returns bare envVariables reference', () => {
    expect(toTemplateValueJs('e:HOST')).toBe('envVariables.HOST');
  });

  it('full <<r:VAR>> returns bare random call', () => {
    expect(toTemplateValueJs('<<r:email>>')).toBe("__mmt_random('email')");
  });

  it('full <<c:VAR>> returns bare current call', () => {
    expect(toTemplateValueJs('<<c:timestamp>>')).toBe("__mmt_current('timestamp')");
  });

  it('two <<e:VAR>> tokens separated by underscore', () => {
    expect(toTemplateValueJs('<<e:base_url>>_<<e:base_url>>'))
        .toBe('`${envVariables.base_url}_${envVariables.base_url}`');
  });

  it('supports env index access in full-token form', () => {
    expect(toTemplateValueJs('<<e:HOST[0]>>'))
        .toBe('__mmt_access(envVariables.HOST, "[0]")');
  });

  it('supports env slice access inside template values', () => {
    expect(toTemplateValueJs('https://<<e:HOST[0:3]>>/api'))
        .toBe('`https://${__mmt_access(envVariables.HOST, "[0:3]")}/api`');
  });

  it('mixed env and static text', () => {
    expect(toTemplateValueJs('https://<<e:host>>/api'))
        .toBe('`https://${envVariables.host}/api`');
  });

  it('mixed e: and r: tokens', () => {
    const result = toTemplateValueJs('<<e:host>>-<<r:email>>');
    expect(result).toBe("`${envVariables.host}-${__mmt_random('email')}`");
  });

  it('full <<i:name>> returns bare input identifier', () => {
    expect(toTemplateValueJs('<<i:message>>')).toBe('message');
    expect(toTemplateValueJs('i:message')).toBe('message');
  });

  it('embeds sibling i: refs in default templates', () => {
    expect(toTemplateValueJs('asd_<<i:message>>')).toBe('`asd_${message}`');
    expect(toTemplateValueJs('<<i:name>>_<<e:base_url>>'))
        .toBe('`${name}_${envVariables.base_url}`');
  });

  it('supports slice accessors on sibling i: refs', () => {
    expect(toTemplateValueJs('asd_<<i:message[0:4]>>'))
        .toBe('`asd_${__mmt_access(message, "[0:4]")}`');
    expect(toTemplateValueJs('<<i:message[1:2]>>'))
        .toBe('__mmt_access(message, "[1:2]")');
  });

  it('full <<o:name>> returns outputs expression', () => {
    expect(toTemplateValueJs('<<o:token>>')).toBe('outputs.token');
    expect(toTemplateValueJs('o:token')).toBe('outputs.token');
  });

  it('supports nested accessors on o: refs', () => {
    expect(toTemplateValueJs('<<o:user.name>>'))
        .toBe('__mmt_access(outputs.user, ".name")');
    expect(toTemplateValueJs('id=<<o:user.name>>'))
        .toBe('`id=${__mmt_access(outputs.user, ".name")}`');
  });
});

describe('replaceOutputTokens / rewriteOutputSetKey', () => {
  it('rewrites set keys to outputs paths', () => {
    expect(rewriteOutputSetKey('o:asd')).toBe('outputs.asd');
    expect(rewriteOutputSetKey('o:user.name')).toBe('outputs.user.name');
    expect(rewriteOutputSetKey('o:items[0]')).toBe('outputs.items[0]');
    expect(rewriteOutputSetKey('token')).toBeUndefined();
  });

  it('replaces o: tokens in deep objects', () => {
    expect(replaceOutputTokenRefs({
      print: 'token=<<o:token>>',
      check: 'o:token == 1',
      nested: {x: '<<o:user.name>>'},
    })).toEqual({
      print: 'token=${outputs.token}',
      check: '${outputs.token} == 1',
      nested: {x: '${__mmt_access(outputs.user, ".name")}'},
    });
  });

  it('plain o: becomes outputs. for conditions', () => {
    expect(replaceOutputTokensPlain('o:token == 1')).toBe('outputs.token == 1');
    expect(replaceOutputTokensPlain('o:user.name')).toBe(
        '__mmt_access(outputs.user, ".name")');
  });
});

describe('replaceEnvTokensPlain', () => {
  it('replaces plain e:VAR with envVariables.VAR', () => {
    expect(replaceEnvTokensPlain('e:FOO')).toBe('envVariables.FOO');
  });

  it('uses word boundary so mid-word tokens are not touched', () => {
    expect(replaceEnvTokensPlain('note:FOO')).toBe('note:FOO');
  });

  it('does not handle angle-bracket or brace forms', () => {
    expect(replaceEnvTokensPlain('<<e:FOO>>')).toBe('<<envVariables.FOO>>');
    // \b doesn't match before {, so e:{FOO} is left untouched
    expect(replaceEnvTokensPlain('e:{FOO}')).toBe('e:{FOO}');
  });
});

describe('resolveEnvTokenValues', () => {
  it('resolves all env token forms against provided values', () => {
    const env = { HOST: 'localhost', PORT: '8080' };
    expect(resolveEnvTokenValues('<<e:HOST>>:<<e:PORT>>', env)).toBe('localhost:8080');
    expect(resolveEnvTokenValues('<e:HOST>:<e:PORT>', env)).toBe('localhost:8080');
    expect(resolveEnvTokenValues('e:{HOST}:e:{PORT}', env)).toBe('localhost:8080');
    expect(resolveEnvTokenValues('e:HOST:e:PORT', env)).toBe('localhost:8080');
  });

  it('keeps original token when env key is missing', () => {
    expect(resolveEnvTokenValues('e:MISSING', {})).toBe('e:MISSING');
    expect(resolveEnvTokenValues('<<e:MISSING>>', {})).toBe('<<e:MISSING>>');
  });

  it('resolves mixed known and unknown tokens', () => {
    const env = { HOST: 'api.local' };
    expect(resolveEnvTokenValues('http://e:HOST:e:PORT/path', env)).toBe('http://api.local:e:PORT/path');
  });

  it('supports accessor syntax on env values', () => {
    const env = { TOKEN: 'abcdef', user: {name: 'mehrdad'} } as any;
    expect(resolveEnvTokenValues('<<e:TOKEN[0:3]>>', env)).toBe('abc');
    expect(resolveEnvTokenValues('hello <<e:user.name>>', env)).toBe('hello mehrdad');
  });
});

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

  it('supports string index and slice access on input values', () => {
    const defaults = { message: 'hello' } as any;
    const iface = {
      first: '<<i:message[0]>>',
      short: '<<i:message[0:2]>>',
      body: 'value: i:message[1:4]'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({ first: 'h', short: 'he', body: 'value: ell' });
  });

  it('supports open-ended slice accessors on both ends', () => {
    const defaults = { message: 'hello' } as any;
    const iface = {
      tail: '<<i:message[1:]>>',
      head: '<<i:message[:4]>>',
      plain: 'value: i:message[:2]'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({ tail: 'ello', head: 'hell', plain: 'value: he' });
  });

  it('keeps accessor replacements as runtime expressions for ${input} placeholders', () => {
    const defaults = { username: '${username}', role: '${role}' } as any;
    const iface = {
      userInitial: '<<i:username[0]>>',
      roleShort: '<<i:role[0:3]>>'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({
      userInitial: '${__mmt_access(username, \'[0]\')}',
      roleShort: '${__mmt_access(role, \'[0:3]\')}'
    });
  });

  it('supports env index and property access', () => {
    const envs = { TOKEN: 'abc123', user: {name: 'mehrdad'} } as any;
    const iface = {
      first: '<<e:TOKEN[0]>>',
      prefix: 'Bearer <<e:TOKEN[0:3]>>',
      userName: '<<e:user.name>>'
    } as any;
    const out = replaceAllRefs(iface, {}, {}, envs);
    expect(out).toEqual({ first: 'a', prefix: 'Bearer abc', userName: 'mehrdad' });
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

describe('collectInputRefsFromObject', () => {
  it('finds full-string i:name references', () => {
    const obj = { url: 'i:base_url', method: 'GET' };
    expect(collectInputRefsFromObject(obj).sort()).toEqual(['base_url']);
  });

  it('finds brace <<i:name>> references', () => {
    const obj = { url: 'http://<<i:host>>/api' };
    expect(collectInputRefsFromObject(obj)).toEqual(['host']);
  });

  it('finds full-string brace <<i:name>> references', () => {
    const obj = { token: '<<i:auth_token>>' };
    expect(collectInputRefsFromObject(obj)).toEqual(['auth_token']);
  });

  it('finds after-colon-space references', () => {
    const obj = { body: 'username: i:user' };
    expect(collectInputRefsFromObject(obj)).toEqual(['user']);
  });

  it('finds refs in nested objects and arrays', () => {
    const obj = {
      steps: [
        { call: 'myapi', inputs: { host: 'i:base_host' } },
        { check: { value: '<<i:expected>>' } }
      ]
    };
    expect(collectInputRefsFromObject(obj).sort()).toEqual(['base_host', 'expected']);
  });

  it('returns empty array when no refs exist', () => {
    const obj = { url: 'https://example.com', method: 'GET', body: { name: 'test' } };
    expect(collectInputRefsFromObject(obj)).toEqual([]);
  });

  it('deduplicates repeated references', () => {
    const obj = { a: 'i:name', b: '<<i:name>>' };
    expect(collectInputRefsFromObject(obj)).toEqual(['name']);
  });

  it('collects base input names from accessor forms', () => {
    const obj = { a: '<<i:name[0:1]>>', b: 'user: i:profile.name' };
    expect(collectInputRefsFromObject(obj).sort()).toEqual(['name', 'profile']);
  });

  it('does not match non-input prefixes like e: or r:', () => {
    const obj = { url: 'e:HOST', token: 'r:uuid' };
    expect(collectInputRefsFromObject(obj)).toEqual([]);
  });

  it('skips numbers, booleans, and null', () => {
    const obj = { port: 8080, verbose: true, data: null };
    expect(collectInputRefsFromObject(obj)).toEqual([]);
  });
});

describe('multiple template vars in one string', () => {
  it('replaceAllRefs resolves mixed <<i:>> and <<e:>> in one string', () => {
    const result = replaceAllRefs(
      { msg: '<<i:greeting>>_<<e:host>>' },
      {},
      { greeting: 'hello' },
      { host: 'example.com' },
    );
    expect(result.msg).toBe('hello_example.com');
  });

  it('replaceAllRefs preserves unresolved <<e:>> tokens', () => {
    const result = replaceAllRefs(
      { msg: '<<i:greeting>>_<<e:missing>>' },
      {},
      { greeting: 'hello' },
      {},
    );
    expect(result.msg).toBe('hello_<<e:missing>>');
  });

  it('normalizeEnvTokens handles e:VAR after underscore', () => {
    expect(normalizeEnvTokens('${msg}_e:HOST')).toBe('${msg}_envVariables.HOST');
  });

  it('resolveEnvTokenValues handles e:VAR after underscore', () => {
    expect(resolveEnvTokenValues('hello_e:HOST', { HOST: 'localhost' })).toBe('hello_localhost');
  });

  it('replaceEnvTokensPlain handles e:VAR after underscore', () => {
    expect(replaceEnvTokensPlain('${msg}_e:HOST')).toBe('${msg}_envVariables.HOST');
  });

  it('replaceAllRefs handles three tokens concatenated', () => {
    const result = replaceAllRefs(
      { val: '<<i:a>>-<<e:b>>-<<i:c>>' },
      {},
      { a: 'X', c: 'Z' },
      { b: 'Y' },
    );
    expect(result.val).toBe('X-Y-Z');
  });
});

describe('embedDynamicTokensAsJsInterpolations', () => {
  it('converts e: / r: / c: forms (including accessors) to ${...}', () => {
    expect(replaceDynamicTokensToJsInterpolations('e:HOST'))
        .toBe('${envVariables.HOST}');
    expect(replaceDynamicTokensToJsInterpolations('user=<<e:USER[0:2]>>'))
        .toBe('user=${__mmt_access(envVariables.USER, "[0:2]")}');
    expect(replaceDynamicTokensToJsInterpolations('r:customToken'))
        .toBe("${__mmt_random('customToken')}");
    expect(replaceDynamicTokensToJsInterpolations('c:customNow'))
        .toBe("${__mmt_current('customNow')}");
    expect(replaceDynamicTokensToJsInterpolations('<e:HOST> and e:{PORT}'))
        .toBe('${envVariables.HOST} and ${envVariables.PORT}');
  });

  it('deep-walks objects and arrays without touching non-strings', () => {
    const out = embedDynamicTokensAsJsInterpolations({
      a: 'e:HOST',
      b: 12,
      c: true,
      d: ['<<e:X>>', { nested: 'r:custom' }],
    });
    expect(out).toEqual({
      a: '${envVariables.HOST}',
      b: 12,
      c: true,
      d: ['${envVariables.X}', { nested: "${__mmt_random('custom')}" }],
    });
  });

  it('leaves existing ${...} interpolations and plain text alone', () => {
    expect(replaceDynamicTokensToJsInterpolations('${already} and plain'))
        .toBe('${already} and plain');
  });
});

describe('resolveInputsMap – interdependent input defaults', () => {
  it('composes id from sibling inputs that point at env vars', () => {
    const out = resolveInputsMap(
        {
          card: 'e:card',
          seq: 'e:seq',
          id: '<<i:card>>_<<i:seq>>',
        },
        {card: '4111111111111111', seq: '42'},
    );
    expect(out).toEqual({
      card: '4111111111111111',
      seq: '42',
      id: '4111111111111111_42',
    });
  });

  it('resolves multi-level i: chains across passes', () => {
    const out = resolveInputsMap(
        {
          card: 'e:card',
          short: '<<i:card[0:4]>>',
          mid: '<<i:short>>-<<i:card[4:6]>>',
          id: '<<i:mid>>_<<i:seq>>',
          seq: 'e:seq',
        },
        {card: '4111111111111111', seq: '99'},
    );
    expect(out).toEqual({
      card: '4111111111111111',
      short: '4111',
      mid: '4111-11',
      id: '4111-11_99',
      seq: '99',
    });
  });

  it('applies slice accessors on env-backed and sibling inputs', () => {
    const out = resolveInputsMap(
        {
          token: 'e:token',
          head: '<<i:token[0:3]>>',
          mid: '<<e:token[1:4]>>',
          tail: 'i:token[2:]',
          fromHead: '<<i:head[1:2]>>',
        },
        {token: 'abcdef'},
    );
    expect(out).toEqual({
      token: 'abcdef',
      head: 'abc',
      mid: 'bcd',
      tail: 'cdef',
      fromHead: 'b',
    });
  });

  it('honors manual overrides over yaml defaults before composition', () => {
    const defaults = {
      card: 'e:card',
      seq: 'e:seq',
      id: '<<i:card>>_<<i:seq>>',
    };
    const merged = {
      ...defaults,
      card: '9999000011112222',
      seq: '7',
    };
    const out = resolveInputsMap(merged, {card: '4111111111111111', seq: '42'});
    expect(out).toEqual({
      card: '9999000011112222',
      seq: '7',
      id: '9999000011112222_7',
    });
  });

  it('allows overriding only the composed field', () => {
    const out = resolveInputsMap(
        {
          card: 'e:card',
          seq: 'e:seq',
          id: 'forced-id',
        },
        {card: '4111111111111111', seq: '42'},
    );
    expect(out).toEqual({
      card: '4111111111111111',
      seq: '42',
      id: 'forced-id',
    });
  });

  it('allows overriding an intermediate level in a multi-level chain', () => {
    const out = resolveInputsMap(
        {
          card: 'e:card',
          short: 'OVERRIDE',
          id: '<<i:short>>_<<i:card[0:2]>>',
        },
        {card: '4111111111111111'},
    );
    expect(out).toEqual({
      card: '4111111111111111',
      short: 'OVERRIDE',
      id: 'OVERRIDE_41',
    });
  });

  it('resolves plain and angle env forms inside composed inputs', () => {
    const out = resolveInputsMap(
        {
          host: '<<e:HOST>>',
          path: 'e:PATH',
          url: 'https://<<i:host>>/<<i:path>>',
        },
        {HOST: 'api.local', PATH: 'v1'},
    );
    expect(out).toEqual({
      host: 'api.local',
      path: 'v1',
      url: 'https://api.local/v1',
    });
  });

  it('returns a shallow copy for empty or non-object inputs', () => {
    expect(resolveInputsMap(undefined, {a: 1})).toEqual({});
    expect(resolveInputsMap(null as any, {a: 1})).toEqual({});
    expect(resolveInputsMap([] as any, {a: 1})).toEqual({});
  });
});
