import { replaceInputRefsWithBrace, replaceInputRefsWithNone, replaceAllRefs, resolveInputsMap, normalizeEnvTokens, toTemplateWithEnvVars, toTemplateValueJs, replaceEnvTokensPlain, resolveEnvTokenValues, collectInputRefsFromObject, embedDynamicTokensAsJsInterpolations, replaceDynamicTokensToJsInterpolations, replaceOutputTokenRefs, replaceOutputTokensPlain, rewriteOutputSetKey } from './variableReplacer';

describe('normalizeEnvTokens', () => {
  it('normalizes <<e:VAR>> to await mmtEnv_ lookup', () => {
    expect(normalizeEnvTokens('url=<<e:HOST>>')).toBe(
        'url=(await mmtEnv_("HOST", null, \'lookup\'))');
  });

  it('leaves single-angle and brace spellings as text', () => {
    expect(normalizeEnvTokens('url=<e:HOST>')).toBe('url=<e:HOST>');
    expect(normalizeEnvTokens('url=e:{HOST}')).toBe('url=e:{HOST}');
    expect(normalizeEnvTokens('< e:HOST >')).toBe('< e:HOST >');
  });

  it('normalizes plain e:VAR to await mmtEnv_ lookup', () => {
    expect(normalizeEnvTokens('url=e:HOST/path')).toBe(
        'url=(await mmtEnv_("HOST", null, \'lookup\'))/path');
  });

  it('normalizes multiple forms in one string', () => {
    const input = '<<e:A>> and e:D';
    const out = normalizeEnvTokens(input);
    expect(out).toBe(
        '(await mmtEnv_("A", null, \'lookup\')) and (await mmtEnv_("D", null, \'lookup\'))');
  });

  it('handles whitespace in angle brackets', () => {
    expect(normalizeEnvTokens('<< e:HOST >>')).toBe(
        '(await mmtEnv_("HOST", null, \'lookup\'))');
  });

  it('leaves strings without env tokens unchanged', () => {
    expect(normalizeEnvTokens('hello world')).toBe('hello world');
    expect(normalizeEnvTokens('${foo}')).toBe('${foo}');
  });
});

