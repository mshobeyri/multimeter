import {
  applyRequestBodyEdit,
  bodyEditTokenTemplate,
  bodyForSend,
  bodyForYamlSave,
  displayRequestBody,
  headersTokenSource,
  packBodyAsYamlEncoded,
  queryTokenSource,
  requestForSend,
  tokensTextToYamlBody,
  yamlBodyToTokensText,
} from './apiBodyEdit';
import {formatBody} from './markupConvertor';
import {resolveRequestFormat} from './formatResolve';

describe('displayRequestBody', () => {
  it('returns strings as-is without re-pretty', () => {
    expect(displayRequestBody('{"a":1}', 'json')).toBe('{"a":1}');
    expect(displayRequestBody('  hi  ', 'text')).toBe('  hi  ');
  });

  it('pretty-projects structured objects for the editor', () => {
    expect(displayRequestBody({message: 'hi'}, 'json')).toBe(
        formatBody('json', {message: 'hi'}),
    );
  });

  it('projects r:/c: markers as {{r:…}} when tokenSource is set', () => {
    const source = {id: 'r:uuid', n: 'r:int', label: 'hello'};
    const resolved = {
      id: '11111111-1111-1111-1111-111111111111',
      n: 7,
      label: 'hello',
    };
    const shown = displayRequestBody(resolved, 'json', {tokenSource: source});
    expect(shown).toContain('"id": "{{r:uuid}}"');
    expect(shown).toContain('"n": {{r:int}}');
    expect(shown).toContain('"label": "hello"');
    expect(shown).not.toContain('11111111');
  });

  it('treats null/undefined as empty', () => {
    expect(displayRequestBody(null, 'json')).toBe('');
    expect(displayRequestBody(undefined, 'json')).toBe('');
  });
});

describe('applyRequestBodyEdit', () => {
  const structured = {message: 'hello'};
  const display = displayRequestBody(structured, 'json');

  it('enters temp with free-form string on first edit', () => {
    const result = applyRequestBodyEdit({
      value: '{\n  "message": "x"\n}',
      currentBody: structured,
      format: 'json',
      baseline: null,
      bodyAlreadyTouched: false,
    });
    expect(result.kind).toBe('stayTemp');
    if (result.kind !== 'stayTemp') {
      return;
    }
    expect(result.body).toBe('{\n  "message": "x"\n}');
    expect(result.baseline).toEqual({display, body: structured});
  });

  it('exits temp when editor text exactly matches pre-edit display', () => {
    const stayed = applyRequestBodyEdit({
      value: '{\n  "message": "x"\n}',
      currentBody: structured,
      format: 'json',
      baseline: null,
      bodyAlreadyTouched: false,
    });
    expect(stayed.kind).toBe('stayTemp');
    if (stayed.kind !== 'stayTemp') {
      return;
    }
    const exited = applyRequestBodyEdit({
      value: display,
      currentBody: stayed.body,
      format: 'json',
      baseline: stayed.baseline,
      bodyAlreadyTouched: true,
    });
    expect(exited).toEqual({
      kind: 'exitTemp',
      body: structured,
      baseline: null,
    });
  });

  it('normalizes CRLF so Windows revert still exits temp', () => {
    const crlf = display.replace(/\n/g, '\r\n');
    const result = applyRequestBodyEdit({
      value: crlf,
      currentBody: structured,
      format: 'json',
      baseline: {display, body: structured},
      bodyAlreadyTouched: true,
    });
    expect(result.kind).toBe('exitTemp');
    if (result.kind !== 'exitTemp') {
      return;
    }
    expect(result.body).toEqual(structured);
  });

  it('keeps invalid mid-edit JSON as text', () => {
    const result = applyRequestBodyEdit({
      value: '{"message":',
      currentBody: structured,
      format: 'json',
      baseline: null,
      bodyAlreadyTouched: false,
    });
    expect(result.kind).toBe('stayTemp');
    if (result.kind !== 'stayTemp') {
      return;
    }
    expect(result.body).toBe('{"message":');
  });

  it('first keystroke with i:/e: tokens swaps to edit template', () => {
    const source = {user: 'i:name', token: '<<e:auth>>'};
    const resolved = {user: 'alice', token: 'secret'};
    const preview = displayRequestBody(resolved, 'json', {tokenSource: source});
    const template = bodyEditTokenTemplate(source, 'json');
    expect(preview).toContain('alice');
    expect(template).toContain('{{i:name}}');
    expect(template).toContain('{{e:auth}}');

    const result = applyRequestBodyEdit({
      value: preview.slice(0, -1), // one-char delete from preview
      currentBody: resolved,
      format: 'json',
      baseline: null,
      bodyAlreadyTouched: false,
      tokenSource: source,
    });
    expect(result.kind).toBe('stayTemp');
    if (result.kind !== 'stayTemp') {
      return;
    }
    expect(result.body).toBe(template);
    expect(result.baseline?.display).toBe(template);
  });

  it('edit template quotes i: from input value types', () => {
    const source = {
      name: 'i:xxx',
      ssd: 'i:yy',
      message: 'Hello from mmt!',
    };
    const template = bodyEditTokenTemplate(source, 'json', {
      inputs: {xxx: 'ss', yy: 10},
    });
    expect(template).toContain('"name": "{{i:xxx}}"');
    expect(template).toContain('"ssd": {{i:yy}}');
    expect(template).not.toContain('"ssd": "{{i:yy}}"');
  });

  it('edit template quotes i: from resolved leaf types without inputs', () => {
    const source = {
      name: 'i:xxx',
      ssd: 'i:yy',
      message: 'Hello from mmt!',
    };
    const resolved = {name: 'ss', ssd: 10, message: 'Hello from mmt!'};
    const template = bodyEditTokenTemplate(source, 'json', undefined, resolved);
    expect(template).toContain('"name": "{{i:xxx}}"');
    expect(template).toContain('"ssd": {{i:yy}}');
    expect(template).not.toContain('"ssd": "{{i:yy}}"');
  });
});

