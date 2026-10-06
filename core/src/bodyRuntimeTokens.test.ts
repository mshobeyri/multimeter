import {
  applyRequestBodyEdit,
  bodyEditTokenTemplate,
  bodyForSend,
  bodyForYamlSave,
  displayRequestBody,
  saveEditorBody,
} from './apiBodyEdit';
import {
  isLiteralTokenValue,
  unwrapLiteralToken,
  wrapLiteralToken,
} from './literalToken';
import {apiToYaml, yamlToAPI} from './apiParsePack';
import {
  displayRuntimeTokensToResolvableText,
  displayRuntimeString,
  displayRuntimeStringRecord,
  displayTokenToPlain,
  enterEditStringBuffer,
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
  sourceToDisplayTokenTemplate,
  stringifyJsonWithRuntimeTokens,
  toDisplayRuntimeToken,
  peerStringToDisplay,
  peerStringToYaml,
  peerRecordToDisplay,
  peerRecordToYaml,
  projectTokenFieldPreview,
  stringContainsFieldToken,
  wrapTypedTokenAtCursor,
  findDisplayTokenCharRanges,
  findBodyTokenHoverSpans,
} from './bodyRuntimeTokens';
import {beautify, formatBody} from './markupConvertor';
import {xml2js} from 'xml-js';

describe('toDisplayRuntimeToken', () => {
  it('maps r:/c:/i:/e: markers to {{prefix:…}}', () => {
    expect(toDisplayRuntimeToken('r:uuid')).toBe('{{r:uuid}}');
    expect(toDisplayRuntimeToken('r:int(10,20)')).toBe('{{r:int(10,20)}}');
    expect(toDisplayRuntimeToken('c:date')).toBe('{{c:date}}');
    expect(toDisplayRuntimeToken('c:epoch_ms')).toBe('{{c:epoch_ms}}');
    expect(toDisplayRuntimeToken('<<c:date(+1d)>>')).toBe('{{c:date(+1d)}}');
    expect(toDisplayRuntimeToken('<<i:user>>')).toBe('{{i:user}}');
    expect(toDisplayRuntimeToken('e:token')).toBe('{{e:token}}');
    // Unknown names are still tokens in the UI (validator warns separately).
    expect(toDisplayRuntimeToken('r:not_a_real_token')).toBe('{{r:not_a_real_token}}');
    expect(toDisplayRuntimeToken('<<c:nope>>')).toBe('{{c:nope}}');
  });

  it('round-trips display → plain (new + legacy long-form)', () => {
    expect(displayTokenToPlain('{{r:uuid}}')).toBe('r:uuid');
    expect(displayTokenToPlain('{{r:int(10, 20)}}')).toBe('r:int(10, 20)');
    expect(displayTokenToPlain('{{c:epoch_ms}}')).toBe('c:epoch_ms');
    expect(displayTokenToPlain('{{c:date(+1d)}}')).toBe('c:date(+1d)');
    expect(displayTokenToPlain('{{i:user}}')).toBe('i:user');
    expect(displayTokenToPlain('{{e:token}}')).toBe('e:token');
    // Legacy long-form still parses
    expect(displayTokenToPlain('{{random uuid}}')).toBe('r:uuid');
    expect(displayTokenToPlain('{{current epoch ms}}')).toBe('c:epoch_ms');
    expect(displayTokenToPlain('{{current date(+1d)}}')).toBe('c:date(+1d)');
  });
});

describe('peerString / peerRecord YAML↔UI', () => {
  it('displays bare and angled YAML tokens as {{…}}', () => {
    expect(peerStringToDisplay('r:uuid')).toBe('{{r:uuid}}');
    expect(peerStringToDisplay('<<i:user>>')).toBe('{{i:user}}');
    expect(peerStringToDisplay('Bearer <<e:token>>')).toBe('Bearer {{e:token}}');
    expect(peerRecordToDisplay({id: 'r:uuid', q: '<<i:x>>'})).toEqual({
      id: '{{r:uuid}}',
      q: '{{i:x}}',
    });
  });

  it('writes quoted token text back as a literal and bare tokens as tokens', () => {
    expect(peerStringToDisplay(wrapLiteralToken('i:xxx'))).toBe('"i:xxx"');
    expect(peerStringToYaml('"i:xxx"')).toBe(wrapLiteralToken('i:xxx'));
    expect(peerStringToYaml('\'r:uuid\'')).toBe(wrapLiteralToken('r:uuid'));
    expect(peerStringToYaml('i:xxx')).toBe('i:xxx');
    expect(peerStringToYaml('{{i:xxx}}')).toBe('i:xxx');
  });

  it('writes bare r:uuid and {{r:uuid}} to YAML as r:uuid', () => {
    expect(peerStringToYaml('r:uuid')).toBe('r:uuid');
    expect(peerStringToYaml('{{r:uuid}}')).toBe('r:uuid');
    expect(peerStringToYaml('{{i:user}}')).toBe('i:user');
    expect(peerRecordToYaml({id: 'r:uuid', name: '{{i:user}}'})).toEqual({
      id: 'r:uuid',
      name: 'i:user',
    });
  });

  it('strips incomplete whole {{r:…}} to bare form', () => {
    expect(peerStringToYaml('{{r:u}}')).toBe('r:u');
    expect(peerStringToYaml('{{r:uu}}')).toBe('r:uu');
  });

  it('round-trips query-style records', () => {
    const yaml = {id: 'r:uuid', city: 'i:city'};
    const ui = peerRecordToDisplay(yaml);
    expect(ui).toEqual({id: '{{r:uuid}}', city: '{{i:city}}'});
    expect(peerRecordToYaml(ui)).toEqual(yaml);
  });

  it('omits empty records', () => {
    expect(peerRecordToYaml({})).toBeUndefined();
    expect(peerRecordToYaml({'': ''})).toBeUndefined();
  });
});

