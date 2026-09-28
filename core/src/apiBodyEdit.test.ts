import {
  applyRequestBodyEdit,
  bodyForSend,
  bodyForYamlSave,
  displayRequestBody,
  headersTokenSource,
  queryTokenSource,
  requestForSend,
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

  it('projects r:/c: markers as {{random …}} when tokenSource is set', () => {
    const source = {id: 'r:uuid', n: 'r:int', label: 'hello'};
    const resolved = {
      id: '11111111-1111-1111-1111-111111111111',
      n: 7,
      label: 'hello',
    };
    const shown = displayRequestBody(resolved, 'json', {tokenSource: source});
    expect(shown).toContain('"id": "{{random uuid}}"');
    expect(shown).toContain('"n": {{random int}}');
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
        '{\n  "id": "{{random uuid}}",\n  "n": {{random int}},\n  "label": "{{current date}}"\n}';
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
      url: 'https://example.com/{{random uuid}}',
      headers: {Authorization: 'Bearer {{random uuid}}'},
      query: {id: '{{current epoch}}'},
      cookies: {sid: '{{random uuid}}'},
      body: '{"x":"{{random uuid}}"}',
    }, 'json');
    expect(sent.url).toBe('https://example.com/<<r:uuid>>');
    expect(sent.headers?.Authorization).toBe('Bearer <<r:uuid>>');
    expect(sent.query?.id).toBe('<<c:epoch>>');
    expect(sent.cookies?.sid).toBe('<<r:uuid>>');
    expect(sent.body).toBe('{"x":"<<r:uuid>>"}');
  });
});
