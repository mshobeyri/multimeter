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

  it('does not match a normal word', () => {
    expect(matchTokenCompletion('title: Hello')).toBeNull();
  });
});