describe('rewriteRuntimeTokensInText', () => {
  it('rewrites r:/c: plain, angle, and embedded tokens', () => {
    expect(rewriteRuntimeTokensInText('r:uuid')).toBe('{{r:uuid}}');
    expect(rewriteRuntimeTokensInText('Bearer r:uuid')).toBe('Bearer r:uuid');
    expect(rewriteRuntimeTokensInText('Bearer <<r:uuid>>')).toBe('Bearer {{r:uuid}}');
    expect(rewriteRuntimeTokensInText('<<c:date>>')).toBe('{{c:date}}');
    expect(rewriteRuntimeTokensInText('id={{r:uuid}}')).toBe('id={{r:uuid}}');
    expect(rewriteRuntimeTokensInText('{{r:uuid}}')).toBe('{{r:uuid}}');
  });

  it('does not rewrite i:/e: (preview keeps resolved values)', () => {
    expect(rewriteRuntimeTokensInText('<<i:user>>')).toBe('<<i:user>>');
    expect(rewriteRuntimeTokensInText('e:token')).toBe('e:token');
  });
});

describe('displayRuntimeString / displayRuntimeStringRecord', () => {
  it('prefers source r:/c: markers over resolved values', () => {
    expect(displayRuntimeString(
        '11111111-1111-1111-1111-111111111111',
        'r:uuid',
    )).toBe('{{r:uuid}}');
    expect(displayRuntimeString(
        'Bearer 11111111-1111-1111-1111-111111111111',
        'Bearer r:uuid',
    )).toBe('Bearer 11111111-1111-1111-1111-111111111111');
    expect(displayRuntimeString(
        'Bearer 11111111-1111-1111-1111-111111111111',
        'Bearer <<r:uuid>>',
    )).toBe('Bearer {{r:uuid}}');
    expect(displayRuntimeStringRecord(
        {a: 'resolved', b: 'keep'},
        {a: 'c:epoch', b: 'static'},
    )).toEqual({
      a: '{{c:epoch}}',
      b: 'keep',
    });
  });

  it('shows resolved values for i:/e: source (preview)', () => {
    expect(displayRuntimeString('alice', '<<i:user>>')).toBe('alice');
    expect(displayRuntimeString('secret', 'e:token')).toBe('secret');
  });

  it('keeps a missing i:/e: fallback as plain token text', () => {
    expect(displayRuntimeString('i:missing', 'i:missing')).toBe('i:missing');
    expect(displayRuntimeString('e:missing')).toBe('e:missing');
    const missing = projectTokenFieldPreview('{{i:user}} / {{e:host}}', {
      inputs: {},
      env: {},
    });
    expect(missing.text).toBe('i:user / e:host');
  });

  it('leaves quoted YAML literals alone', () => {
    expect(displayRuntimeString('r:uuid', wrapLiteralToken('r:uuid'))).toBe('"r:uuid"');
  });
});

describe('enterEditStringBuffer / sourceToDisplayTokenTemplate', () => {
  it('projects YAML i:/e:/r:/c: to uniform {{…}} edit buffer', () => {
    expect(sourceToDisplayTokenTemplate('<<i:user>>')).toBe('{{i:user}}');
    expect(sourceToDisplayTokenTemplate('Bearer <<e:token>>')).toBe(
        'Bearer {{e:token}}',
    );
    expect(sourceToDisplayTokenTemplate('r:uuid')).toBe('{{r:uuid}}');
  });

  it('first keystroke swaps resolved preview to token template', () => {
    expect(enterEditStringBuffer('alice', 'alicex', '<<i:user>>'))
        .toBe('{{i:user}}');
    expect(enterEditStringBuffer('alice', 'alice', '<<i:user>>'))
        .toBe('{{i:user}}');
  });

  it('keeps large paste as the edit buffer', () => {
    expect(enterEditStringBuffer('alice', 'hello world', '<<i:user>>'))
        .toBe('hello world');
  });
});

describe('wrapTypedTokenAtCursor', () => {
  it('wraps i/e/r/c after the first character and keeps the caret there', () => {
    expect(wrapTypedTokenAtCursor('i:x', 3)).toEqual({text: '{{i:x}}', cursor: 5});
    expect(wrapTypedTokenAtCursor('e:t', 3)).toEqual({text: '{{e:t}}', cursor: 5});
    expect(wrapTypedTokenAtCursor('r:u', 3)).toEqual({text: '{{r:u}}', cursor: 5});
    expect(wrapTypedTokenAtCursor('c:d', 3)).toEqual({text: '{{c:d}}', cursor: 5});
    expect(wrapTypedTokenAtCursor('r:uuid', 6)).toEqual({
      text: '{{r:uuid}}',
      cursor: 8,
    });
  });

  it('wraps a whole-value token and leaves mixed text literal', () => {
    expect(wrapTypedTokenAtCursor('Bearer i:x', 10)).toEqual({
      text: 'Bearer i:x',
      cursor: 10,
    });
    expect(wrapTypedTokenAtCursor('i:xy', 3)).toEqual({text: '{{i:xy}}', cursor: 5});
  });

  it('does not wrap a bare token mixed into JSON text', () => {
    const before = '{\n  "id": "i:x"\n}';
    const cursor = before.indexOf('i:x') + 'i:x'.length;
    expect(wrapTypedTokenAtCursor(before, cursor)).toEqual({
      text: before,
      cursor,
    });
    const uuid = '{\n  "id": "r:uuid"\n}';
    const uuidCursor = uuid.indexOf('r:uuid') + 'r:uuid'.length;
    expect(wrapTypedTokenAtCursor(uuid, uuidCursor)).toEqual({
      text: uuid,
      cursor: uuidCursor,
    });
    const angled = '{\n  "id": "<<i:x>>"\n}';
    const angledCursor = angled.indexOf('i:x') + 'i:x'.length;
    expect(wrapTypedTokenAtCursor(angled, angledCursor)).toEqual({
      text: angled,
      cursor: angledCursor,
    });
  });

  it('does not wrap a prefix alone or a token that is already braced', () => {
    expect(wrapTypedTokenAtCursor('i:', 2)).toEqual({text: 'i:', cursor: 2});
    expect(wrapTypedTokenAtCursor('{{i:x}}', 5)).toEqual({text: '{{i:x}}', cursor: 5});
    expect(wrapTypedTokenAtCursor('{{r:uuid}}', 8)).toEqual({
      text: '{{r:uuid}}',
      cursor: 8,
    });
    expect(wrapTypedTokenAtCursor('<<i:x>>', 5)).toEqual({text: '<<i:x>>', cursor: 5});
  });
});

