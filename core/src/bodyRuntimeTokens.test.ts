import {
  applyRequestBodyEdit,
  bodyForSend,
  bodyForYamlSave,
  displayRequestBody,
} from './apiBodyEdit';
import {wrapLiteralToken} from './literalToken';
import {
  displayRuntimeTokensToResolvableText,
  displayRuntimeString,
  displayRuntimeStringRecord,
  displayTokenToPlain,
  findDisplayRuntimeTokenRanges,
  isJsonWithRuntimeTokensValid,
  isXmlWithRuntimeTokensValid,
  isWholeBareRuntimeToken,
  isWholeLiteralRuntimeToken,
  parseJsonWithRuntimeTokens,
  parseXmlTextWithRuntimeTokens,
  projectBodyKeepingRuntimeTokens,
  restoreAngleRuntimeTokensInUrlEncoded,
  reviveDisplayRuntimeTokensInValue,
  rewriteRuntimeLeavesToDisplayText,
  rewriteRuntimeTokensInText,
  runtimeTokenEmitsJsonString,
  stringifyJsonWithRuntimeTokens,
  toDisplayRuntimeToken,
} from './bodyRuntimeTokens';
import {beautify, formatBody} from './markupConvertor';
import {xml2js} from 'xml-js';

describe('toDisplayRuntimeToken', () => {
  it('maps r:/c: markers to {{random …}} / {{current …}}', () => {
    expect(toDisplayRuntimeToken('r:uuid')).toBe('{{random uuid}}');
    expect(toDisplayRuntimeToken('r:int(10,20)')).toBe('{{random int(10,20)}}');
    expect(toDisplayRuntimeToken('c:date')).toBe('{{current date}}');
    expect(toDisplayRuntimeToken('c:epoch_ms')).toBe('{{current epoch ms}}');
    expect(toDisplayRuntimeToken('<<c:date(+1d)>>')).toBe('{{current date(+1d)}}');
  });

  it('round-trips display → plain', () => {
    expect(displayTokenToPlain('{{random uuid}}')).toBe('r:uuid');
    expect(displayTokenToPlain('{{random int(10, 20)}}')).toBe('r:int(10, 20)');
    expect(displayTokenToPlain('{{current epoch ms}}')).toBe('c:epoch_ms');
    expect(displayTokenToPlain('{{current date(+1d)}}')).toBe('c:date(+1d)');
  });
});

describe('rewriteRuntimeTokensInText', () => {
  it('rewrites plain, angle, and embedded tokens', () => {
    expect(rewriteRuntimeTokensInText('r:uuid')).toBe('{{random uuid}}');
    expect(rewriteRuntimeTokensInText('Bearer r:uuid')).toBe('Bearer {{random uuid}}');
    expect(rewriteRuntimeTokensInText('<<c:date>>')).toBe('{{current date}}');
    expect(rewriteRuntimeTokensInText('id={{random uuid}}')).toBe('id={{random uuid}}');
  });
});

describe('displayRuntimeString / displayRuntimeStringRecord', () => {
  it('prefers source markers over resolved values', () => {
    expect(displayRuntimeString(
        '11111111-1111-1111-1111-111111111111',
        'r:uuid',
    )).toBe('{{random uuid}}');
    expect(displayRuntimeString(
        'Bearer 11111111-1111-1111-1111-111111111111',
        'Bearer r:uuid',
    )).toBe('Bearer {{random uuid}}');
    expect(displayRuntimeStringRecord(
        {a: 'resolved', b: 'keep'},
        {a: 'c:epoch', b: 'static'},
    )).toEqual({
      a: '{{current epoch}}',
      b: 'keep',
    });
  });

  it('leaves quoted YAML literals alone', () => {
    expect(displayRuntimeString('r:uuid', wrapLiteralToken('r:uuid'))).toBe('"r:uuid"');
  });
});

describe('runtimeTokenEmitsJsonString', () => {
  it('marks string-producing tokens vs number/bool', () => {
    expect(runtimeTokenEmitsJsonString('r:uuid')).toBe(true);
    expect(runtimeTokenEmitsJsonString('r:password(20)')).toBe(true);
    expect(runtimeTokenEmitsJsonString('c:date')).toBe(true);
    expect(runtimeTokenEmitsJsonString('r:int')).toBe(false);
    expect(runtimeTokenEmitsJsonString('r:bool')).toBe(false);
    expect(runtimeTokenEmitsJsonString('c:epoch_ms')).toBe(false);
  });
});

describe('whole-token detection', () => {
  it('detects bare vs literal runtime tokens', () => {
    expect(isWholeBareRuntimeToken('r:uuid')).toBe(true);
    expect(isWholeBareRuntimeToken(wrapLiteralToken('r:uuid'))).toBe(false);
    expect(isWholeLiteralRuntimeToken(wrapLiteralToken('r:uuid'))).toBe(true);
  });
});

