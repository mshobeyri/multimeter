import * as fs from 'fs';
import * as path from 'path';
import {convertToMmt, detectImportSource} from './importConvertor';
import {postmanToAPI} from './postmanConvertor';
import {yamlToAPIStrict} from './apiParsePack';
import {parseYamlStrict} from './markupConvertor';
import {OMIT_SENTINEL} from './omitKeyword';
import {apiToJSfunc} from './JSerAPI';
import {yamlToTestStrict} from './testParsePack';
import {yamlToSuite} from './suiteParsePack';
import {yamlToEnv} from './envParsePack';

const fixturesDir = path.join(__dirname, 'fixtures/postman/companies');

const COMPANY_FIXTURES = [
  'stripe.postman_collection.json',
  'paypal.postman_collection.json',
  'twitter.postman_collection.json',
  'braintree.postman_collection.json',
  'docker.postman_collection.json',
  'notion.postman_collection.json',
  'bitbucket.postman_collection.json',
  'box.postman_collection.json',
  'twilio.postman_collection.json',
  'slack.postman_collection.json',
] as const;

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

function parseFixture(name: string): any {
  return JSON.parse(readFixture(name));
}

function flattenRequests(items: any[]): any[] {
  return (items || []).flatMap(item =>
    Array.isArray(item?.item) ? flattenRequests(item.item) : [item]);
}

