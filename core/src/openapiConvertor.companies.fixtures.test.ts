import * as fs from 'fs';
import * as path from 'path';
import {convertToMmt, detectImportSource} from './importConvertor';
import {openApiToAPI} from './openapiConvertor';
import {yamlToAPIStrict} from './apiParsePack';
import {parseYamlStrict} from './markupConvertor';
import {apiToJSfunc} from './JSerAPI';

const fixturesDir = path.join(__dirname, 'fixtures/openapi/companies');

const COMPANY_FIXTURES = [
  'docker.openapi.yaml',
  'notion.openapi.yaml',
  'paypal.openapi.json',
  'bitbucket.openapi.json',
  'box.openapi.json',
  'twilio.openapi.json',
  'gitlab.openapi.yaml',
  'circleci.openapi.json',
  'slack.swagger.json',
  'digitalocean.openapi.yaml',
] as const;

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

function parseFixture(name: string): any {
  const raw = readFixture(name);
  if (name.endsWith('.json')) {
    return JSON.parse(raw);
  }
  return parseYamlStrict(raw);
}

describe('openapiConvertor company fixtures', () => {
  jest.setTimeout(120_000);

  it('ships exactly 10 company OpenAPI fixtures', () => {
    const files = fs.readdirSync(fixturesDir).filter(name => /\.(json|yaml|yml)$/i.test(name));
    expect(files.sort()).toEqual([...COMPANY_FIXTURES].sort());
  });

  it.each([...COMPANY_FIXTURES])('detects %s as openapi', (name) => {
    expect(detectImportSource(readFixture(name), name)).toBe('openapi');
  });

  it.each([...COMPANY_FIXTURES])('converts %s into APIs with method and url', (name) => {
    const spec = parseFixture(name);
    const apis = openApiToAPI(spec);

    expect(apis.length).toBeGreaterThan(0);
    for (const api of apis) {
      expect(api.method).toBeTruthy();
      expect(String(api.url || '').length).toBeGreaterThan(0);
    }

    const methods = new Set(apis.map(api => String(api.method).toLowerCase()));
    expect(methods.size).toBeGreaterThan(0);
  });

  it.each([...COMPANY_FIXTURES])('convertToMmt emits one .mmt api file per operation for %s', (name) => {
    const raw = readFixture(name);
    const apis = openApiToAPI(parseFixture(name));
    const result = convertToMmt(raw, {sourcePath: name});

    expect(result.sourceKind).toBe('openapi');
    expect(result.files.length).toBe(apis.length);
    expect(result.files.every(file => file.path.endsWith('.mmt'))).toBe(true);

    // Spot-check first emitted file parses as type: api
    const first = parseYamlStrict(result.files[0].content);
    expect(first.type).toBe('api');
    expect(first.method).toBeTruthy();
    expect(first.url).toBeTruthy();
  });

  it('Docker Engine fixture includes container list operation', () => {
    const apis = openApiToAPI(parseFixture('docker.openapi.yaml'));
    const list = apis.find(api =>
      String(api.url).includes('/containers/json') || /list.*container/i.test(String(api.title || '')));
    expect(list).toBeDefined();
    expect(String(list?.method).toLowerCase()).toBe('get');
  });

  it('Swagger 2 company fixtures include host and basePath in URLs', () => {
    const bitbucket = openApiToAPI(parseFixture('bitbucket.openapi.json'));
    expect(bitbucket.some(api =>
      String(api.url).startsWith('https://api.bitbucket.org/2.0/'))).toBe(true);

    const slack = openApiToAPI(parseFixture('slack.swagger.json'));
    expect(slack.some(api =>
      String(api.url).startsWith('https://slack.com/api/'))).toBe(true);
  });

  it('OpenAPI 3 company fixtures with servers keep absolute URLs', () => {
    const paypal = openApiToAPI(parseFixture('paypal.openapi.json'));
    expect(paypal.every(api =>
      String(api.url).startsWith('https://api-m.paypal.com/'))).toBe(true);
  });

  it('CircleCI fixture includes pipeline-related GETs', () => {
    const apis = openApiToAPI(parseFixture('circleci.openapi.json'));
    expect(apis.some(api => String(api.method).toLowerCase() === 'get')).toBe(true);
    expect(apis.some(api => /pipeline/i.test(String(api.url)) || /pipeline/i.test(String(api.title || '')))).toBe(true);
  });

  it.each([...COMPANY_FIXTURES])(
      'strict-parses and compiles every emitted API from %s',
      async (name) => {
        const result = convertToMmt(readFixture(name), {sourcePath: name});
        const apiFiles = result.files.filter(file => file.kind === 'api');
        expect(apiFiles.length).toBeGreaterThan(0);
        for (const [index, file] of apiFiles.entries()) {
          const api = yamlToAPIStrict(file.content);
          expect(api.type).toBe('api');
          expect(api.method || api.protocol === 'graphql').toBeTruthy();
          expect(api.url).toBeTruthy();
          const js = await apiToJSfunc({
            api,
            name: `openapiCompanyApi${index + 1}`,
            inputs: {},
            envVars: {},
          });
          expect(js).toContain('send_');
        }
      });
});
