import {
  collectTokenHighlightMatches,
  INLINE_ANGLE_TOKEN_HIGHLIGHT_RE,
  PLAIN_TOKEN_HIGHLIGHT_RE,
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

  it('highlights env brace tokens including braces', () => {
    const text = 'token: e:{MY_TOKEN}';
    expect(collectTokenHighlightMatches(text)).toContain('e:{MY_TOKEN}');
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

  it('matches plain env brace tokens after colon-space', () => {
    const text = 'Authorization: e:{token}';
    PLAIN_TOKEN_HIGHLIGHT_RE.lastIndex = 0;
    const match = PLAIN_TOKEN_HIGHLIGHT_RE.exec(text);
    expect(match?.[1]).toBe('e:{token}');
  });
});