describe('stringContainsFieldToken / projectTokenFieldPreview', () => {
  it('detects display, angle, and bare tokens', () => {
    expect(stringContainsFieldToken('{{i:user}}')).toBe(true);
    expect(stringContainsFieldToken('Bearer <<e:token>>')).toBe(true);
    expect(stringContainsFieldToken('r:uuid')).toBe(true);
    expect(stringContainsFieldToken('plain')).toBe(false);
  });

  it('resolves i:/e: in idle preview but keeps r:/c: as display tokens', () => {
    const {text, spans} = projectTokenFieldPreview(
        'Bearer {{e:token}} / {{r:uuid}} / {{c:date}}',
        {env: {token: 'secret'}, inputs: {}},
    );
    expect(text).toBe('Bearer secret / {{r:uuid}} / {{c:date}}');
    expect(spans.length).toBe(3);
    expect(spans[0]).toMatchObject({kind: 'resolved', tooltip: '{{e:token}}'});
    expect(spans[1]).toMatchObject({kind: 'token'});
    expect(spans[2]).toMatchObject({kind: 'token'});
    expect(text.slice(spans[1].start, spans[1].end)).toBe('{{r:uuid}}');
    expect(text.slice(spans[2].start, spans[2].end)).toBe('{{c:date}}');
  });

  it('shows nested r:/c: input values as {{…}} in i: idle preview', () => {
    const {text, spans} = projectTokenFieldPreview('{{i:age}}', {
      inputs: {age: 'r:int'},
      env: {},
    });
    expect(text).toBe('{{r:int}}');
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({kind: 'resolved', tooltip: '{{i:age}}'});
  });

  it('findDisplayTokenCharRanges covers {{…}} edit buffer', () => {
    const spans = findDisplayTokenCharRanges('x{{i:a}}y{{r:uuid}}', {
      inputs: {a: 'A'},
      env: {},
    });
    expect(spans.length).toBe(2);
    expect(spans.every(s => s.kind === 'token')).toBe(true);
    expect(spans[0].tooltip).toBe('A');
  });

  it('findBodyTokenHoverSpans marks resolved i:/e: values from template', () => {
    const spans = findBodyTokenHoverSpans(
        '{"user":"alice","n":10}',
        {
          tokenTemplate: '{"user":"{{i:user}}","n":{{i:n}}}',
          valueContext: {inputs: {user: 'alice', n: 10}, env: {}},
        },
    );
    const resolved = spans.filter(s => s.kind === 'resolved');
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    expect(resolved.some(s => s.tooltip === '{{i:user}}')).toBe(true);
  });

  it('findBodyTokenHoverSpans underlines resolved r:/c: from structured bodies', () => {
    const uuid = '11111111-1111-1111-1111-111111111111';
    const spans = findBodyTokenHoverSpans(
        `{\n  "asd": "${uuid}"\n}`,
        {
          tokenSource: {asd: 'r:uuid'},
          resolvedBody: {asd: uuid},
        },
    );
    const resolved = spans.filter(s => s.kind === 'resolved');
    expect(resolved.some(s => s.tooltip === '{{r:uuid}}')).toBe(true);
    const hit = resolved.find(s => s.tooltip === '{{r:uuid}}');
    expect(hit).toBeTruthy();
    expect(`{\n  "asd": "${uuid}"\n}`.slice(hit!.start, hit!.end)).toBe(uuid);
  });
});

