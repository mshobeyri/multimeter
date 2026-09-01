import {detectAutocompleteDocType} from './autocompleteDocType';

describe('detectAutocompleteDocType', () => {
  it('reads type from the first line', () => {
    expect(detectAutocompleteDocType('type: test\nsteps:\n')).toBe('test');
  });

  it('skips comments and blank lines', () => {
    expect(detectAutocompleteDocType('# header\n\ntype: api\nurl: /')).toBe('api');
  });

  it('allows quotes and a trailing comment', () => {
    expect(detectAutocompleteDocType('type: "suite" # run many\nitems:\n')).toBe('suite');
  });

  it('returns null when type is missing', () => {
    expect(detectAutocompleteDocType('title: Hello\n')).toBeNull();
  });
});