describe('bodyForSend', () => {
  it('sends free-form strings as-is', () => {
    expect(bodyForSend('{"a":', 'json')).toBe('{"a":');
    expect(bodyForSend('plain', 'text')).toBe('plain');
  });

  it('compact-serializes leftover objects for non-multipart formats', () => {
    expect(bodyForSend({a: 1}, 'json')).toBe(formatBody('json', {a: 1}, false));
  });

  it('leaves multipart objects untouched', () => {
    const parts = [{name: 'f', value: '1'}];
    expect(bodyForSend(parts, 'multipart')).toBe(parts);
  });
});

describe('bodyForYamlSave + resolveRequestFormat (chart flow)', () => {
  it('auto + GET resolves to none (body disabled path)', () => {
    expect(resolveRequestFormat('auto', {}, 'get')).toBe('none');
    expect(resolveRequestFormat('json', {}, 'get')).toBe('json');
  });

  it('packs valid UI text into structured YAML body', () => {
    const yamlBody = {message: 'hello'};
    const ui = '{\n  "message": "ssss"\n}';
    expect(bodyForYamlSave(yamlBody, ui, 'json')).toEqual({message: 'ssss'});
  });

  it('packs display runtime tokens back to bare scalars', () => {
    const yamlBody = {id: 'r:uuid', n: 1, label: 'x'};
    const ui =
        '{\n  "id": "{{r:uuid}}",\n  "n": {{r:int}},\n  "label": "{{c:date}}"\n}';
    expect(bodyForYamlSave(yamlBody, ui, 'json')).toEqual({
      id: 'r:uuid',
      n: 'r:int',
      label: 'c:date',
    });
  });

  it('keeps invalid UI text as text when YAML was structured', () => {
    const yamlBody = {message: 'hello'};
    expect(bodyForYamlSave(yamlBody, '{"message":', 'json')).toBe('{"message":');
  });

  it('keeps UI text when YAML body was already a string', () => {
    expect(bodyForYamlSave('raw', '<a/>', 'xml')).toBe('<a/>');
  });

  it('packBodyAsYamlEncoded packs plain-storage <<i:>> JSON into structured YAML', () => {
    const plain = [
      '{',
      '  "name": "<<i:xxx>>",',
      '  "ssd": <<i:yy>>,',
      '  "dd": <<i:dd>>,',
      '  "message": "Hello from mmt!",',
      '  "asd": "{{r:uuid}}"',
      '}',
    ].join('\n');
    expect(packBodyAsYamlEncoded(plain, 'json')).toEqual({
      name: 'i:xxx',
      ssd: 'i:yy',
      dd: 'i:dd',
      message: 'Hello from mmt!',
      asd: 'r:uuid',
    });
  });

  it('packBodyAsYamlEncoded returns null for invalid JSON', () => {
    expect(packBodyAsYamlEncoded('{"message":', 'json')).toBeNull();
  });
});