describe('projectBodyKeepingRuntimeTokens', () => {
  it('keeps r:/c: markers and takes resolved e:/i: values', () => {
    const source = {
      id: 'r:uuid',
      user: 'e:name',
      nested: {n: 'c:epoch_ms'},
    };
    const resolved = {
      id: '11111111-1111-1111-1111-111111111111',
      user: 'alice',
      nested: {n: 1700000000000},
    };
    expect(projectBodyKeepingRuntimeTokens(source, resolved)).toEqual({
      id: 'r:uuid',
      user: 'alice',
      nested: {n: 'c:epoch_ms'},
    });
  });
});

describe('stringifyJsonWithRuntimeTokens', () => {
  it('quotes string tokens and leaves number/bool tokens bare', () => {
    const text = stringifyJsonWithRuntimeTokens({
      id: 'r:uuid',
      lucky_number: 'r:int',
      active: 'r:bool',
      request_id: 'req-<<r:uuid>>',
      bounded_int: 'r:int(10,20)',
      label: wrapLiteralToken('c:date'),
    });
    expect(text).toContain('"id": "{{random uuid}}"');
    expect(text).toContain('"lucky_number": {{random int}}');
    expect(text).toContain('"active": {{random bool}}');
    expect(text).toContain('"request_id": "req-{{random uuid}}"');
    expect(text).toContain('"bounded_int": {{random int(10,20)}}');
    expect(text).toContain('"label": "{{current date}}"');
  });
});

describe('parseJsonWithRuntimeTokens', () => {
  it('revives quoted string tokens and bare number tokens to plain markers', () => {
    const parsed = parseJsonWithRuntimeTokens(`{
  "id": "{{random uuid}}",
  "lucky_number": {{random int}},
  "active": {{random bool}},
  "request_id": "req-{{random uuid}}"
}`);
    expect(parsed).toEqual({
      id: 'r:uuid',
      lucky_number: 'r:int',
      active: 'r:bool',
      request_id: 'req-<<r:uuid>>',
    });
  });

  it('round-trips string vs number/bool forms', () => {
    const original = {
      id: 'r:uuid',
      n: 'r:int(10,20)',
      flag: 'r:bool',
      nested: {x: 'c:epoch_ms', name: 'c:date'},
    };
    const text = stringifyJsonWithRuntimeTokens(original);
    expect(text).toContain('"id": "{{random uuid}}"');
    expect(text).toContain('"n": {{random int(10,20)}}');
    expect(text).toContain('"flag": {{random bool}}');
    expect(text).toContain('"x": {{current epoch ms}}');
    expect(text).toContain('"name": "{{current date}}"');
    expect(parseJsonWithRuntimeTokens(text)).toEqual(original);
  });
});

describe('isJsonWithRuntimeTokensValid', () => {
  it('accepts unquoted display tokens and rejects real JSON errors', () => {
    expect(isJsonWithRuntimeTokensValid('{"a": {{random uuid}}}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": "{{random uuid}}"}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": {{random int}}}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a":')).toBe(false);
    expect(isJsonWithRuntimeTokensValid('{"a": {{env host}}}')).toBe(false);
  });
});

describe('findDisplayRuntimeTokenRanges', () => {
  it('finds bare and quoted display spans', () => {
    const text =
        '{\n  "id": "{{random uuid}}",\n  "n": {{random int}},\n  "label": "{{current date}}"\n}';
    expect(findDisplayRuntimeTokenRanges(text).length).toBe(3);
  });
});

describe('rewrite + revive for non-JSON formats', () => {
  it('rewrites leaves to display text and revives them back', () => {
    const source = {id: 'r:uuid', n: 'r:int', nested: {d: 'c:date'}};
    const display = rewriteRuntimeLeavesToDisplayText(source);
    expect(display).toEqual({
      id: '{{random uuid}}',
      n: '{{random int}}',
      nested: {d: '{{current date}}'},
    });
    expect(reviveDisplayRuntimeTokensInValue(display)).toEqual(source);
  });
});

describe('XML with {{display}} tokens', () => {
  function flattenXml(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(flattenXml);
    }
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === '_text') {
      return obj._text;
    }
    const out: any = {};
    for (const key of keys) {
      out[key] = flattenXml(obj[key]);
    }
    return out;
  }

  const parse = (xml: string) =>
    parseXmlTextWithRuntimeTokens(
        xml, (text) => flattenXml(xml2js(text, {compact: true})));

  it('parses display tokens in element text', () => {
    expect(parse(
        '<user><id>{{random uuid}}</id><n>{{random int}}</n></user>',
    )).toEqual({
      user: {id: 'r:uuid', n: 'r:int'},
    });
  });

  it('rejects real XML errors still', () => {
    expect(isXmlWithRuntimeTokensValid('<x></y>', (xml) => {
      xml2js(xml, {compact: true});
    })).toBe(false);
  });

  it('accepts display tokens as valid XML text', () => {
    expect(isXmlWithRuntimeTokensValid(
        '<user><id>{{random uuid}}</id></user>',
        (xml) => {
          xml2js(xml, {compact: true});
        },
    )).toBe(true);
  });
});