describe('postmanConvertor company fixtures', () => {
  jest.setTimeout(120_000);

  it('ships exactly 10 company Postman fixtures', () => {
    const files = fs.readdirSync(fixturesDir).filter(name => name.endsWith('.json'));
    expect(files.sort()).toEqual([...COMPANY_FIXTURES].sort());
  });

  it.each([...COMPANY_FIXTURES])('detects %s as postman', (name) => {
    expect(detectImportSource(readFixture(name), name)).toBe('postman');
  });

  it.each([...COMPANY_FIXTURES])('converts %s into APIs with method and url', (name) => {
    const collection = parseFixture(name);
    const apis = postmanToAPI(collection);

    expect(apis.length).toBeGreaterThan(0);
    for (const api of apis) {
      expect(api.method || api.protocol === 'graphql').toBeTruthy();
      expect(String(api.url || '').length).toBeGreaterThan(0);
    }
  });

  it.each([...COMPANY_FIXTURES])('convertToMmt emits .mmt api files for %s', (name) => {
    const raw = readFixture(name);
    const apis = postmanToAPI(parseFixture(name));
    const result = convertToMmt(raw, {sourcePath: name});

    expect(result.sourceKind).toBe('postman');
    const apiFiles = result.files.filter(file => file.kind === 'api');
    expect(apiFiles.length).toBe(apis.length);
    expect(apiFiles.length).toBeGreaterThan(0);

    for (const file of apiFiles) {
      const parsed = yamlToAPIStrict(file.content);
      expect(parsed.type).toBe('api');
      expect(parsed.method || parsed.protocol === 'graphql').toBeTruthy();
      expect(parsed.url).toBeTruthy();
    }

    const emittedPaths = new Set(result.files.map(file => file.path));
    for (const file of result.files) {
      let references: string[] = [];
      if (file.kind === 'test') {
        const test = yamlToTestStrict(file.content);
        references = Object.values(test.import || {});
      } else if (file.kind === 'suite') {
        const suite = yamlToSuite(file.content);
        references = (suite.items || []).filter(item => item !== 'then');
      } else if (file.kind === 'env') {
        expect(yamlToEnv(file.content).type).toBe('env');
      }
      for (const reference of references) {
        const target = reference.startsWith('+/')
          ? reference.slice(2)
          : path.posix.normalize(
              path.posix.join(path.posix.dirname(file.path), reference));
        expect(emittedPaths).toContain(target);
      }
    }
  });

  it.each([...COMPANY_FIXTURES])(
      'compiles every emitted API from %s into executable request code',
      async (name) => {
        const result = convertToMmt(
            readFixture(name), {sourcePath: name});
        const apiFiles = result.files.filter(file => file.kind === 'api');
        for (const [index, file] of apiFiles.entries()) {
          const api = yamlToAPIStrict(file.content);
          const js = await apiToJSfunc({
            api,
            name: `companyApi${index + 1}`,
            inputs: {},
            envVars: {},
          });
          expect(js).toContain('send_');
        }
      });

  it('Stripe fixture converts multiple HTTP methods', () => {
    const apis = postmanToAPI(parseFixture('stripe.postman_collection.json'));
    const methods = new Set(apis.map(api => String(api.method).toLowerCase()));
    expect(methods.has('get') || methods.has('post')).toBe(true);
    expect(apis.length).toBeGreaterThan(10);
  });

  it('Twitter/X fixture keeps api.twitter.com or api.x.com hosts', () => {
    const apis = postmanToAPI(parseFixture('twitter.postman_collection.json'));
    expect(apis.some(api => /twitter\.com|x\.com|api\.x\.com/i.test(String(api.url)))).toBe(true);
  });

  it('preserves inherited bearer auth in Stripe and PayPal', () => {
    const stripe = postmanToAPI(parseFixture('stripe.postman_collection.json'));
    expect(stripe).toHaveLength(60);
    expect(stripe.every(api =>
      api.auth && typeof api.auth !== 'string' &&
      api.auth.type === 'bearer' &&
      api.auth.token === '<<e:bearer_token>>')).toBe(true);
    expect(stripe.every(api =>
      api.headers?.['User-Agent'] ===
      '<<e:versionUserAgent>>')).toBe(true);
    const stripeResult = convertToMmt(
        readFixture('stripe.postman_collection.json'),
        {sourcePath: 'stripe.postman_collection.json'});
    const stripeEnv = parseYamlStrict(
        stripeResult.files.find(file => file.kind === 'env')!.content);
    expect(stripeEnv.variables.bearer_token.default).toBe('');

    const paypal = postmanToAPI(parseFixture('paypal.postman_collection.json'));
    expect(paypal.filter(api =>
      api.auth && typeof api.auth !== 'string' &&
      api.auth.type === 'bearer')).toHaveLength(59);
    expect(paypal.filter(api =>
      api.auth && typeof api.auth !== 'string' &&
      api.auth.type === 'basic')).toHaveLength(1);
  });

  it('uses bearer access-token inputs for interactive OAuth2 fixtures', () => {
    for (const name of [
      'bitbucket.postman_collection.json',
      'slack.postman_collection.json',
    ]) {
      const apis = postmanToAPI(parseFixture(name));
      expect(apis).toHaveLength(60);
      expect(apis.every(api =>
        api.auth && typeof api.auth !== 'string' &&
        api.auth.type === 'bearer' &&
        api.auth.token === '<<e:access_token>>')).toBe(true);
      const result = convertToMmt(readFixture(name), {sourcePath: name});
      const env = parseYamlStrict(
          result.files.find(file => file.kind === 'env')!.content);
      expect(env.variables.access_token.default).toBe('');
    }
  });

  it('converts all Braintree GraphQL operations with bodies', () => {
    const apis =
        postmanToAPI(parseFixture('braintree.postman_collection.json'));
    expect(apis).toHaveLength(43);
    expect(apis.every(api =>
      api.protocol === 'graphql' &&
      !!api.graphql?.operation &&
      api.body === undefined)).toBe(true);
  });

  it('resolves composed base URLs and parameterizes path variables', () => {
    for (const name of [
      'stripe.postman_collection.json',
      'twitter.postman_collection.json',
    ]) {
      const apis = postmanToAPI(parseFixture(name));
      expect(apis.some(api =>
        /https?:\/\/https?:\/\//i.test(String(api.url)))).toBe(false);
      expect(apis.some(api =>
        /\/:[A-Za-z_]/.test(String(api.url)))).toBe(false);
    }
  });

  it('does not activate disabled headers or query parameters', () => {
    for (const name of [
      'paypal.postman_collection.json',
      'stripe.postman_collection.json',
      'twitter.postman_collection.json',
    ]) {
      const collection = parseFixture(name);
      const requests = flattenRequests(collection.item);
      const apis = postmanToAPI(collection);
      expect(apis).toHaveLength(requests.length);

      requests.forEach((item, index) => {
        const request = item.request || {};
        const headers = Array.isArray(request.header) ? request.header : [];
        const query = Array.isArray(request.url?.query)
          ? request.url.query
          : [];
        const enabledHeaderKeys = new Set(
            headers.filter((entry: any) => !entry?.disabled)
                .map((entry: any) => entry?.key));
        const enabledQueryKeys = new Set(
            query.filter((entry: any) => !entry?.disabled)
                .map((entry: any) => entry?.key));

        for (const entry of headers.filter(
            (candidate: any) => candidate?.disabled)) {
          if (!enabledHeaderKeys.has(entry.key)) {
            const converted = apis[index].headers?.[entry.key];
            if (converted !== undefined) {
              const input = /^<<i:([^>]+)>>$/.exec(converted);
              expect(input).toBeTruthy();
              expect(apis[index].inputs?.[input![1]]).toBe(OMIT_SENTINEL);
            }
          }
        }
        for (const entry of query.filter(
            (candidate: any) => candidate?.disabled)) {
          if (!enabledQueryKeys.has(entry.key)) {
            expect(apis[index].query || {}).not.toHaveProperty(entry.key);
            const decodedUrl =
                decodeURIComponent(String(apis[index].url || ''));
            expect(decodedUrl).not.toContain(`?${entry.key}=`);
            expect(decodedUrl).not.toContain(`&${entry.key}=`);
          }
        }
      });
    }
  });
});
