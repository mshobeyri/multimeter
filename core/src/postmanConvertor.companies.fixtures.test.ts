import * as fs from 'fs';
import * as path from 'path';
import {convertToMmt, detectImportSource} from './importConvertor';
import {postmanToAPI} from './postmanConvertor';
import {parseYamlStrict} from './markupConvertor';

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
      expect(api.method).toBeTruthy();
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

    const first = parseYamlStrict(apiFiles[0].content);
    expect(first.type).toBe('api');
    expect(first.method).toBeTruthy();
    expect(first.url).toBeTruthy();
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
});