describe('restoreAngleRuntimeTokensInUrlEncoded', () => {
  it('decodes percent-encoded display tokens only', () => {
    const encoded =
        'id=%7B%7Brandom%20uuid%7D%7D&n=%7B%7Brandom%20int%2810%2C20%29%7D%7D&note=a%3Cb';
    const restored = restoreAngleRuntimeTokensInUrlEncoded(encoded);
    expect(restored).toBe(
        'id={{random uuid}}&n={{random int(10,20)}}&note=a%3Cb',
    );
  });
});

describe('displayRuntimeTokensToResolvableText', () => {
  it('converts display tokens to <<r:/c:>> for the runner', () => {
    expect(displayRuntimeTokensToResolvableText(
        'id={{random uuid}}&n={{random int}}',
    )).toBe('id=<<r:uuid>>&n=<<r:int>>');
  });
});

describe('displayRequestBody across formats', () => {
  const source = {
    user: {
      id: 'r:uuid',
      age: 'r:int(1,100)',
      active: 'r:bool',
    },
  };
  const resolved = {
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      age: 42,
      active: true,
    },
  };

  it('json: quotes string tokens, bare number/bool', () => {
    const shown = displayRequestBody(resolved, 'json', {tokenSource: source});
    expect(shown).toContain('"id": "{{random uuid}}"');
    expect(shown).toContain('"age": {{random int(1,100)}}');
    expect(shown).toContain('"active": {{random bool}}');
    expect(shown).not.toContain('11111111');
  });

  it('multipart: same JSON projection rules', () => {
    const shown = displayRequestBody(resolved, 'multipart', {tokenSource: source});
    expect(shown).toContain('"id": "{{random uuid}}"');
  });

  it('xml: emits display tokens inside elements', () => {
    const shown = displayRequestBody(resolved, 'xml', {tokenSource: source});
    expect(shown).toContain('<id>{{random uuid}}</id>');
    expect(shown).toContain('<age>{{random int(1,100)}}</age>');
    expect(shown).toContain('<active>{{random bool}}</active>');
  });

  it('xmle: display tokens with expanded empty elements', () => {
    const withEmpty = {root: {id: 'r:uuid', empty: {}}};
    const resolvedEmpty = {root: {id: 'abc', empty: {}}};
    const shown = displayRequestBody(resolvedEmpty, 'xmle', {
      tokenSource: withEmpty,
    });
    expect(shown).toContain('<id>{{random uuid}}</id>');
    expect(shown).toContain('<empty></empty>');
  });

  it('urlencoded: keeps display tokens readable', () => {
    const flatSource = {
      id: 'r:uuid',
      lucky_number: 'r:int',
      request_id: 'req-<<r:uuid>>',
      bounded_int: 'r:int(10,20)',
    };
    const flatResolved = {
      id: 'abc',
      lucky_number: 7,
      request_id: 'req-x',
      bounded_int: 15,
    };
    const shown = displayRequestBody(flatResolved, 'urlencoded', {
      tokenSource: flatSource,
    });
    expect(shown).toContain('id={{random uuid}}');
    expect(shown).toContain('lucky_number={{random int}}');
    expect(shown).toContain('request_id=req-{{random uuid}}');
    expect(shown).toContain('bounded_int={{random int(10,20)}}');
    expect(shown).not.toContain('%7B%7B');
  });

  it('text/html/none: project display tokens; number/bool stay unquoted', () => {
    for (const format of ['text', 'html', 'none'] as const) {
      const shown = displayRequestBody(resolved, format, {tokenSource: source});
      expect(shown).toContain('"id": "{{random uuid}}"');
      expect(shown).toContain('"age": {{random int(1,100)}}');
      expect(shown).toContain('"active": {{random bool}}');
      expect(shown).not.toContain('"{{random int(1,100)}}"');
      expect(shown).not.toContain('"{{random bool}}"');
    }
  });
});