describe('runtimeTokenEmitsJsonString', () => {
  it('marks string-producing tokens vs number/bool', () => {
    expect(runtimeTokenEmitsJsonString('r:uuid')).toBe(true);
    expect(runtimeTokenEmitsJsonString('r:password(20)')).toBe(true);
    expect(runtimeTokenEmitsJsonString('c:date')).toBe(true);
    // Weekday / month *names* are strings (quoted in JSON body UI).
    expect(runtimeTokenEmitsJsonString('c:day')).toBe(true);
    expect(runtimeTokenEmitsJsonString('c:month')).toBe(true);
    expect(runtimeTokenEmitsJsonString('r:int')).toBe(false);
    expect(runtimeTokenEmitsJsonString('r:bool')).toBe(false);
    expect(runtimeTokenEmitsJsonString('c:epoch_ms')).toBe(false);
    expect(runtimeTokenEmitsJsonString('c:year')).toBe(false);
    expect(runtimeTokenEmitsJsonString('c:weekday_number')).toBe(false);
  });

  it('quotes i:/e: from inputs/env value types', () => {
    const ctx = {
      inputs: {xxx: 'ss', yy: 10, flag: true, nested: {n: 3}},
      env: {port: 8080, host: 'localhost'},
    };
    expect(runtimeTokenEmitsJsonString('i:xxx', ctx)).toBe(true);
    expect(runtimeTokenEmitsJsonString('i:yy', ctx)).toBe(false);
    expect(runtimeTokenEmitsJsonString('i:flag', ctx)).toBe(false);
    expect(runtimeTokenEmitsJsonString('i:nested.n', ctx)).toBe(false);
    expect(runtimeTokenEmitsJsonString('e:port', ctx)).toBe(false);
    expect(runtimeTokenEmitsJsonString('e:host', ctx)).toBe(true);
    // Missing → string (quoted)
    expect(runtimeTokenEmitsJsonString('i:missing', ctx)).toBe(true);
    expect(runtimeTokenEmitsJsonString('i:yy')).toBe(true);
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
    expect(text).toContain('"id": "{{r:uuid}}"');
    expect(text).toContain('"lucky_number": {{r:int}}');
    expect(text).toContain('"active": {{r:bool}}');
    expect(text).toContain('"request_id": "req-{{r:uuid}}"');
    expect(text).toContain('"bounded_int": {{r:int(10,20)}}');
    expect(text).toContain('"label": "c:date"');
  });

  it('quotes c:day / c:month (string names, not numbers)', () => {
    const text = stringifyJsonWithRuntimeTokens({
      weekday: 'c:day',
      month_name: 'c:month',
      year: 'c:year',
    });
    expect(text).toContain('"weekday": "{{c:day}}"');
    expect(text).toContain('"month_name": "{{c:month}}"');
    expect(text).toContain('"year": {{c:year}}');
    expect(text).not.toContain('"weekday": {{c:day}}');
    expect(text).not.toContain('"month_name": {{c:month}}');
  });

  it('quotes i:/e: from inputs/env value types', () => {
    const text = stringifyJsonWithRuntimeTokens(
        {
          name: '{{i:xxx}}',
          ssd: '{{i:yy}}',
          message: 'Hello from mmt!',
        },
        true,
        {inputs: {xxx: 'ss', yy: 10}},
    );
    expect(text).toContain('"name": "{{i:xxx}}"');
    expect(text).toContain('"ssd": {{i:yy}}');
    expect(text).not.toContain('"ssd": "{{i:yy}}"');
    expect(text).toContain('"message": "Hello from mmt!"');
  });

  it('quotes i: from parallel resolved leaf types', () => {
    const text = stringifyJsonWithRuntimeTokens(
        {name: '{{i:xxx}}', ssd: '{{i:yy}}'},
        true,
        undefined,
        {name: 'ss', ssd: 10},
    );
    expect(text).toContain('"name": "{{i:xxx}}"');
    expect(text).toContain('"ssd": {{i:yy}}');
    expect(text).not.toContain('"ssd": "{{i:yy}}"');
  });
});

