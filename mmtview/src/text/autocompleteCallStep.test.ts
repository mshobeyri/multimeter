import {findCallStepBlock} from './autocompleteCallStep';

describe('findCallStepBlock', () => {
  const lines = [
    'type: test',
    'steps:',
    '  - call: login',
    '    inputs:',
    '      user: a',
    '    expect:',
    '      status: == 200',
    '    debug:',
    '      token:',
  ];

  it('finds the call alias under inputs:', () => {
    expect(findCallStepBlock(lines, 5, 6, ['inputs'])).toEqual({
      alias: 'login',
      field: 'inputs',
    });
  });

  it('finds expect and debug blocks', () => {
    expect(findCallStepBlock(lines, 7, 6, ['expect', 'debug'])).toEqual({
      alias: 'login',
      field: 'expect',
    });
    expect(findCallStepBlock(lines, 9, 6, ['expect', 'debug'])).toEqual({
      alias: 'login',
      field: 'debug',
    });
  });

  it('returns null outside a matching block', () => {
    expect(findCallStepBlock(lines, 3, 2, ['inputs'])).toBeNull();
  });
});
