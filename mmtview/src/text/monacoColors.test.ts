import { isErrorLikeRed, toMonacoHex } from './monacoColors';

describe('monacoColors', () => {
  it('passes through hex and expands short hex', () => {
    expect(toMonacoHex('#264F78', '#000000')).toBe('#264F78');
    expect(toMonacoHex('#abc', '#000000').toLowerCase()).toBe('#aabbcc');
  });

  it('falls back for empty or unparsable values without DOM conversion', () => {
    expect(toMonacoHex('', '#264F78')).toBe('#264F78');
    expect(toMonacoHex('not-a-color', '#264F78')).toBe('#264F78');
  });

  it('detects error-like reds used for intermittent selection bugs', () => {
    expect(isErrorLikeRed('#ff0000')).toBe(true);
    expect(isErrorLikeRed('#f48771')).toBe(true);
    expect(isErrorLikeRed('#a31515')).toBe(true);
    expect(isErrorLikeRed('#264F78')).toBe(false);
    expect(isErrorLikeRed('#ADD6FF')).toBe(false);
  });
});
