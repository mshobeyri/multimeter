import {
  collectTokenHighlightMatches,
  INLINE_ANGLE_TOKEN_HIGHLIGHT_RE,
  isHighlightableToken,
} from './tokenHighlightPatterns';

describe('tokenHighlightPatterns', () => {
  it('highlights parameterized random tokens in angle brackets', () => {
    const text = 'value: <<r:int(10,20)>>';
    expect(collectTokenHighlightMatches(text)).toContain('r:int(10,20)');
  });

  it('highlights parameterized current tokens in angle brackets', () => {
    const text = 'value: <<c:date(+1d)>>';
    expect(collectTokenHighlightMatches(text)).toContain('c:date(+1d)');
  });

  it('highlights current tokens with any parentheses content', () => {
    const text = 'value: <<c:date(not-a-strict-offset)>>';
    expect(collectTokenHighlightMatches(text)).toContain('c:date(not-a-strict-offset)');
  });

  it('highlights any well-formed r:/c: name (unknown names warn separately)', () => {
    const text = [
      'bad_r: r:not_a_real_token',
      'bad_c: c:nope',
      'angled: <<r:garbage>>',
    ].join('\n');
    const matches = collectTokenHighlightMatches(text);
    expect(matches).toContain('r:not_a_real_token');
    expect(matches).toContain('c:nope');
    expect(matches).toContain('r:garbage');
  });

  it('does not highlight arbitrary letter prefixes', () => {
    const text = [
      'a: d:something',
      'b: q:asss',
      'c: x:foo',
      'angled: <<d:nope>>',
    ].join('\n');
    const matches = collectTokenHighlightMatches(text);
    expect(matches).toEqual([]);
  });

  it('does not highlight a bare token mixed with other text', () => {
    const text = [
      'note: hello i:username',
      'auth: Bearer r:uuid',
      'quoted: "i:username"',
      'body: |-',
      '  user: i:username',
      'keep: i:username',
    ].join('\n');
    const matches = collectTokenHighlightMatches(text);
    expect(matches).toEqual(['i:username']);
  });

  it('still highlights known tokens and e:/i: forms', () => {
    const text = [
      'id: r:uuid',
      'when: c:epoch_ms',
      'url: e:api_url',
      'user: i:username',
    ].join('\n');
    const matches = collectTokenHighlightMatches(text);
    expect(matches).toEqual(expect.arrayContaining([
      'r:uuid',
      'c:epoch_ms',
      'e:api_url',
      'i:username',
    ]));
  });

  it('does not highlight single-angle or brace env spellings', () => {
    const text = [
      'token: e:{MY_TOKEN}',
      'url: <e:HOST>',
    ].join('\n');
    const matches = collectTokenHighlightMatches(text);
    expect(matches).not.toContain('e:{MY_TOKEN}');
    expect(matches).not.toContain('e:HOST');
    expect(matches).not.toContain('<e:HOST>');
  });

  it('highlights plain parameterized random tokens after colon-space', () => {
    const text = 'count: r:int(1,5)';
    expect(collectTokenHighlightMatches(text)).toContain('r:int(1,5)');
  });

  it('matches the full inline token span for parameterized random tokens', () => {
    const text = '<<r:int(10,20)>>';
    INLINE_ANGLE_TOKEN_HIGHLIGHT_RE.lastIndex = 0;
    const match = INLINE_ANGLE_TOKEN_HIGHLIGHT_RE.exec(text);
    expect(match?.[0]).toBe('<<r:int(10,20)>>');
    expect(match?.[1]).toBe('r:int(10,20)');
  });

  it('isHighlightableToken accepts any r:/c: shape like i:/e:', () => {
    expect(isHighlightableToken('r:uuid')).toBe(true);
    expect(isHighlightableToken('r:uuid(anything)')).toBe(true);
    expect(isHighlightableToken('r:nope')).toBe(true);
    expect(isHighlightableToken('c:date(+1d)')).toBe(true);
    expect(isHighlightableToken('c:date_future')).toBe(true);
    expect(isHighlightableToken('e:anything')).toBe(true);
    expect(isHighlightableToken('d:something')).toBe(false);
    expect(isHighlightableToken('q:asss')).toBe(false);
  });
});