describe('toTemplateWithEnvVars', () => {
  it('converts e:VAR to template literal with ${(await mmtEnv_("VAR"))}', () => {
    expect(toTemplateWithEnvVars('hello e:NAME')).toBe('`hello ${(await mmtEnv_("NAME"))}`');
  });

  it('converts <<e:VAR>> to template literal', () => {
    expect(toTemplateWithEnvVars('<<e:NAME>>')).toBe('`${(await mmtEnv_("NAME"))}`');
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

  it('leaves pre-existing ${envVariables.VAR} nested forms readable', () => {
    const input = '${${envVariables.NAME}}';
    const result = toTemplateWithEnvVars(input);
    // Legacy envVariables refs are not rewritten; only e: tokens become mmtEnv_.
    expect(result).toContain('envVariables.NAME');
    expect(result).not.toContain('mmtEnv_');
  });

  it('handles multiple env tokens in one string', () => {
    const result = toTemplateWithEnvVars('http://e:HOST:e:PORT/path');
    expect(result).toContain('${(await mmtEnv_("HOST"))}');
    expect(result).toContain('${(await mmtEnv_("PORT"))}');
    expect(result).not.toContain('${${');
  });

  it('preserves non-env ${...} expressions', () => {
    const result = toTemplateWithEnvVars('${callId.result} and e:HOST');
    expect(result).toContain('${callId.result}');
    expect(result).toContain('${(await mmtEnv_("HOST"))}');
  });

  it('escapes backticks in the value', () => {
    const result = toTemplateWithEnvVars('hello `world` e:NAME');
    expect(result).toContain('\\`world\\`');
  });

  it('handles null/undefined gracefully', () => {
    expect(toTemplateWithEnvVars(null as any)).toBe('``');
    expect(toTemplateWithEnvVars(undefined as any)).toBe('``');
  });

  it('converts r: and c: tokens to runtime calls', () => {
    expect(toTemplateWithEnvVars('now c:datetime')).toBe('`now ${mmtCurrent_(\'datetime\')}`');
    expect(toTemplateWithEnvVars('id r:uuid')).toBe('`id ${mmtRandom_(\'uuid\')}`');
    expect(toTemplateWithEnvVars('c:city')).toBe('`${mmtCurrent_(\'city\')}`');
  });
});

describe('toTemplateValueJs', () => {
  it('full <<e:VAR>> returns an mmtEnv_ call', () => {
    expect(toTemplateValueJs('<<e:HOST>>')).toBe('(await mmtEnv_("HOST"))');
  });

  it('full e:VAR returns an mmtEnv_ call', () => {
    expect(toTemplateValueJs('e:HOST')).toBe('(await mmtEnv_("HOST"))');
  });

  it('treats {{ }} like << >> and keeps a quoted whole token literal', () => {
    expect(toTemplateValueJs('{{e:HOST}}')).toBe('(await mmtEnv_("HOST"))');
    expect(toTemplateValueJs('{{o:token}}')).toBe('outputs.token');
    expect(toTemplateValueJs('pre {{e:HOST}} post'))
        .toBe('`pre ${(await mmtEnv_("HOST"))} post`');
    const literal = '__MMT_LITERAL__:';
    expect(toTemplateValueJs(`{"age":"${literal}<<e:HOST>>"}`))
        .toBe('`{"age":"<<e:HOST>>"}`');
    expect(toTemplateValueJs(`{"age":"${literal}{{e:HOST}}"}`))
        .toBe('`{"age":"{{e:HOST}}"}`');
    expect(toTemplateValueJs('{"age":"asda<<e:HOST>>"}'))
        .toBe('`{"age":"asda${(await mmtEnv_("HOST"))}"}`');
  });

  it('full <<r:VAR>> returns bare random call', () => {
    expect(toTemplateValueJs('<<r:email>>')).toBe("mmtRandom_('email')");
  });

  it('full <<c:VAR>> returns bare current call', () => {
    expect(toTemplateValueJs('<<c:timestamp>>')).toBe("mmtCurrent_('timestamp')");
  });

  it('two <<e:VAR>> tokens separated by underscore', () => {
    expect(toTemplateValueJs('<<e:base_url>>_<<e:base_url>>'))
        .toBe('`${(await mmtEnv_("base_url"))}_${(await mmtEnv_("base_url"))}`');
  });

  it('supports env index access in full-token form', () => {
    expect(toTemplateValueJs('<<e:HOST[0]>>'))
        .toBe('(await mmtEnv_("HOST", "[0]"))');
  });

  it('supports env slice access inside template values', () => {
    expect(toTemplateValueJs('https://<<e:HOST[0:3]>>/api'))
        .toBe('`https://${(await mmtEnv_("HOST", "[0:3]"))}/api`');
  });

  it('mixed env and static text', () => {
    expect(toTemplateValueJs('https://<<e:host>>/api'))
        .toBe('`https://${(await mmtEnv_("host"))}/api`');
  });

  it('mixed e: and r: tokens', () => {
    const result = toTemplateValueJs('<<e:host>>-<<r:email>>');
    expect(result).toBe('`${(await mmtEnv_("host"))}-${mmtRandom_(\'email\')}`');
  });

  it('full <<i:name>> returns bare input identifier', () => {
    expect(toTemplateValueJs('<<i:message>>')).toBe('message');
    expect(toTemplateValueJs('i:message')).toBe('message');
  });

  it('embeds sibling i: refs in default templates', () => {
    expect(toTemplateValueJs('asd_<<i:message>>')).toBe('`asd_${message}`');
    expect(toTemplateValueJs('<<i:name>>_<<e:base_url>>'))
        .toBe('`${name}_${(await mmtEnv_("base_url"))}`');
  });

  it('supports slice accessors on sibling i: refs', () => {
    expect(toTemplateValueJs('asd_<<i:message[0:4]>>'))
        .toBe('`asd_${mmtAccess_(message, "[0:4]")}`');
    expect(toTemplateValueJs('<<i:message[1:2]>>'))
        .toBe('mmtAccess_(message, "[1:2]")');
  });

  it('uses the token text when an i: name is not a declared input', () => {
    const known = new Set(['message']);
    expect(toTemplateValueJs('i:missing', {knownInputNames: known}))
        .toBe('"i:missing"');
    expect(toTemplateValueJs('<<i:missing[0]>>', {knownInputNames: known}))
        .toBe('"i:missing[0]"');
    expect(toTemplateValueJs('hello <<i:missing>>', {knownInputNames: known}))
        .toBe('`hello i:missing`');
    expect(toTemplateValueJs('<<i:message>>', {knownInputNames: known}))
        .toBe('message');
  });

  it('full <<o:name>> returns outputs expression', () => {
    expect(toTemplateValueJs('<<o:token>>')).toBe('outputs.token');
    expect(toTemplateValueJs('o:token')).toBe('outputs.token');
  });

  it('supports nested accessors on o: refs', () => {
    expect(toTemplateValueJs('<<o:user.name>>'))
        .toBe('mmtAccess_(outputs.user, ".name")');
    expect(toTemplateValueJs('id=<<o:user.name>>'))
        .toBe('`id=${mmtAccess_(outputs.user, ".name")}`');
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
      nested: {x: '${mmtAccess_(outputs.user, ".name")}'},
    });
  });

  it('plain o: becomes outputs. for conditions', () => {
    expect(replaceOutputTokensPlain('o:token == 1')).toBe('outputs.token == 1');
    expect(replaceOutputTokensPlain('o:user.name')).toBe(
        'mmtAccess_(outputs.user, ".name")');
  });
});

