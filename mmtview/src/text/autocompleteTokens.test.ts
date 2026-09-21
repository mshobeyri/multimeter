import {
  formatTokenInsertText,
  matchTokenCompletion,
  needsBraceTokenForm,
} from './autocompleteTokens';

describe('matchTokenCompletion', () => {
  it('matches <<i: after a value', () => {
    expect(matchTokenCompletion('url: <<i:us')).toEqual({
      prefix: 'i',
      typed: 'us',
      replaceFrom: 'url: <<'.length,
    });
  });

  it('matches a bare i: token after a space', () => {
    expect(matchTokenCompletion('url: i:user')).toEqual({
      prefix: 'i',
      typed: 'user',
      replaceFrom: 'url: '.length,
    });
  });

  it('matches a bare i: token after a slash in a URL path', () => {
    expect(matchTokenCompletion('url: https://test.mmt.dev/status/i:st')).toEqual({
      prefix: 'i',
      typed: 'st',
      replaceFrom: 'url: https://test.mmt.dev/status/'.length,
    });
  });

  it('matches << with no prefix yet', () => {
    expect(matchTokenCompletion('body: <<')).toEqual({
      prefix: null,
      typed: '',
      replaceFrom: 'body: <<'.length,
    });
  });

  it('matches <<o: after a value', () => {
    expect(matchTokenCompletion('print: <<o:tok')).toEqual({
      prefix: 'o',
      typed: 'tok',
      replaceFrom: 'print: <<'.length,
    });
  });

  it('matches a bare o: token after a space', () => {
    expect(matchTokenCompletion('x: o:token')).toEqual({
      prefix: 'o',
      typed: 'token',
      replaceFrom: 'x: '.length,
    });
  });

  it('does not match a normal word', () => {
    expect(matchTokenCompletion('title: Hello')).toBeNull();
  });
});

describe('needsBraceTokenForm', () => {
  it('requires braces when the token is embedded in a URL path', () => {
    const line = 'url: https://test.mmt.dev/status/i:st';
    const match = matchTokenCompletion(line)!;
    expect(needsBraceTokenForm(line, match.replaceFrom)).toBe(true);
  });

  it('allows bare tokens for whole-value fields', () => {
    const line = '  username: i:us';
    const match = matchTokenCompletion(line)!;
    expect(needsBraceTokenForm(line, match.replaceFrom)).toBe(false);
  });
});

describe('formatTokenInsertText', () => {
  it('wraps input tokens in URL paths', () => {
    const line = 'url: https://test.mmt.dev/status/i:st';
    const match = matchTokenCompletion(line)!;
    expect(formatTokenInsertText('i', 'status', line, match)).toBe('<<i:status>>');
  });

  it('completes tokens already opened with <<', () => {
    const line = 'url: https://test.mmt.dev/status/<<i:st';
    const match = matchTokenCompletion(line)!;
    expect(formatTokenInsertText('i', 'status', line, match)).toBe('i:status>>');
  });

  it('keeps bare tokens for whole-value fields', () => {
    const line = '  username: i:us';
    const match = matchTokenCompletion(line)!;
    expect(formatTokenInsertText('i', 'username', line, match)).toBe('i:username');
  });
});