describe('parseJsonWithRuntimeTokens', () => {
  it('keeps a JSON string i:xxx as quoted text and {{i:xxx}} as a live token', () => {
    const parsed = parseJsonWithRuntimeTokens(`{
  "name": "{{i:username}}",
  "str": "i:username"
}`) as {name: string; str: string};
    expect(parsed.name).toBe('i:username');
    expect(parsed.str).toBe(wrapLiteralToken('i:username'));
  });

  it('revives quoted string tokens and bare number tokens to plain markers', () => {
    const parsed = parseJsonWithRuntimeTokens(`{
  "id": "{{r:uuid}}",
  "lucky_number": {{r:int}},
  "active": {{r:bool}},
  "request_id": "req-{{r:uuid}}"
}`);
    expect(parsed).toEqual({
      id: 'r:uuid',
      lucky_number: 'r:int',
      active: 'r:bool',
      request_id: 'req-<<r:uuid>>',
    });
  });

  it('parses plain-storage unquoted <<i:>> / <<e:>> angle tokens', () => {
    const parsed = parseJsonWithRuntimeTokens(`{
  "name": "<<i:xxx>>",
  "ssd": <<i:yy>>,
  "dd": <<i:dd>>,
  "host": "<<e:host>>",
  "port": <<e:port>>,
  "id": "<<r:uuid>>",
  "n": <<r:int>>,
  "message": "Hello from mmt!"
}`);
    expect(parsed).toEqual({
      name: 'i:xxx',
      ssd: 'i:yy',
      dd: 'i:dd',
      host: 'e:host',
      port: 'e:port',
      id: 'r:uuid',
      n: 'r:int',
      message: 'Hello from mmt!',
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
    expect(text).toContain('"id": "{{r:uuid}}"');
    expect(text).toContain('"n": {{r:int(10,20)}}');
    expect(text).toContain('"flag": {{r:bool}}');
    expect(text).toContain('"x": {{c:epoch_ms}}');
    expect(text).toContain('"name": "{{c:date}}"');
    expect(parseJsonWithRuntimeTokens(text)).toEqual(original);
  });
});

describe('isJsonWithRuntimeTokensValid', () => {
  it('accepts unquoted display tokens and rejects real JSON errors', () => {
    expect(isJsonWithRuntimeTokensValid('{"a": {{r:uuid}}}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": "{{r:uuid}}"}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": {{r:int}}}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": <<i:yy>>}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a": "<<i:xxx>>"}')).toBe(true);
    expect(isJsonWithRuntimeTokensValid('{"a":')).toBe(false);
    expect(isJsonWithRuntimeTokensValid('{"a": {{env host}}}')).toBe(false);
  });
});

describe('findDisplayRuntimeTokenRanges', () => {
  it('finds bare and quoted display spans', () => {
    const text =
        '{\n  "id": "{{r:uuid}}",\n  "n": {{r:int}},\n  "label": "{{c:date}}"\n}';
    expect(findDisplayRuntimeTokenRanges(text).length).toBe(3);
  });
});

describe('rewrite + revive for non-JSON formats', () => {
  it('rewrites leaves to display text and revives them back', () => {
    const source = {id: 'r:uuid', n: 'r:int', nested: {d: 'c:date'}};
    const display = rewriteRuntimeLeavesToDisplayText(source);
    expect(display).toEqual({
      id: '{{r:uuid}}',
      n: '{{r:int}}',
      nested: {d: '{{c:date}}'},
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
        '<user><id>{{r:uuid}}</id><n>{{r:int}}</n></user>',
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
        '<user><id>{{r:uuid}}</id></user>',
        (xml) => {
          xml2js(xml, {compact: true});
        },
    )).toBe(true);
  });
});

describe('restoreAngleRuntimeTokensInUrlEncoded', () => {
  it('decodes percent-encoded display tokens only', () => {
    const encoded =
        'id=%7B%7Br%3Auuid%7D%7D&n=%7B%7Br%3Aint%2810%2C20%29%7D%7D&note=a%3Cb';
    const restored = restoreAngleRuntimeTokensInUrlEncoded(encoded);
    expect(restored).toBe(
        'id={{r:uuid}}&n={{r:int(10,20)}}&note=a%3Cb',
    );
    // Legacy long-form still restores
    expect(restoreAngleRuntimeTokensInUrlEncoded(
        'id=%7B%7Brandom%20uuid%7D%7D',
    )).toBe('id={{r:uuid}}');
  });
});

describe('displayRuntimeTokensToResolvableText', () => {
  it('converts display tokens to <<r:/c:>> for the runner', () => {
    expect(displayRuntimeTokensToResolvableText(
        'id={{r:uuid}}&n={{r:int}}',
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
    expect(shown).toContain('"id": "{{r:uuid}}"');
    expect(shown).toContain('"age": {{r:int(1,100)}}');
    expect(shown).toContain('"active": {{r:bool}}');
    expect(shown).not.toContain('11111111');
  });

  it('multipart: same JSON projection rules', () => {
    const shown = displayRequestBody(resolved, 'multipart', {tokenSource: source});
    expect(shown).toContain('"id": "{{r:uuid}}"');
  });

  it('xml: emits display tokens inside elements', () => {
    const shown = displayRequestBody(resolved, 'xml', {tokenSource: source});
    expect(shown).toContain('<id>{{r:uuid}}</id>');
    expect(shown).toContain('<age>{{r:int(1,100)}}</age>');
    expect(shown).toContain('<active>{{r:bool}}</active>');
  });

  it('xmle: display tokens with expanded empty elements', () => {
    const withEmpty = {root: {id: 'r:uuid', empty: {}}};
    const resolvedEmpty = {root: {id: 'abc', empty: {}}};
    const shown = displayRequestBody(resolvedEmpty, 'xmle', {
      tokenSource: withEmpty,
    });
    expect(shown).toContain('<id>{{r:uuid}}</id>');
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
    expect(shown).toContain('id={{r:uuid}}');
    expect(shown).toContain('lucky_number={{r:int}}');
    expect(shown).toContain('request_id=req-{{r:uuid}}');
    expect(shown).toContain('bounded_int={{r:int(10,20)}}');
    expect(shown).not.toContain('%7B%7B');
  });

  it('text/html/none: project display tokens; number/bool stay unquoted', () => {
    for (const format of ['text', 'html', 'none'] as const) {
      const shown = displayRequestBody(resolved, format, {tokenSource: source});
      expect(shown).toContain('"id": "{{r:uuid}}"');
      expect(shown).toContain('"age": {{r:int(1,100)}}');
      expect(shown).toContain('"active": {{r:bool}}');
      expect(shown).not.toContain('"{{r:int(1,100)}}"');
      expect(shown).not.toContain('"{{r:bool}}"');
    }
  });
});

describe('bodyForYamlSave across formats', () => {
  it('json: packs display tokens to plain markers', () => {
    const yamlBody = {id: 'x', n: 1, active: false};
    const ui = `{
  "id": "{{r:uuid}}",
  "n": {{r:int}},
  "active": {{r:bool}},
  "request_id": "req-{{r:uuid}}"
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
        '<user><id>{{r:uuid}}</id></user>',
        'xml',
    )).toEqual({user: {id: 'r:uuid'}});

    expect(bodyForYamlSave(
        {root: {id: 'x'}},
        '<root><id>{{r:uuid}}</id><empty></empty></root>',
        'xmle',
    )).toEqual({root: {id: 'r:uuid', empty: {}}});

    expect(bodyForYamlSave(
        {id: 'x', n: 1},
        'id={{r:uuid}}&n={{r:int}}',
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
        '{"id":"{{r:uuid}}","n":{{r:int(10,20)}}}',
    )).toContain('"id": "{{r:uuid}}"');

    expect(beautify('xml', '<user><id>{{r:uuid}}</id></user>'))
        .toContain('<id>{{r:uuid}}</id>');

    expect(beautify('urlencoded', 'id={{r:uuid}}&n={{r:int}}'))
        .toContain('id={{r:uuid}}');

    expect(beautify(
        'multipart',
        '[{"name":"id","value":"{{r:uuid}}"}]',
    )).toContain('{{r:uuid}}');
  });

  it('keeps unquoted i:/e: number and bool tokens without valueContext', () => {
    const src = [
      '{',
      '  "name": "{{i:xxx}}",',
      '  "ssd": {{i:yy}},',
      '  "dd": {{i:dd}},',
      '  "message": "Hello from mmt!",',
      '  "asd": "{{r:uuid}}"',
      '}',
    ].join('\n');
    const out = beautify('json', src);
    expect(out).toContain('"name": "{{i:xxx}}"');
    expect(out).toContain('"ssd": {{i:yy}}');
    expect(out).not.toContain('"ssd": "{{i:yy}}"');
    expect(out).toContain('"dd": {{i:dd}}');
    expect(out).not.toContain('"dd": "{{i:dd}}"');
    expect(out).toContain('"asd": "{{r:uuid}}"');
  });

  it('quotes i:/e:/r:/c: by type with valueContext for all shapes', () => {
    const ctx = {
      inputs: {
        str: 'hello',
        num: 10,
        flag: true,
        empty: null,
      },
      env: {
        host: 'localhost',
        port: 8080,
        ok: false,
      },
    };
    // Compact / wrongly spaced source — beautify + ctx should fix quoting.
    const src =
        '{"str":{{i:str}},"num":"{{i:num}}","flag":"{{i:flag}}","empty":"{{i:empty}}",' +
        '"host":{{e:host}},"port":"{{e:port}}","ok":"{{e:ok}}",' +
        '"id":{{r:uuid}},"n":"{{r:int}}","b":"{{r:bool}}",' +
        '"date":{{c:date}},"epoch":"{{c:epoch_ms}}"}';
    const out = beautify('json', src, ctx);
    expect(out).toContain('"str": "{{i:str}}"');
    expect(out).toContain('"num": {{i:num}}');
    expect(out).not.toContain('"num": "{{i:num}}"');
    expect(out).toContain('"flag": {{i:flag}}');
    expect(out).not.toContain('"flag": "{{i:flag}}"');
    expect(out).toContain('"empty": {{i:empty}}');
    expect(out).toContain('"host": "{{e:host}}"');
    expect(out).toContain('"port": {{e:port}}');
    expect(out).not.toContain('"port": "{{e:port}}"');
    expect(out).toContain('"ok": {{e:ok}}');
    expect(out).toContain('"id": "{{r:uuid}}"');
    expect(out).toContain('"n": {{r:int}}');
    expect(out).not.toContain('"n": "{{r:int}}"');
    expect(out).toContain('"b": {{r:bool}}');
    expect(out).toContain('"date": "{{c:date}}"');
    expect(out).toContain('"epoch": {{c:epoch_ms}}');
  });
});

describe('bodyEditTokenTemplate quotes by input/env types', () => {
  it('covers string, number, bool, null, r:, and c: leaves', () => {
    const source = {
      name: 'i:xxx',
      ssd: 'i:yy',
      dd: 'i:dd',
      z: 'i:z',
      host: 'e:host',
      port: 'e:port',
      asd: 'r:uuid',
      n: 'r:int',
      flag: 'r:bool',
      when: 'c:date',
      epoch: 'c:epoch_ms',
      message: 'Hello from mmt!',
    };
    const resolved = {
      name: 'ss',
      ssd: 10,
      dd: true,
      z: null,
      host: 'h',
      port: 443,
      asd: '550e8400-e29b-41d4-a716-446655440000',
      n: 7,
      flag: false,
      when: '2020-01-01',
      epoch: 1,
      message: 'Hello from mmt!',
    };
    const template = bodyEditTokenTemplate(
        source,
        'json',
        {
          inputs: {xxx: 'ss', yy: 10, dd: true, z: null},
          env: {host: 'h', port: 443},
        },
        resolved,
    );
    expect(template).toContain('"name": "{{i:xxx}}"');
    expect(template).toContain('"ssd": {{i:yy}}');
    expect(template).not.toContain('"ssd": "{{i:yy}}"');
    expect(template).toContain('"dd": {{i:dd}}');
    expect(template).toContain('"z": {{i:z}}');
    expect(template).toContain('"host": "{{e:host}}"');
    expect(template).toContain('"port": {{e:port}}');
    expect(template).toContain('"asd": "{{r:uuid}}"');
    expect(template).toContain('"n": {{r:int}}');
    expect(template).toContain('"flag": {{r:bool}}');
    expect(template).toContain('"when": "{{c:date}}"');
    expect(template).toContain('"epoch": {{c:epoch_ms}}');
    expect(template).toContain('"message": "Hello from mmt!"');
  });

  it('quotes e: from the env type when the leaf is still the token', () => {
    const source = {xx: 'e:xx', host: 'e:host'};
    const template = bodyEditTokenTemplate(
        source,
        'json',
        {env: {xx: 20, host: 'localhost'}},
        source,
    );
    expect(template).toContain('"xx": {{e:xx}}');
    expect(template).not.toContain('"xx": "{{e:xx}}"');
    expect(template).toContain('"host": "{{e:host}}"');
  });

  it('round-trips quoted token text to a YAML literal', () => {
    const source = {
      name: 'i:username',
      quoted: wrapLiteralToken('i:username'),
      missing: wrapLiteralToken('i:xxx'),
    };
    const text = bodyEditTokenTemplate(source, 'json');
    expect(text).toContain('"name": "{{i:username}}"');
    expect(text).toContain('"quoted": "i:username"');
    expect(text).not.toContain('"quoted": "{{i:username}}"');
    expect(text).toContain('"missing": "i:xxx"');
    expect(bodyForYamlSave(source, text, 'json')).toEqual(source);

    const xmlSource = {id: wrapLiteralToken('i:xxx')};
    const xml = bodyEditTokenTemplate(xmlSource, 'xml');
    expect(xml).toContain('<id>i:xxx</id>');
    expect(xml).not.toContain('>{{i:xxx}}<');
  });
});

describe('bodyForSend converts display tokens for the runner', () => {
  it('rewrites {{r:…}} to <<r:…>> in free-form strings', () => {
    expect(bodyForSend(
        '{"id":"{{r:uuid}}","n":{{r:int}}}',
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
      value: '{\n  "id": "{{r:uuid}}",\n  "n": {{r:int(5)}}\n}',
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

describe('xml scalar yaml policy', () => {
  const yaml = [
    'type: api',
    'url: https://example.com',
    'method: post',
    'format: xml',
    'body:',
    '  user:',
    '    id: "<<i:username>>"',
    '    name: i:username',
    '    str: "i:username"',
    '    n: 100',
    '    ok: true',
    '    off: false',
    '    z: null',
    '    qn: "112"',
    '    qflag: "true"',
    '    blank: ""',
    '    empty: {}',
    '    list:',
    '      - 1',
    '      - 2',
    '    note: omit',
    '    keep: "omit"',
  ].join('\n');

  it('types leaves, keeps quoted tokens, and drops omit', () => {
    const api = yamlToAPI(yaml);
    const ui = bodyEditTokenTemplate(api.body, 'xml');
    expect(ui).toContain('<id>{{i:username}}</id>');
    expect(ui).toContain('<name>{{i:username}}</name>');
    expect(ui).toContain('<str>i:username</str>');
    expect(ui).toContain('<n>100</n>');
    expect(ui).toContain('<ok>true</ok>');
    expect(ui).toContain('<off>false</off>');
    expect(ui).toContain('<z>null</z>');
    expect(ui).toContain('<qn>112</qn>');
    expect(ui).toContain('<qflag>true</qflag>');
    expect(ui).toContain('<blank></blank>');
    expect(ui).toContain('<empty/>');
    expect(ui).toContain('<list>1</list>');
    expect(ui).toContain('<list>2</list>');
    expect(ui).toContain('<keep>omit</keep>');
    expect(ui).not.toContain('note');
    expect(ui).not.toContain('__MMT_OMIT__');

    const saved = bodyForYamlSave(api.body, ui, 'xml') as Record<string, any>;
    expect(saved.user.id).toBe('i:username');
    expect(isLiteralTokenValue(saved.user.id)).toBe(false);
    expect(saved.user.name).toBe('i:username');
    expect(isLiteralTokenValue(saved.user.str)).toBe(true);
    expect(unwrapLiteralToken(saved.user.str)).toBe('i:username');
    expect(saved.user.n).toBe(100);
    expect(saved.user.ok).toBe(true);
    expect(saved.user.off).toBe(false);
    expect(saved.user.z).toBeNull();
    expect(saved.user.qn).toBe(112);
    expect(saved.user.qflag).toBe(true);
    expect(saved.user.blank).toBe('');
    expect(saved.user.empty).toEqual({});
    expect(saved.user.list).toEqual([1, 2]);
    expect(saved.user.keep).toBeUndefined();
    expect(saved.user.note).toBeUndefined();

    const again = apiToYaml({...api, body: saved}, yaml);
    expect(again).not.toMatch(/note:/);
    expect(again).toMatch(/\bn: 100\b/);
    expect(again).toMatch(/qn: 112/);
    // Same live token: keep the authored "<<i:username>>" spelling.
    expect(again).toContain('id: "<<i:username>>"');
    expect((yamlToAPI(again).body as {user: {id: string}}).user.id).toBe('i:username');
  });

  it('expanded xml uses the same leaf rules and keeps empty objects', () => {
    const source = {
      user: {
        id: 'i:username',
        n: 100,
        blank: '',
        empty: {},
        note: '__MMT_OMIT__',
      },
    };
    const ui = bodyEditTokenTemplate(source, 'xmle');
    expect(ui).toContain('<id>{{i:username}}</id>');
    expect(ui).toContain('<n>100</n>');
    expect(ui).toContain('<blank>""</blank>');
    expect(ui).toContain('<empty></empty>');
    expect(ui).not.toContain('note');
    expect(ui).not.toContain('__MMT_OMIT__');
    expect(bodyForYamlSave(source, ui, 'xmle')).toEqual({
      user: {id: 'i:username', n: 100, blank: '', empty: {}},
    });
  });

  it('sends xml without editor quotes', () => {
    const wire = formatBody('xml', {n: 100, qn: '112', ok: true}, false);
    expect(wire).toContain('<n>100</n>');
    expect(wire).toContain('<qn>112</qn>');
    expect(wire).toContain('<ok>true</ok>');
    expect(wire).not.toContain('"112"');
  });

  it('parses sibling elements back into the object', () => {
    const source = {n: 100, name: 'ada', note: '__MMT_OMIT__'};
    const ui = bodyEditTokenTemplate(source, 'xml');
    expect(ui).toContain('<n>100</n>');
    expect(ui).toContain('<name>ada</name>');
    expect(ui).not.toContain('<note');
    expect(bodyForYamlSave(source, ui, 'xml')).toEqual({n: 100, name: 'ada'});

    const expanded = bodyEditTokenTemplate(source, 'xmle');
    expect(bodyForYamlSave(source, expanded, 'xmle')).toEqual({
      n: 100,
      name: 'ada',
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

describe('json editor tokens', () => {
  it('shows bracket forms and saves them as live tokens', () => {
    const yaml = [
      'type: api',
      'url: https://example.com',
      'method: post',
      'format: json',
      'body:',
      '  angled: "<<i:username>>"',
      '  curly: "{{i:username}}"',
      '  str: "i:username"',
      '  name: i:username',
      '  n: 100',
      '  ok: true',
    ].join('\n');
    const api = yamlToAPI(yaml);
    const ui = bodyEditTokenTemplate(api.body, 'json');
    expect(ui).toContain('"angled": "{{i:username}}"');
    expect(ui).toContain('"curly": "{{i:username}}"');
    expect(ui).toContain('"str": "i:username"');
    expect(ui).toContain('"name": "{{i:username}}"');
    expect(ui).toContain('"n": 100');
    expect(ui).toContain('"ok": true');

    const saved = bodyForYamlSave(api.body, ui, 'json') as Record<string, unknown>;
    expect(saved.angled).toBe('i:username');
    expect(saved.curly).toBe('i:username');
    expect(saved.name).toBe('i:username');
    expect(saved.n).toBe(100);
    expect(saved.ok).toBe(true);
    expect(isLiteralTokenValue(saved.str)).toBe(true);
    expect(unwrapLiteralToken(String(saved.str))).toBe('i:username');

    const again = apiToYaml({...api, body: saved}, yaml);
    // Unchanged live tokens keep the spelling already in the file.
    expect(again).toContain('angled: "<<i:username>>"');
    expect(again).toContain('curly: "{{i:username}}"');
    expect(again).toMatch(/str: "i:username"/);
    expect(again).toMatch(/name: i:username\b/);
    const round = yamlToAPI(again).body as Record<string, unknown>;
    expect(round.angled).toBe('i:username');
    expect(round.curly).toBe('i:username');
    expect(again).toMatch(/\bn: 100\b/);
    expect(again).toMatch(/\bok: true\b/);
  });

  it('shows omit as the keyword and keeps quoted omit as text', () => {
    const source = {note: '__MMT_OMIT__', keep: 'omit', n: 100};
    const ui = bodyEditTokenTemplate(source, 'json');
    expect(ui).toContain('"note": omit');
    expect(ui).toContain('"keep": "omit"');
    expect(ui).not.toContain('__MMT_OMIT__');
    const saved = bodyForYamlSave(source, ui, 'json') as Record<string, unknown>;
    expect(saved.note).toBe('__MMT_OMIT__');
    expect(saved.keep).toBe('omit');
    expect(saved.n).toBe(100);

    const parts = bodyEditTokenTemplate(source, 'multipart');
    expect(parts).toContain('"note": omit');
    expect(parts).not.toContain('__MMT_OMIT__');
    expect(bodyForYamlSave(source, parts, 'multipart')).toEqual(source);
  });
});

describe('urlencoded scalar yaml policy', () => {
  it('stores numbers, bools, and null like inputs', () => {
    const source = {
      n: 100,
      ok: true,
      off: false,
      z: null,
      name: 'ada',
      qn: '112',
      qflag: 'true',
      blank: '',
    };
    const shown = displayRequestBody(source, 'urlencoded');
    expect(shown).toBe(
        'n=100&ok=true&off=false&z=null&name=ada&qn=112&qflag=true&blank=',
    );
  });

  it('coerces form text on save', () => {
    expect(bodyForYamlSave(
        {n: 'x'},
        'n=100&ok=true&off=false&z=null&qn="112"&qflag="true"&blank=',
        'urlencoded',
    )).toEqual({
      n: 100,
      ok: true,
      off: false,
      z: null,
      qn: '112',
      qflag: 'true',
      blank: '',
    });
  });

  it('keeps the wire form empty for null', () => {
    expect(formatBody('urlencoded', {count: 3, enabled: true, empty: null}, false))
        .toBe('count=3&enabled=true&empty=');
  });

  it('keeps a nested value as one field without internal markers', () => {
    const source = {
      nested: {
        a: 1,
        note: '__MMT_OMIT__',
        id: wrapLiteralToken('<<c:city>>'),
      },
      list: [1, 2],
    };
    const shown = displayRequestBody(source, 'urlencoded');
    expect(shown).not.toContain('__MMT_');
    expect(shown).toContain('omit');
    const saved = bodyForYamlSave(source, shown, 'urlencoded') as Record<string, unknown>;
    expect(typeof saved.nested).toBe('string');
    expect(saved.nested).not.toContain('__MMT_');
    expect(String(saved.nested)).toContain('omit');
    expect(typeof saved.list).toBe('string');
  });
});

describe('text html and none structured bodies', () => {
  it('edits an object as JSON and saves the object back', () => {
    const source = {
      name: 'i:username',
      note: '__MMT_OMIT__',
      keep: 'omit',
      n: 100,
    };
    for (const format of ['text', 'html', 'none'] as const) {
      const ui = bodyEditTokenTemplate(source, format);
      expect(ui).toContain('"note": omit');
      expect(ui).toContain('"keep": "omit"');
      expect(ui).not.toContain('__MMT_OMIT__');
      expect(ui).not.toContain('<<i:username>>');
      const saved = bodyForYamlSave(source, ui, format) as Record<string, unknown>;
      expect(saved.name).toBe('i:username');
      expect(saved.note).toBe('__MMT_OMIT__');
      expect(saved.keep).toBe('omit');
      expect(saved.n).toBe(100);
    }
  });

  it('keeps raw text as text', () => {
    expect(bodyForYamlSave('hello {{i:username}}', 'hello {{i:username}}', 'text'))
        .toBe('hello <<i:username>>');
  });
});

describe('saveEditorBody', () => {
  it('keeps a structured body while JSON is unfinished', () => {
    const source = {note: '__MMT_OMIT__', n: 100};
    expect(saveEditorBody(source, '{', 'json')).toBe(source);
    const ui = bodyEditTokenTemplate(source, 'json');
    expect(ui).toContain('"note": omit');
    expect(saveEditorBody(source, ui, 'json')).toEqual(source);
  });

  it('saves a finished text replacement', () => {
    expect(saveEditorBody({n: 1}, 'hello {{i:username}}', 'text'))
        .toBe('hello <<i:username>>');
  });
});
