import {yamlToAPIStrict} from './apiParsePack';
import {
  isImportAutocompletePath,
  processDataImportsInYaml,
  processDataImportsInYamlSync,
} from './dataImportProcessor';
import {setFileLoader} from './JSerFileLoader';
import {rootTestToJsfunc} from './JSerTest';
import parseYaml from './markupConvertor';
import * as runConfig from './runConfig';
import {yamlToSuite} from './suiteParsePack';
import {yamlToTestStrict} from './testParsePack';

const createLoader = (files: Record<string, string>) =>
  async (path: string): Promise<string> => {
    const normalized = path.replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(files, normalized)) {
      return files[normalized];
    }
    throw new Error(`Missing file: ${normalized}`);
  };

describe('import autocomplete paths', () => {
  it('recognizes data and import file extensions', () => {
    expect(isImportAutocompletePath('data/file.json')).toBe(true);
    expect(isImportAutocompletePath('data/file.yaml')).toBe(true);
    expect(isImportAutocompletePath('data/file.yml')).toBe(true);
    expect(isImportAutocompletePath('data/file.csv')).toBe(true);
    expect(isImportAutocompletePath('tests/login.mmt')).toBe(true);
    expect(isImportAutocompletePath('helpers/auth.js')).toBe(true);
    expect(isImportAutocompletePath('readme.md')).toBe(false);
  });
});

