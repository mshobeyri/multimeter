import YAML from 'yaml';
import {packYaml} from './markupConvertor';
import {mergeYamlValue} from './yamlAstMerge';
import {apiToYaml, yamlToAPI, yamlToAPIStrict} from './apiParsePack';
import {docToYaml, yamlToDoc} from './docParsePack';
import {envToYaml, yamlToEnv} from './envParsePack';
import {loadtestToYaml, yamlToLoadTest} from './loadtestParsePack';
import {mockToYaml, yamlToMock} from './mockParsePack';
import {suiteToYaml, yamlToSuite} from './suiteParsePack';
import {testToYaml, yamlToTest} from './testParsePack';
import {isOmitSentinel} from './omitKeyword';
import {formatMmtYaml} from './mmtFormat';

function expectMergedEqualsFresh<T>(
    parse: (yaml: string) => T,
    pack: (data: T, original?: string) => string,
    original: string,
    mutate?: (data: T) => void,
): {merged: string; fresh: string; data: T} {
  const data = parse(original);
  mutate?.(data);
  const merged = pack(data, original);
  const fresh = pack(data);
  expect(parse(merged)).toEqual(parse(fresh));
  return {merged, fresh, data};
}

describe('packYaml comment preservation via *ToYaml(originalYaml)', () => {
  it('keeps comments stuck to api keys when url changes', () => {
    const input = `# file note
type: api
# url note
url: https://old.example/echo  # inline url
method: get
`;
    const api = yamlToAPI(input);
    api.url = 'https://new.example/echo';
    const out = apiToYaml(api, input);
    expect(out).toContain('# file note');
    expect(out).toMatch(/# url note\nurl:/);
    expect(out).toMatch(/url:.*# inline url/);
    expect(out).toContain('https://new.example/echo');
    expect(out).toContain('method: get');
  });

  it('keeps comments stuck to test steps when title changes', () => {
    const input = `type: test
# title note
title: Old  # inline title
steps:
  # first step
  - print: hello
`;
    const test = yamlToTest(input);
    test.title = 'New';
    const out = testToYaml(test, input);
    expect(out).toMatch(/# title note\ntitle:/);
    expect(out).toMatch(/title:.*# inline title/);
    expect(out).toContain('# first step');
    expect(out).toContain('print: hello');
    expect(out).toContain('title: New');
  });

  it('keeps comments stuck to env keys when a variable changes', () => {
    const input = `# project env
type: env
variables:
  # default url
  api_url:
    local: https://old.example  # inline url
`;
    const env = yamlToEnv(input);
    env.variables = {
      api_url: {local: 'https://new.example'},
    };
    const out = envToYaml(env, input);
    expect(out).toContain('# project env');
    expect(out).toContain('# default url');
    expect(out).toMatch(/local:.*# inline url/);
    expect(out).toContain('https://new.example');
  });

  it('keeps comments stuck to suite keys when title changes', () => {
    const input = `type: suite
# title note
title: Old
items:
  # first item
  - test.mmt
`;
    const suite = yamlToSuite(input);
    suite.title = 'New';
    const out = suiteToYaml(suite, input);
    expect(out).toContain('# title note');
    expect(out).toContain('# first item');
    expect(out).toContain('title: New');
    expect(out).toContain('test.mmt');
  });

  it('keeps comments stuck to mock keys when port changes', () => {
    const input = `type: server
# port note
port: 8080  # inline port
endpoints:
  # echo
  - path: /echo
`;
    const mock = yamlToMock(input);
    expect(mock).toBeTruthy();
    mock!.port = 9090;
    const out = mockToYaml(mock!, input);
    expect(out).toMatch(/# port note\nport:/);
    expect(out).toMatch(/port:.*# inline port/);
    expect(out).toContain('# echo');
    expect(out).toContain('port: 9090');
  });

  it('keeps comments stuck to doc keys when title changes', () => {
    const input = `type: doc
# title note
title: Old
sources:
  # first source
  - api.mmt
`;
    const doc = yamlToDoc(input);
    doc.title = 'New';
    const out = docToYaml(doc, input);
    expect(out).toContain('# title note');
    expect(out).toContain('# first source');
    expect(out).toContain('title: New');
  });

  it('keeps comments stuck to loadtest keys when threads change', () => {
    const input = `type: loadtest
# test note
test: flow.mmt  # inline test
repeat: 10
# threads note
threads: 5
`;
    const loadtest = yamlToLoadTest(input);
    loadtest.threads = 20;
    const out = loadtestToYaml(loadtest, input);
    expect(out).toMatch(/# test note\ntest:/);
    expect(out).toMatch(/test:.*# inline test/);
    expect(out).toContain('# threads note');
    expect(out).toContain('threads: 20');
  });
});

describe('yaml AST merge does not change packed data', () => {
  it('packYaml without originalYaml matches packYaml with empty original', () => {
    const obj = {type: 'api', url: 'https://example.com', method: 'get'};
    expect(packYaml(obj)).toBe(packYaml(obj, ''));
    expect(packYaml(obj)).toBe(packYaml(obj, undefined));
  });

  it('api merge parses back to the same data as a fresh pack', () => {
    const original = `# note
type: api
title: Echo  # inline
url: https://old.example/echo
method: get
headers:
  # keep
  X-Trace: one
query:
  q: old
body:
  message: hello
`;
    const {merged} = expectMergedEqualsFresh(yamlToAPI, apiToYaml, original, (api) => {
      api.url = 'https://new.example/echo';
      api.method = 'post';
      api.timeout = 5000;
      api.title = undefined;
      api.headers = {Authorization: 'Bearer x'};
      api.body = {message: 'world', extra: 1};
    });
    expect(merged).toContain('# note');
    expect(merged).not.toContain('title:');
    expect(merged).toContain('timeout: 5000');
    expect(merged).toContain('Authorization: Bearer x');
    expect(merged).not.toContain('X-Trace:');
    expect(yamlToAPI(merged).url).toBe('https://new.example/echo');
    expect(yamlToAPI(merged).method).toBe('post');
  });

  it('test merge add/remove steps parses back to the same data as a fresh pack', () => {
    const original = `type: test
title: Flow
steps:
  # first
  - print: hello
  - print: keep-me
`;
    expectMergedEqualsFresh(yamlToTest, testToYaml, original, (test) => {
      test.title = 'Renamed';
      test.steps = [{print: 'hello'}, {print: 'added'}] as typeof test.steps;
    });
  });

  it('env merge add/remove sections parses back to the same data as a fresh pack', () => {
    const original = `type: env
variables:
  api_url:
    local: https://old.example
certificates:
  server_ca: ./certs/ca.crt
`;
    const {merged} = expectMergedEqualsFresh(yamlToEnv, envToYaml, original, (env) => {
      env.variables = {api_url: {local: 'https://new.example'}, token: {local: 'abc'}};
      env.certificates = undefined;
      env.presets = {runner: {dev: {api_url: 'local'}}};
    });
    expect(merged).not.toContain('certificates:');
    expect(merged).toContain('presets:');
    expect(merged).toContain('token:');
  });

  it('suite merge item list parses back to the same data as a fresh pack', () => {
    const original = `type: suite
title: S
items:
  - a.mmt
  - then
  - b.mmt
`;
    expectMergedEqualsFresh(yamlToSuite, suiteToYaml, original, (suite) => {
      suite.title = 'S2';
      suite.items = ['a.mmt', 'c.mmt'];
    });
  });

  it('mock merge endpoint list parses back to the same data as a fresh pack', () => {
    const original = `type: server
port: 8080
endpoints:
  - method: get
    path: /echo
  - method: post
    path: /old
`;
    const mock = yamlToMock(original);
    expect(mock).toBeTruthy();
    expectMergedEqualsFresh(
        (yaml) => yamlToMock(yaml)!,
        (data, originalYaml) => mockToYaml(data, originalYaml),
        original,
        (data) => {
          data.port = 9090;
          data.endpoints = [
            {method: 'get', path: '/echo'},
            {method: 'put', path: '/new'},
          ];
        });
  });

  it('doc merge sources parses back to the same data as a fresh pack', () => {
    const original = `type: doc
title: Docs
sources:
  - a.mmt
`;
    expectMergedEqualsFresh(yamlToDoc, docToYaml, original, (doc) => {
      doc.title = 'API Docs';
      doc.sources = ['a.mmt', 'b.mmt'];
    });
  });

  it('loadtest merge parses back to the same data as a fresh pack', () => {
    const original = `type: loadtest
test: flow.mmt
repeat: 10
threads: 5
`;
    expectMergedEqualsFresh(yamlToLoadTest, loadtestToYaml, original, (lt) => {
      lt.test = 'other.mmt';
      lt.threads = 1;
      lt.repeat = 20;
    });
  });

  it('keeps unquoted omit vs quoted omit after an unrelated edit', () => {
    const original = `type: api
url: https://old.example
method: post
inputs:
  removeMe: omit
  keepLiteral: "omit"
`;
    const api = yamlToAPIStrict(original);
    api.url = 'https://new.example';
    const merged = apiToYaml(api, original);
    const parsed = yamlToAPIStrict(merged);
    expect(isOmitSentinel(parsed.inputs?.removeMe)).toBe(true);
    expect(parsed.inputs?.keepLiteral).toBe('omit');
    expect(merged).toMatch(/removeMe: omit/);
    expect(merged).toMatch(/keepLiteral: ["']omit["']/);
    expect(yamlToAPI(merged)).toEqual(yamlToAPI(apiToYaml(api)));
  });

  it('format after a merged UI write still preserves comments', () => {
    const original = `# file
type: api
url: https://old.example  # inline
method: get
`;
    const api = yamlToAPI(original);
    api.url = 'https://new.example';
    const merged = apiToYaml(api, original);
    const formatted = formatMmtYaml(merged, 'echo.mmt');
    expect(formatted.formatted).toContain('# file');
    expect(formatted.formatted).toContain('# inline');
    expect(yamlToAPI(formatted.formatted)).toEqual(yamlToAPI(merged));
  });

  it('a second merge is a no-op for parsed data', () => {
    const original = `type: api
url: https://old.example
method: get
`;
    const api = yamlToAPI(original);
    api.url = 'https://new.example';
    const once = apiToYaml(api, original);
    const twice = apiToYaml(yamlToAPI(once), once);
    expect(yamlToAPI(twice)).toEqual(yamlToAPI(once));
  });
});

describe('mergeYamlValue', () => {
  it('writes 0 and false without dropping the keys', () => {
    const doc = YAML.parseDocument('count: 1\nenabled: true\n');
    mergeYamlValue(doc, doc.contents, {count: 0, enabled: false});
    const text = doc.toString();
    expect(text).toContain('count: 0');
    expect(text).toContain('enabled: false');
  });

  it('deletes keys missing from the next object', () => {
    const doc = YAML.parseDocument('keep: a\ndrop: b\n');
    mergeYamlValue(doc, doc.contents, {keep: 'a'});
    const text = doc.toString();
    expect(text).toContain('keep: a');
    expect(text).not.toContain('drop:');
  });

  it('appends new keys and grows a sequence', () => {
    const doc = YAML.parseDocument('items:\n  - one\n');
    mergeYamlValue(doc, doc.contents, {items: ['one', 'two'], extra: true});
    const text = doc.toString();
    expect(text).toContain('- two');
    expect(text).toContain('extra: true');
  });

  it('replaces a scalar with a map when the type changes', () => {
    const doc = YAML.parseDocument('value: old\n');
    mergeYamlValue(doc, doc.contents, {value: {nested: 1}});
    expect(YAML.parse(doc.toString())).toEqual({value: {nested: 1}});
  });
});
