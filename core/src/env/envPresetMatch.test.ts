import {
  derivePresetSelections,
  findMatchingPresetOption,
  presetMappingMatchesVars,
  variableMatchesPresetDesired,
} from './envPresetMatch';

describe('envPresetMatch', () => {
  const vars = [
    {
      name: 'base_url',
      label: 'dev',
      value: 'https://dev.example',
      options: [
        {label: 'dev', value: 'https://dev.example'},
        {label: 'prod', value: 'https://prod.example'},
      ],
    },
    {
      name: 'token',
      label: 'dev',
      value: 'dev-token',
      options: [
        {label: 'dev', value: 'dev-token'},
        {label: 'prod', value: 'prod-token'},
      ],
    },
  ];

  const presets = {
    Environment: {
      Development: {base_url: 'dev', token: 'dev'},
      Production: {base_url: 'prod', token: 'prod'},
    },
  };

  it('matches a variable against preset desired label or value', () => {
    expect(variableMatchesPresetDesired(vars[0], 'dev')).toBe(true);
    expect(variableMatchesPresetDesired(vars[0], 'https://dev.example')).toBe(true);
    expect(variableMatchesPresetDesired(vars[0], 'prod')).toBe(false);
  });

  it('requires every mapped variable to match', () => {
    expect(presetMappingMatchesVars(vars, {base_url: 'dev', token: 'dev'})).toBe(true);
    expect(presetMappingMatchesVars(vars, {base_url: 'dev', token: 'prod'})).toBe(false);
    expect(presetMappingMatchesVars(vars, {base_url: 'dev', missing: 'x'})).toBe(false);
    expect(presetMappingMatchesVars(vars, {})).toBe(false);
  });

  it('ignores variables that are not part of the preset mapping', () => {
    const withExtra = [
      ...vars,
      {name: 'extra', label: 'Manual', value: 'x', options: []},
    ];
    expect(presetMappingMatchesVars(withExtra, {base_url: 'dev', token: 'dev'})).toBe(true);
  });

  it('finds the matching preset option from current vars', () => {
    expect(findMatchingPresetOption(vars, presets.Environment)).toBe('Development');

    const prodVars = vars.map((v) =>
      v.name === 'base_url' ?
          {...v, label: 'prod', value: 'https://prod.example'} :
          {...v, label: 'prod', value: 'prod-token'});
    expect(findMatchingPresetOption(prodVars, presets.Environment)).toBe('Production');
  });

  it('clears the match when one variable is changed manually', () => {
    const tweaked = [
      vars[0],
      {...vars[1], label: 'Manual', value: 'custom-token', options: vars[1].options},
    ];
    expect(findMatchingPresetOption(tweaked, presets.Environment)).toBeUndefined();
  });

  it('reselects the preset when variables are restored to match', () => {
    const tweaked = [
      vars[0],
      {...vars[1], label: 'Manual', value: 'custom-token'},
    ];
    expect(derivePresetSelections(tweaked, presets)).toEqual({});

    const restored = [
      vars[0],
      {...vars[1], label: 'dev', value: 'dev-token'},
    ];
    expect(derivePresetSelections(restored, presets)).toEqual({
      Environment: 'Development',
    });
  });

  it('prefers the option with more mapped keys when several match', () => {
    const group = {
      Partial: {base_url: 'dev'},
      Full: {base_url: 'dev', token: 'dev'},
    };
    expect(findMatchingPresetOption(vars, group)).toBe('Full');
  });

  it('derives selections for each preset group independently', () => {
    const multi = {
      Environment: presets.Environment,
      Region: {
        EU: {base_url: 'dev'},
        US: {base_url: 'prod'},
      },
    };
    expect(derivePresetSelections(vars, multi)).toEqual({
      Environment: 'Development',
      Region: 'EU',
    });
  });
});
