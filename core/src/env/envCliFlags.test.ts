import {buildSmartEnvCliFlags, formatCliEnvValue, shellQuoteIfNeeded} from './envCliFlags';

describe('envCliFlags', () => {
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
    runner: {
      dev: {base_url: 'dev', token: 'dev'},
      prod: {base_url: 'prod', token: 'prod'},
    },
  };

  it('quotes shell-sensitive and coerce-ambiguous strings', () => {
    expect(shellQuoteIfNeeded('multimeter.mmt')).toBe('multimeter.mmt');
    expect(shellQuoteIfNeeded('env file.mmt')).toBe("'env file.mmt'");
    expect(formatCliEnvValue(true)).toBe('true');
    expect(formatCliEnvValue(42)).toBe('42');
    expect(formatCliEnvValue(null)).toBe('null');
    expect(formatCliEnvValue('hello')).toBe('hello');
    expect(formatCliEnvValue('00123')).toBe("'00123'");
    expect(formatCliEnvValue('true')).toBe("'true'");
    expect(formatCliEnvValue('a b')).toBe("'a b'");
  });

  it('emits -F and -P when presets match, omitting covered -e keys', () => {
    expect(buildSmartEnvCliFlags({
      envFile: 'multimeter.mmt',
      variables: vars,
      presets,
    })).toBe('-F multimeter.mmt -P runner.dev');
  });

  it('adds -e only for vars not covered by matching presets', () => {
    const withExtra = [
      ...vars,
      {name: 'debug', label: 'Manual', value: true, options: []},
      {name: 'user', label: 'Manual', value: 'alice', options: []},
    ];
    expect(buildSmartEnvCliFlags({
      envFile: 'multimeter.mmt',
      variables: withExtra,
      presets,
    })).toBe('-F multimeter.mmt -P runner.dev -e debug=true -e user=alice');
  });

  it('falls back to -e only when no preset matches', () => {
    const tweaked = [
      vars[0],
      {...vars[1], label: 'Manual', value: 'custom', options: vars[1].options},
    ];
    expect(buildSmartEnvCliFlags({
      envFile: 'multimeter.mmt',
      variables: tweaked,
      presets,
    })).toBe('-e base_url=https://dev.example -e token=custom');
  });

  it('emits only -e when env file is missing', () => {
    expect(buildSmartEnvCliFlags({
      variables: vars,
      presets,
    })).toBe('-e base_url=https://dev.example -e token=dev-token');
  });

  it('supports multiple matching preset groups', () => {
    const multi = {
      runner: presets.runner,
      region: {
        eu: {base_url: 'dev'},
        us: {base_url: 'prod'},
      },
    };
    expect(buildSmartEnvCliFlags({
      envFile: 'env.mmt',
      variables: vars,
      presets: multi,
    })).toBe('-F env.mmt -P region.eu -P runner.dev');
  });

  it('returns empty string when there is nothing to copy', () => {
    expect(buildSmartEnvCliFlags({
      envFile: 'multimeter.mmt',
      variables: [],
      presets,
    })).toBe('');
  });
});