describe('bodyForYamlSave across formats', () => {
  it('json: packs display tokens to plain markers', () => {
    const yamlBody = {id: 'x', n: 1, active: false};
    const ui = `{
  "id": "{{random uuid}}",
  "n": {{random int}},
  "active": {{random bool}},
  "request_id": "req-{{random uuid}}"
}`;
    expect(bodyForYamlSave(yamlBody, ui, 'json')).toEqual({
      id: 'r:uuid',
      n: 'r:int',
      active: 'r:bool',
      request_id: 'req-<<r:uuid>>',
    });
  });

  it('xml/xmle/urlencoded pack display tokens', () => {
    expect(bodyForYamlSave(
        {user: {id: 'x'}},
        '<user><id>{{random uuid}}</id></user>',
        'xml',
    )).toEqual({user: {id: 'r:uuid'}});

    expect(bodyForYamlSave(
        {root: {id: 'x'}},
        '<root><id>{{random uuid}}</id><empty></empty></root>',
        'xmle',
    )).toEqual({root: {id: 'r:uuid', empty: {}}});

    expect(bodyForYamlSave(
        {id: 'x', n: 1},
        'id={{random uuid}}&n={{random int}}',
        'urlencoded',
    )).toEqual({id: 'r:uuid', n: 'r:int'});
  });
});

describe('display → save round-trips', () => {
  it('json/xml/urlencoded/multipart round-trip', () => {
    const source = {
      id: 'r:uuid',
      n: 'r:int(10,20)',
      flag: 'r:bool',
      stamp: 'c:date',
    };
    const resolved = {id: 'u', n: 12, flag: false, stamp: '2026-01-01'};
    const jsonShown = displayRequestBody(resolved, 'json', {tokenSource: source});
    expect(bodyForYamlSave(source, jsonShown, 'json')).toEqual(source);

    const xmlSource = {user: {id: 'r:uuid', n: 'r:int'}};
    const xmlResolved = {user: {id: 'u', n: 3}};
    const xmlShown = displayRequestBody(xmlResolved, 'xml', {
      tokenSource: xmlSource,
    });
    expect(bodyForYamlSave(xmlSource, xmlShown, 'xml')).toEqual(xmlSource);

    const ueSource = {id: 'r:uuid', n: 'r:int'};
    const ueShown = displayRequestBody({id: 'u', n: 3}, 'urlencoded', {
      tokenSource: ueSource,
    });
    expect(bodyForYamlSave(ueSource, ueShown, 'urlencoded')).toEqual(ueSource);

    const mpSource = [
      {name: 'id', value: 'r:uuid'},
      {name: 'n', value: 'r:int'},
    ];
    const mpShown = displayRequestBody(
        [{name: 'id', value: 'a'}, {name: 'n', value: 1}],
        'multipart',
        {tokenSource: mpSource},
    );
    expect(bodyForYamlSave(mpSource, mpShown, 'multipart')).toEqual(mpSource);
  });
});

describe('beautify preserves display tokens', () => {
  it('json/xml/urlencoded/multipart', () => {
    expect(beautify(
        'json',
        '{"id":"{{random uuid}}","n":{{random int(10,20)}}}',
    )).toContain('"id": "{{random uuid}}"');

    expect(beautify('xml', '<user><id>{{random uuid}}</id></user>'))
        .toContain('<id>{{random uuid}}</id>');

    expect(beautify('urlencoded', 'id={{random uuid}}&n={{random int}}'))
        .toContain('id={{random uuid}}');

    expect(beautify(
        'multipart',
        '[{"name":"id","value":"{{random uuid}}"}]',
    )).toContain('{{random uuid}}');
  });
});

describe('bodyForSend converts display tokens for the runner', () => {
  it('rewrites {{random …}} to <<r:…>> in free-form strings', () => {
    expect(bodyForSend(
        '{"id":"{{random uuid}}","n":{{random int}}}',
        'json',
    )).toBe('{"id":"<<r:uuid>>","n":<<r:int>>}');
  });
});

describe('applyRequestBodyEdit with tokenSource baseline', () => {
  it('json: exact revert of projected display exits temp', () => {
    const source = {id: 'r:uuid', n: 'r:int'};
    const resolved = {id: 'u', n: 1};
    const shown = displayRequestBody(resolved, 'json', {tokenSource: source});
    const edited = applyRequestBodyEdit({
      value: '{\n  "id": "{{random uuid}}",\n  "n": {{random int(5)}}\n}',
      currentBody: resolved,
      format: 'json',
      baseline: null,
      bodyAlreadyTouched: false,
      tokenSource: source,
    });
    expect(edited.kind).toBe('stayTemp');
    if (edited.kind !== 'stayTemp') {
      return;
    }
    const reverted = applyRequestBodyEdit({
      value: shown,
      currentBody: edited.body,
      format: 'json',
      baseline: edited.baseline,
      bodyAlreadyTouched: true,
      tokenSource: source,
    });
    expect(reverted).toEqual({
      kind: 'exitTemp',
      body: resolved,
      baseline: null,
    });
  });
});

describe('formatBody without tokenSource still resolves normally', () => {
  it('json stringifies concrete values', () => {
    expect(JSON.parse(formatBody('json', {id: 'abc', n: 1}))).toEqual({
      id: 'abc',
      n: 1,
    });
  });
});
