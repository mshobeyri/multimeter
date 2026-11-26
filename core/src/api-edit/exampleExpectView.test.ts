import {
  buildExampleExpect,
  exampleExpectBodyToText,
  parseExampleExpectView,
  snapshotResponseExpect,
  textToExampleExpectBody,
} from './exampleExpectView';

describe('exampleExpectView', () => {
  it('parses OpenAPI-style status + body', () => {
    expect(parseExampleExpectView({
      status: 200,
      body: {id: 1, name: 'Whiskers'},
    })).toEqual({
      status: 200,
      headers: undefined,
      body: {id: 1, name: 'Whiskers'},
      other: {},
    });
  });

  it('treats flattened Postman fields as body when body key is absent', () => {
    expect(parseExampleExpectView({
      status: 201,
      statusCode: 201,
      id: 1,
      name: 'Ada',
    })).toEqual({
      status: 201,
      headers: undefined,
      body: {id: 1, name: 'Ada'},
      other: {},
    });
  });

  it('preserves non-meta operator keys when body is explicit', () => {
    expect(parseExampleExpectView({
      status: 200,
      body: {ok: true},
      'body.token': '!= null',
    })).toEqual({
      status: 200,
      headers: undefined,
      body: {ok: true},
      other: {'body.token': '!= null'},
    });
  });

  it('builds status/headers/body and drops duplicate status aliases', () => {
    expect(buildExampleExpect({
      status: '200',
      headers: {'Content-Type': 'application/json', '': 'skip'},
      body: {ok: true},
      other: {statusCode: 999, 'body.token': '*'},
    })).toEqual({
      status: 200,
      headers: {'Content-Type': 'application/json'},
      body: {ok: true},
      'body.token': '*',
    });
  });

  it('returns undefined when view is empty', () => {
    expect(buildExampleExpect({other: {}})).toBeUndefined();
  });

  it('round-trips body text as JSON object or raw string', () => {
    expect(exampleExpectBodyToText({a: 1})).toBe('{\n  "a": 1\n}');
    expect(textToExampleExpectBody('{"a":1}')).toEqual({a: 1});
    expect(textToExampleExpectBody('not-json')).toBe('not-json');
    expect(textToExampleExpectBody('  ')).toBeUndefined();
  });

  it('snapshots a live response into expect', () => {
    expect(snapshotResponseExpect({
      status: 200,
      headers: {'X-Trace': '1'},
      body: {ok: true},
    })).toEqual({
      status: 200,
      headers: {'X-Trace': '1'},
      body: {ok: true},
    });
  });
});