describe('token conversion matrix (display ↔ pack ↔ template ↔ formatBody)', () => {
  const ctx = {
    inputs: {str: 'hello', num: 10, flag: true, empty: null as null},
    env: {host: 'localhost', port: 8080, ok: false},
  };

  const cases: Array<{
    name: string;
    displayJson: string;
    packed: Record<string, unknown>;
    templateHas: string;
    templateHasNot?: string;
  }> = [
    {
      name: 'r: string (city)',
      displayJson: '{"asd":"{{r:city}}"}',
      packed: {asd: 'r:city'},
      templateHas: '"asd": "{{r:city}}"',
      templateHasNot: '"asd": "r:city"',
    },
    {
      name: 'r: string (uuid)',
      displayJson: '{"id":"{{r:uuid}}"}',
      packed: {id: 'r:uuid'},
      templateHas: '"id": "{{r:uuid}}"',
      templateHasNot: '"id": "r:uuid"',
    },
    {
      name: 'r: number (int)',
      displayJson: '{"n":{{r:int}}}',
      packed: {n: 'r:int'},
      templateHas: '"n": {{r:int}}',
      templateHasNot: '"n": "{{r:int}}"',
    },
    {
      name: 'r: bool',
      displayJson: '{"flag":{{r:bool}}}',
      packed: {flag: 'r:bool'},
      templateHas: '"flag": {{r:bool}}',
      templateHasNot: '"flag": "{{r:bool}}"',
    },
    {
      name: 'c: string (date)',
      displayJson: '{"when":"{{c:date}}"}',
      packed: {when: 'c:date'},
      templateHas: '"when": "{{c:date}}"',
      templateHasNot: '"when": "c:date"',
    },
    {
      name: 'c: number (epoch_ms)',
      displayJson: '{"epoch":{{c:epoch_ms}}}',
      packed: {epoch: 'c:epoch_ms'},
      templateHas: '"epoch": {{c:epoch_ms}}',
      templateHasNot: '"epoch": "{{c:epoch_ms}}"',
    },
    {
      name: 'i: string',
      displayJson: '{"name":"{{i:str}}"}',
      packed: {name: 'i:str'},
      templateHas: '"name": "{{i:str}}"',
    },
    {
      name: 'i: number',
      displayJson: '{"ssd":{{i:num}}}',
      packed: {ssd: 'i:num'},
      templateHas: '"ssd": {{i:num}}',
      templateHasNot: '"ssd": "{{i:num}}"',
    },
    {
      name: 'i: bool',
      displayJson: '{"dd":{{i:flag}}}',
      packed: {dd: 'i:flag'},
      templateHas: '"dd": {{i:flag}}',
      templateHasNot: '"dd": "{{i:flag}}"',
    },
    {
      name: 'e: string',
      displayJson: '{"host":"{{e:host}}"}',
      packed: {host: 'e:host'},
      templateHas: '"host": "{{e:host}}"',
    },
    {
      name: 'e: number',
      displayJson: '{"port":{{e:port}}}',
      packed: {port: 'e:port'},
      templateHas: '"port": {{e:port}}',
      templateHasNot: '"port": "{{e:port}}"',
    },
    {
      name: 'e: bool',
      displayJson: '{"ok":{{e:ok}}}',
      packed: {ok: 'e:ok'},
      templateHas: '"ok": {{e:ok}}',
      templateHasNot: '"ok": "{{e:ok}}"',
    },
  ];

  it.each(cases)(
      '$name: pack → template → formatBody keep display tokens',
      ({displayJson, packed, templateHas, templateHasNot}) => {
        const fromPack = packBodyAsYamlEncoded(displayJson, 'json');
        expect(fromPack).toEqual(packed);

        const template = bodyEditTokenTemplate(fromPack, 'json', ctx);
        expect(template).toContain(templateHas);
        if (templateHasNot) {
          expect(template).not.toContain(templateHasNot);
        }

        // formatBody must not collapse tokens to bare "r:city" / "c:date".
        const formatted = formatBody('json', fromPack as object, true, ctx);
        expect(formatted).toContain(templateHas);
        if (templateHasNot) {
          expect(formatted).not.toContain(templateHasNot);
        }

        // Full round-trip through display JSON again.
        expect(packBodyAsYamlEncoded(template, 'json')).toEqual(packed);
      },
  );

  it('removing and restoring }} on {{r:city}} stays plain mid-edit then repacks cleanly', () => {
    const complete = '{\n  "asd": "{{r:city}}"\n}';
    // One closing brace removed from the display token (JSON string still valid).
    const missingBrace = '{\n  "asd": "{{r:city}"\n}';

    // Mid-edit must NOT pack into structured YAML (would store "{{r:city}" as a leaf).
    expect(packBodyAsYamlEncoded(missingBrace, 'json')).toBeNull();
    const midPlain = tokensTextToYamlBody(missingBrace, 'json', true);
    expect(typeof midPlain).toBe('string');
    expect(midPlain as string).toContain('{{r:city}');
    expect(midPlain as string).not.toContain('"r:city"');
    // Peer back to tokens keeps the incomplete display form.
    expect(yamlBodyToTokensText(midPlain, 'json')).toContain('"asd": "{{r:city}"');
    expect(yamlBodyToTokensText(midPlain, 'json')).not.toContain('"asd": "r:city"');

    const restored = packBodyAsYamlEncoded(complete, 'json');
    expect(restored).toEqual({asd: 'r:city'});
    const restoredTemplate = yamlBodyToTokensText(restored, 'json');
    expect(restoredTemplate).toContain('"asd": "{{r:city}}"');
    expect(restoredTemplate).not.toContain('"asd": "r:city"');
    expect(formatBody('json', restored as object)).toContain('"asd": "{{r:city}}"');
    expect(formatBody('json', restored as object)).not.toContain('"asd": "r:city"');
  });

  it('formatBody(json) on structured tokens never emits bare "r:city"', () => {
    expect(formatBody('json', {asd: 'r:city', id: 'r:uuid'}, true)).toBe(
        '{\n  "asd": "{{r:city}}",\n  "id": "{{r:uuid}}"\n}',
    );
  });
});