describe('replaceEnvTokensPlain', () => {
  it('replaces plain e:VAR with await mmtEnv_ lookup', () => {
    expect(replaceEnvTokensPlain('e:FOO')).toBe(
        '(await mmtEnv_("FOO", null, \'lookup\'))');
  });

  it('uses word boundary so mid-word tokens are not touched', () => {
    expect(replaceEnvTokensPlain('note:FOO')).toBe('note:FOO');
  });

  it('does not handle angle-bracket or brace forms', () => {
    // Angle form is left for replaceTokenForms with includeAngles:false —
    // the inner e:FOO still matches as a plain token.
    expect(replaceEnvTokensPlain('<<e:FOO>>')).toBe(
        '<<(await mmtEnv_("FOO", null, \'lookup\'))>>');
    expect(replaceEnvTokensPlain('<e:FOO>')).toBe('<e:FOO>');
    expect(replaceEnvTokensPlain('e:{FOO}')).toBe('e:{FOO}');
  });
});

describe('resolveEnvTokenValues', () => {
  it('resolves all env token forms against provided values', () => {
    const env = { HOST: 'localhost', PORT: '8080' };
    expect(resolveEnvTokenValues('<<e:HOST>>:<<e:PORT>>', env)).toBe('localhost:8080');
    expect(resolveEnvTokenValues('<e:HOST>:<e:PORT>', env)).toBe('<e:HOST>:<e:PORT>');
    expect(resolveEnvTokenValues('e:{HOST}:e:{PORT}', env)).toBe('e:{HOST}:e:{PORT}');
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

  it('replaceAllRefs resolves {{ }} the same way as << >>', () => {
    const out = replaceAllRefs(
        {
          whole: '{{e:HOST}}',
          mixed: 'id={{i:name}}',
          quoted: '__MMT_LITERAL__:{{e:HOST}}',
        },
        {},
        {name: 'ada'},
        {HOST: 'api.local'},
    );
    expect(out.whole).toBe('api.local');
    expect(out.mixed).toBe('id=ada');
    expect(out.quoted).toBe('__MMT_LITERAL__:{{e:HOST}}');
  });

  it('replaceInputRefsWithNone replaces a bare token only when it is the whole value', () => {
    const inputs = { 'i:key': 'VAL', 'e:HOST': 'api.local' } as any;
    expect(replaceInputRefsWithNone('i:key', inputs)).toBe('VAL');
    expect(replaceInputRefsWithNone('e:HOST', inputs)).toBe('api.local');
    expect(replaceInputRefsWithNone('url: i:key host: e:HOST', inputs))
        .toBe('url: i:key host: e:HOST');
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
    // Bare `r:email` mixed into other text stays literal. `<<e:HOST>>` resolves.
    expect(out.meta).toBe('User r:email at api.local');
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

  it('resolves chained i: -> e: when the plain token is the whole value', () => {
    const defaults = { xxx: 'e:test' } as any;
    const inputs = {} as any;
    const envs = { test: 'envValue' } as any;
    const iface = {
      body: { username: 'i:xxx' }
    } as any;
    const out = replaceAllRefs(iface, defaults, inputs, envs);
    expect(out.body.username).toBe('envValue');
  });

  it('does not resolve a bare token mixed into other text', () => {
    const defaults = { xxx: 'e:test' } as any;
    const envs = { test: 'envValue' } as any;
    const iface = { body: 'username: i:xxx' } as any;
    const out = replaceAllRefs(iface, defaults, {}, envs);
    expect(out.body).toBe('username: i:xxx');
  });

  it('supports string index and slice access on input values', () => {
    const defaults = { message: 'hello' } as any;
    const iface = {
      first: '<<i:message[0]>>',
      short: '<<i:message[0:2]>>',
      body: 'value: i:message[1:4]',
      slice: 'i:message[1:4]'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({
      first: 'h',
      short: 'he',
      body: 'value: i:message[1:4]',
      slice: 'ell',
    });
  });

  it('supports open-ended slice accessors on both ends', () => {
    const defaults = { message: 'hello' } as any;
    const iface = {
      tail: '<<i:message[1:]>>',
      head: '<<i:message[:4]>>',
      plain: 'i:message[:2]'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({ tail: 'ello', head: 'hell', plain: 'he' });
  });

  it('keeps accessor replacements as runtime expressions for ${input} placeholders', () => {
    const defaults = { username: '${username}', role: '${role}' } as any;
    const iface = {
      userInitial: '<<i:username[0]>>',
      roleShort: '<<i:role[0:3]>>'
    } as any;
    const out = replaceAllRefs(iface, defaults, {}, {} as any);
    expect(out).toEqual({
      userInitial: '${mmtAccess_(username, \'[0]\')}',
      roleShort: '${mmtAccess_(role, \'[0:3]\')}'
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

  it('embeds object and list tokens as JSON inside a body string', () => {
    const iface = {
      body: [
        '{',
        '  "dd": <<i:xxx>>,',
        '  "name": "<<e:url>>",',
        '  "obj": <<i:zz>>,',
        '  "list": <<i:list>>,',
        '  "ddStr": "<<i:xxx>>",',
        '  "objStr": "<<i:zz>>",',
        '  "listStr": "<<i:list>>",',
        '  "bare": "i:xxx"',
        '}',
      ].join('\n'),
      whole: '<<i:zz>>',
      mixed: 'hello i:xxx',
    } as any;
    const out = replaceAllRefs(iface, {
      xxx: 10,
      zz: {xx: 'yy'},
      list: ['ls', 'nl'],
    } as any, {}, {url: 'https://test.mmt.dev'} as any);
    expect(out.whole).toEqual({xx: 'yy'});
    expect(out.mixed).toBe('hello i:xxx');
    expect(out.body).toBe([
      '{',
      '  "dd": 10,',
      '  "name": "https://test.mmt.dev",',
      '  "obj": {"xx":"yy"},',
      '  "list": ["ls","nl"],',
      '  "ddStr": "10",',
      '  "objStr": "{\\"xx\\":\\"yy\\"}",',
      '  "listStr": "[\\"ls\\",\\"nl\\"]",',
      '  "bare": "i:xxx"',
      '}',
    ].join('\n'));
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

  it('does not treat a bare token mixed into other text as an input ref', () => {
    const obj = { body: 'username: i:user' };
    expect(collectInputRefsFromObject(obj)).toEqual([]);
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
    const obj = { a: '<<i:name[0:1]>>', b: 'i:profile.name' };
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
    expect(normalizeEnvTokens('${msg}_e:HOST')).toBe(
        '${msg}_(await mmtEnv_("HOST", null, \'lookup\'))');
  });

  it('resolveEnvTokenValues handles e:VAR after underscore', () => {
    expect(resolveEnvTokenValues('hello_e:HOST', { HOST: 'localhost' })).toBe('hello_localhost');
  });

  it('replaceEnvTokensPlain handles e:VAR after underscore', () => {
    expect(replaceEnvTokensPlain('${msg}_e:HOST')).toBe(
        '${msg}_(await mmtEnv_("HOST", null, \'lookup\'))');
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

  it('can preserve random and current tokens for runtime code generation', () => {
    const result = replaceAllRefs(
      {
        env: '<<e:HOST>>',
        current: 'c:date',
        random: 'id-<<r:uuid>>',
      },
      {},
      {},
      {HOST: 'example.com'},
      new Set(),
      {resolveRuntimeTokens: false},
    );
    expect(result).toEqual({
      env: 'example.com',
      current: 'c:date',
      random: 'id-<<r:uuid>>',
    });
  });

  it('refreshRuntimeTokens clears c: caches between resolves', () => {
    const iface = {id: 'r:uuid'};
    const first = replaceAllRefs(iface, {}, {}, {}, new Set(), {refreshRuntimeTokens: true});
    const second = replaceAllRefs(iface, {}, {}, {}, new Set(), {refreshRuntimeTokens: true});
    expect(first.id).not.toBe('r:uuid');
    expect(second.id).not.toBe('r:uuid');
    expect(first.id).not.toBe(second.id);
  });

  it('gives each r: occurrence a unique value in the same resolve', () => {
    const iface = {
      a: 'r:uuid',
      b: 'r:uuid',
      c: '<<r:uuid>>',
      d: 'r:int(1,1000000)',
      e: 'r:int(1,1000000)',
    };
    const result = replaceAllRefs(iface, {}, {}, {}, new Set(), {refreshRuntimeTokens: true});
    expect(result.a).not.toBe(result.b);
    expect(result.a).not.toBe(result.c);
    expect(result.b).not.toBe(result.c);
    expect(result.d).not.toBe(result.e);
    expect(typeof result.d).toBe('number');
    expect(typeof result.e).toBe('number');
  });

  it('resolves parameterized random tokens and preserves invalid forms', () => {
    const resolved = replaceAllRefs(
      {
        integer: 'r:int(7,7)',
        text: '<<r:alphanumeric(12)>>',
        invalid: 'r:uuid(2)',
      },
      {},
      {},
      {},
    );
    expect(resolved.integer).toBe(7);
    expect(resolved.text).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(resolved.invalid).toBe('r:uuid(2)');
    expect(toTemplateValueJs('r:int(1,10)'))
        .toBe("mmtRandom_('int(1,10)')");
    expect(toTemplateValueJs('id-<<r:string(8)>>'))
        .toContain("mmtRandom_('string(8)')");
    expect(toTemplateValueJs(
        '<<r:datetime(2026-01-01,2026-12-31)>>'))
        .toBe("mmtRandom_('datetime(2026-01-01,2026-12-31)')");
    expect(toTemplateValueJs('r:datetime_now(1h1m)'))
        .toBe("mmtRandom_('datetime_now(1h1m)')");
    expect(toTemplateValueJs('r:utc_datetime_now(1h1m)'))
        .toBe("mmtRandom_('utc_datetime_now(1h1m)')");
    expect(toTemplateValueJs('c:utc_datetime(+1h1m)'))
        .toBe("mmtCurrent_('utc_datetime(+1h1m)')");
    expect(toTemplateValueJs('at-<<c:datetime(-1d2m1s)>>'))
        .toContain("mmtCurrent_('datetime(-1d2m1s)')");
  });
});

describe('embedDynamicTokensAsJsInterpolations', () => {
  it('converts e: / r: / c: forms (including accessors) to ${...}', () => {
    expect(replaceDynamicTokensToJsInterpolations('e:HOST'))
        .toBe('${(await mmtEnv_("HOST"))}');
    expect(replaceDynamicTokensToJsInterpolations('user=<<e:USER[0:2]>>'))
        .toBe('user=${(await mmtEnv_("USER", "[0:2]"))}');
    expect(replaceDynamicTokensToJsInterpolations('r:customToken'))
        .toBe("${mmtRandom_('customToken')}");
    expect(replaceDynamicTokensToJsInterpolations('c:customNow'))
        .toBe("${mmtCurrent_('customNow')}");
    expect(replaceDynamicTokensToJsInterpolations('<e:HOST> and e:{PORT}'))
        .toBe('<e:HOST> and e:{PORT}');
  });

  it('deep-walks objects and arrays without touching non-strings', () => {
    const out = embedDynamicTokensAsJsInterpolations({
      a: 'e:HOST',
      b: 12,
      c: true,
      d: ['<<e:X>>', { nested: 'r:custom' }],
    });
    expect(out).toEqual({
      a: '${(await mmtEnv_("HOST"))}',
      b: 12,
      c: true,
      d: ['${(await mmtEnv_("X"))}', { nested: "${mmtRandom_('custom')}" }],
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
