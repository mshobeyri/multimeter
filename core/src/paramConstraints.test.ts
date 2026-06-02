import {
  parseBracketConstraintPrefix,
  extractInputConstraintsFromDescription,
  PARAM_CONSTRAINT_PICKER_MAX,
} from './paramConstraints';

describe('parseBracketConstraintPrefix', () => {
  test('parses bare option list', () => {
    expect(parseBracketConstraintPrefix('[mehrdad, sahar] rest')).toEqual([
      { label: 'mehrdad', value: 'mehrdad' },
      { label: 'sahar', value: 'sahar' },
    ]);
  });

  test('parses quoted options', () => {
    expect(parseBracketConstraintPrefix('["xx", "1", "2"] description')).toEqual([
      { label: 'xx', value: 'xx' },
      { label: '1', value: '1' },
      { label: '2', value: '2' },
    ]);
  });

  test('parses unquoted numeric options as numbers', () => {
    expect(parseBracketConstraintPrefix('[1, 2] description')).toEqual([
      { label: '1', value: 1 },
      { label: '2', value: 2 },
    ]);
  });

  test('parses integer range inclusively', () => {
    expect(parseBracketConstraintPrefix('[1-3] pick one')).toEqual([
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
    ]);
  });

  test('returns undefined when range exceeds max picker size', () => {
    const span = PARAM_CONSTRAINT_PICKER_MAX + 1;
    expect(parseBracketConstraintPrefix(`[1-${span}]`)).toBeUndefined();
  });

  test('returns undefined when option list exceeds max picker size', () => {
    const items = Array.from({ length: PARAM_CONSTRAINT_PICKER_MAX + 1 }, (_, i) => String(i)).join(',');
    expect(parseBracketConstraintPrefix(`[${items}]`)).toBeUndefined();
  });

  test('returns undefined without leading bracket', () => {
    expect(parseBracketConstraintPrefix('plain description')).toBeUndefined();
  });

  test('returns undefined for inverted range', () => {
    expect(parseBracketConstraintPrefix('[5-1] bad')).toBeUndefined();
  });
});

describe('extractInputConstraintsFromDescription', () => {
  test('extracts from line-start annotations', () => {
    const desc = `Returns users.
  <<i:name>> [mehrdad, sahar] Display name
  <<i:role>> [admin, editor] Role`;
    expect(extractInputConstraintsFromDescription(desc)).toEqual({
      name: [
        { label: 'mehrdad', value: 'mehrdad' },
        { label: 'sahar', value: 'sahar' },
      ],
      role: [
        { label: 'admin', value: 'admin' },
        { label: 'editor', value: 'editor' },
      ],
    });
  });

  test('extracts inline annotation', () => {
    const desc = 'API <<i:limit>> [1-3] page size';
    expect(extractInputConstraintsFromDescription(desc)).toEqual({
      limit: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
      ],
    });
  });

  test('ignores output annotations', () => {
    const desc = '<<o:status>> [200,404] HTTP status';
    expect(extractInputConstraintsFromDescription(desc)).toEqual({});
  });
});