describe('bodyForYamlSave chart extras', () => {
  it('end-to-end: display → edit → revert exits → send/save paths', () => {
    const yamlBody = {message: 'hello from env'};
    const format = resolveRequestFormat('json', {}, 'post');
    expect(format).toBe('json');

    const shown = displayRequestBody(yamlBody, format);
    expect(shown).toContain('hello from env');

    const edited = applyRequestBodyEdit({
      value: '{\n  "message": "ssss"\n}',
      currentBody: yamlBody,
      format,
      baseline: null,
      bodyAlreadyTouched: false,
    });
    expect(edited.kind).toBe('stayTemp');
    if (edited.kind !== 'stayTemp') {
      return;
    }

    // Send uses the free-form string as-is (no re-pack).
    expect(bodyForSend(edited.body, format)).toBe(edited.body);

    // Save packs back to structured YAML.
    expect(bodyForYamlSave(yamlBody, edited.body, format)).toEqual({
      message: 'ssss',
    });

    // Exact revert exits temp and restores the object.
    const reverted = applyRequestBodyEdit({
      value: shown,
      currentBody: edited.body,
      format,
      baseline: edited.baseline,
      bodyAlreadyTouched: true,
    });
    expect(reverted.kind).toBe('exitTemp');
    if (reverted.kind !== 'exitTemp') {
      return;
    }
    expect(reverted.body).toEqual(yamlBody);
    expect(bodyForSend(reverted.body, format)).toBe(
        formatBody(format, yamlBody, false),
    );
  });
});

describe('headersTokenSource / queryTokenSource', () => {
  it('keeps auth bearer token markers for display projection', () => {
    const headers = headersTokenSource({
      headers: {Accept: 'application/json'},
      auth: {type: 'bearer', token: 'r:uuid'},
    });
    expect(headers.Authorization).toBe('Bearer r:uuid');
    expect(headers.Accept).toBe('application/json');
  });

  it('keeps api-key query markers', () => {
    const query = queryTokenSource({
      query: {page: '1'},
      auth: {type: 'api-key', query: 'key', value: 'r:uuid'},
    });
    expect(query.key).toBe('r:uuid');
    expect(query.page).toBe('1');
  });
});

describe('requestForSend', () => {
  it('converts {{…}} in url/headers/query/cookies to <<r:/c:…>>', () => {
    const sent = requestForSend({
      url: 'https://example.com/{{r:uuid}}',
      headers: {Authorization: 'Bearer {{r:uuid}}'},
      query: {id: '{{c:epoch}}'},
      cookies: {sid: '{{r:uuid}}'},
      body: '{"x":"{{r:uuid}}"}',
    }, 'json');
    expect(sent.url).toBe('https://example.com/<<r:uuid>>');
    expect(sent.headers?.Authorization).toBe('Bearer <<r:uuid>>');
    expect(sent.query?.id).toBe('<<c:epoch>>');
    expect(sent.cookies?.sid).toBe('<<r:uuid>>');
    expect(sent.body).toBe('{"x":"<<r:uuid>>"}');
  });
});