describe('data file imports', () => {
  it('supports synchronous data import processing for extension env parsing', () => {
    const processed = processDataImportsInYamlSync({
      rawText: [
        'type: env',
        'import:',
        '  cfg: config.json',
        'setting:',
        '  http:',
        '    timeout: ${cfg.timeout}',
      ].join('\n'),
      filePath: '/root/multimeter.mmt',
      fileLoader: (p: string) => {
        if (p === '/root/config.json') {
          return '{"timeout":45000}';
        }
        throw new Error(`Missing file: ${p}`);
      },
    });

    expect(parseYaml(processed).setting.http.timeout).toBe(45000);
  });

  it('replaces nested JSON import references in API body fields', async () => {
    const rawText = [
      'type: api',
      'import:',
      '  xxx: xx.json',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'body:',
      '  message: i:message',
      '  also: ${xxx.xxx}',
    ].join('\n');

    const processed = await processDataImportsInYaml({
      rawText,
      filePath: '/root/apis/echo.mmt',
      fileLoader: createLoader({
        '/root/apis/xx.json': '{"xxx":"yyy"}',
      }),
    });

    const api = yamlToAPIStrict(processed);
    expect(api.body).toEqual({message: 'i:message', also: 'yyy'});
  });

  it('replaces JSON import references in API files and removes data import entries', async () => {
    const rawText = [
      'type: api',
      'import:',
      '  zzz: data/file.json',
      'url: http://example.com/${zzz.endpoint}',
      'method: post',
      'body: ${zzz.payload}',
    ].join('\n');

    const processed = await processDataImportsInYaml({
      rawText,
      filePath: '/root/apis/request.mmt',
      fileLoader: createLoader({
        '/root/apis/data/file.json': JSON.stringify({
          endpoint: 'users',
          payload: {name: 'alice', active: true},
        }),
      }),
    });

    const doc = parseYaml(processed);
    expect(doc.import).toBeUndefined();
    expect(doc.body).toEqual({name: 'alice', active: true});
    const api = yamlToAPIStrict(processed);
    expect(api.url).toBe('http://example.com/users');
    expect(api.body).toEqual({name: 'alice', active: true});
  });

  it('replaces YAML import references in test files while preserving runtime data imports', async () => {
    const rawText = [
      'type: test',
      'import:',
      '  fixtures: fixtures.yaml',
      'inputs:',
      '  name: ${fixtures.user.name}',
      'steps:',
      '  - print: ${fixtures.user.name}',
    ].join('\n');

    const processed = await processDataImportsInYaml({
      rawText,
      filePath: '/root/tests/main.mmt',
      fileLoader: createLoader({
        '/root/tests/fixtures.yaml': [
          'user:',
          '  name: alice',
        ].join('\n'),
      }),
      keepDataImports: true,
    });

    const test = yamlToTestStrict(processed);
    expect(test.import).toEqual({fixtures: 'fixtures.yaml'});
    expect(test.inputs).toEqual({name: 'alice'});
    expect(test.steps?.[0]).toEqual({print: 'alice'});
  });

  it('replaces YML import references in suite environment variables', async () => {
    const rawText = [
      'type: suite',
      'import:',
      '  config: config.yml',
      'environment:',
      '  variables:',
      '    region: ${config.region}',
      'tests:',
      '  - smoke.mmt',
    ].join('\n');

    const processed = await processDataImportsInYaml({
      rawText,
      filePath: '/root/suite.mmt',
      fileLoader: createLoader({
        '/root/config.yml': 'region: eu',
      }),
    });

    const suite = yamlToSuite(processed);
    expect(suite.environment?.variables).toEqual({region: 'eu'});
  });

  it('replaces CSV import references in env files and preserves array/object values', async () => {
    const rawText = [
      'type: env',
      'import:',
      '  users: users.csv',
      'variables:',
      '  firstName: ${users[0].name}',
      '  firstRow: ${users[0]}',
      '  allUsers: ${users}',
    ].join('\n');

    const processed = await processDataImportsInYaml({
      rawText,
      filePath: '/root/multimeter.mmt',
      fileLoader: createLoader({
        '/root/users.csv': 'name,age,active\nalice,30,true\nbob,25,false\n',
      }),
    });

    const env = parseYaml(processed);
    expect(env.import).toBeUndefined();
    expect(env.variables.firstName).toBe('alice');
    expect(env.variables.firstRow).toEqual({name: 'alice', age: 30, active: true});
    expect(env.variables.allUsers).toEqual([
      {name: 'alice', age: 30, active: true},
      {name: 'bob', age: 25, active: false},
    ]);
  });

  it('resolves project-root data imports', async () => {
    const processed = await processDataImportsInYaml({
      rawText: [
        'type: api',
        'import:',
        '  cfg: +/data/config.json',
        'url: ${cfg.url}',
      ].join('\n'),
      filePath: '/root/apis/request.mmt',
      projectRoot: '/root',
      fileLoader: createLoader({
        '/root/data/config.json': '{"url":"http://example.com"}',
      }),
    });

    expect(yamlToAPIStrict(processed).url).toBe('http://example.com');
  });

  it('leaves missing references unchanged', async () => {
    const processed = await processDataImportsInYaml({
      rawText: [
        'type: api',
        'import:',
        '  cfg: config.json',
        'url: ${cfg.missing}',
      ].join('\n'),
      filePath: '/root/request.mmt',
      fileLoader: createLoader({
        '/root/config.json': '{"url":"http://example.com"}',
      }),
    });

    expect(yamlToAPIStrict(processed).url).toBe('${cfg.missing}');
  });

  it('supports env presets after env files are processed', async () => {
    const processed = await processDataImportsInYaml({
      rawText: [
        'type: env',
        'import:',
        '  cfg: config.json',
        'variables:',
        '  host:',
        '    dev: ${cfg.host}',
        'presets:',
        '  runner:',
        '    dev:',
        '      host: dev',
      ].join('\n'),
      filePath: '/root/multimeter.mmt',
      fileLoader: createLoader({
        '/root/config.json': '{"host":"http://dev.example.com"}',
      }),
    });

    const doc = parseYaml(processed);
    expect(runConfig.resolvePresetEnv(doc, 'runner.dev'))
        .toEqual({host: 'http://dev.example.com'});
  });

  it('processes data imports inside imported API files', async () => {
    setFileLoader(createLoader({
      '/root/api/user.mmt': [
        'type: api',
        'import:',
        '  cfg: config.json',
        'url: ${cfg.url}',
      ].join('\n'),
      '/root/api/config.json': '{"url":"http://example.com/user"}',
    }));

    const js = await rootTestToJsfunc({
      name: 'main',
      test: {
        type: 'test',
        import: {user: '/root/api/user.mmt'},
        steps: [{call: 'user'} as any],
      } as any,
      inputs: {},
      envVars: {},
      filePath: '/root/main.mmt',
    });

    expect(js).toContain('const __resolvedUrl = `http://example.com/user`;');
  });
});
