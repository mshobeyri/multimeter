import { displayResponseBody, responseBodyToRawString } from './responseBodyDisplay';

describe('responseBodyDisplay', () => {
  it('serializes objects compactly without pretty-print', () => {
    expect(responseBodyToRawString({ a: 1, b: [2] })).toBe('{"a":1,"b":[2]}');
    expect(responseBodyToRawString('already')).toBe('already');
    expect(responseBodyToRawString(null)).toBe('');
  });

  it('returns raw body when auto-format is off', () => {
    const raw = '{"a":1}';
    expect(displayResponseBody({ body: raw, headers: { 'Content-Type': 'application/json' } } as any, false))
      .toBe(raw);
  });

  it('beautifies JSON on display when auto-format is on', () => {
    const raw = '{"a":1,"b":2}';
    const shown = displayResponseBody(
      { body: raw, headers: { 'Content-Type': 'application/json' } } as any,
      true,
    );
    expect(shown).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('beautifies object bodies from compact JSON when auto-format is on', () => {
    const shown = displayResponseBody(
      { body: { hello: 'world' }, headers: { 'content-type': 'application/json' } } as any,
      true,
    );
    expect(shown).toContain('\n');
    expect(shown).toContain('"hello": "world"');
  });
});
