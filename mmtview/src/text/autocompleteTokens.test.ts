import {matchTokenCompletion} from './autocompleteTokens';

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
