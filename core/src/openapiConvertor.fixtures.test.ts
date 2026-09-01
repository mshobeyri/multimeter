import * as fs from 'fs';
import * as path from 'path';
import {convertToMmt, detectImportSource, listSpecApis} from './importConvertor';
import {openApiToAPI} from './openapiConvertor';
import {parseYamlStrict} from './markupConvertor';

const fixturesDir = path.join(__dirname, 'fixtures/openapi');

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

describe('openapiConvertor fixtures', () => {
  it('detects OpenAPI 3 JSON and YAML fixtures', () => {
    expect(detectImportSource(readFixture('petstore3.openapi.json'), 'petstore3.openapi.json')).toBe('openapi');
    expect(detectImportSource(readFixture('petstore.swagger2.json'), 'petstore.swagger2.json')).toBe('openapi');
    expect(detectImportSource(readFixture('convert-example.openapi.yaml'), 'convert-example.openapi.yaml')).toBe('openapi');
    expect(detectImportSource(readFixture('sample-bearer.openapi.json'), 'sample-bearer.openapi.json')).toBe('openapi');
  });

  it('converts Swagger Petstore OpenAPI 3 JSON into expected operations', () => {
    const spec = parseFixture('petstore3.openapi.json');
    const apis = openApiToAPI(spec);

    expect(apis).toHaveLength(19);

    const findByStatus = apis.find(api => api.title === 'Finds Pets by status.');
    expect(findByStatus).toMatchObject({
      method: 'get',
      url: '/api/v3/pet/findByStatus',
      query: {status: ''},
    });

    const login = apis.find(api => api.title === 'Logs user into the system.');
    expect(login).toMatchObject({
      method: 'get',
      url: '/api/v3/user/login',
      query: {username: '', password: ''},
    });

    const getPet = apis.find(api => api.title === 'Find pet by ID.');
    expect(getPet).toMatchObject({
      method: 'get',
      url: '/api/v3/pet/{petId}',
      auth: {type: 'api-key', header: 'api_key', value: 'i:api_key'},
    });

    const placeOrder = apis.find(api => api.title === 'Place an order for a pet.');
    expect(placeOrder).toMatchObject({
      method: 'post',
      url: '/api/v3/store/order',
      headers: {'Content-Type': 'application/json'},
    });
    expect(placeOrder?.body).toBeUndefined();
  });

  it('converts Swagger 2 JSON Petstore with path-only URLs', () => {
    const spec = parseFixture('petstore.swagger2.json');
    const apis = openApiToAPI(spec);

    expect(apis.length).toBeGreaterThanOrEqual(19);
    const getPet = apis.find(api => api.title === 'Find pet by ID');
    expect(getPet).toBeDefined();
    expect(getPet?.method).toBe('get');
    expect(String(getPet?.url)).toMatch(/\/pet\/\{petId\}/);
  });

  it('converts a minimal JSON spec with bearer auth, path/query params, and named examples', () => {
    const spec = parseFixture('sample-bearer.openapi.json');
    const apis = openApiToAPI(spec);

    expect(apis).toHaveLength(2);

    const getItem = apis.find(api => api.title === 'Get item');
    expect(getItem).toMatchObject({
      method: 'get',
      url: 'https://api.example.com/v1/items/abc-123',
      query: {fields: 'name,status'},
      auth: {type: 'bearer', token: 'i:token'},
    });

    const createRevision = apis.find(api => api.title === 'Create item revision');
    expect(createRevision).toMatchObject({
      method: 'post',
      url: 'https://api.example.com/v1/items/abc-123',
      body: '<<i:body>>',
    });
    expect(JSON.parse(String(createRevision?.inputs?.body))).toEqual({name: 'Widget', active: true});
    expect(createRevision?.examples?.map(example => example.name)).toEqual(['Draft']);
    expect(createRevision?.examples?.[0].inputs?.body && JSON.parse(String(createRevision.examples[0].inputs.body)))
        .toEqual({name: 'Draft widget', active: false});
  });

  it('lists and converts YAML OpenAPI fixture through importConvertor', () => {
    const raw = readFixture('convert-example.openapi.yaml');
    const listed = listSpecApis(raw, 'convert-example.openapi.yaml');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      title: 'Get sample JSON',
      method: 'get',
    });

    const result = convertToMmt(raw, {sourcePath: 'convert-example.openapi.yaml'});
    expect(result.sourceKind).toBe('openapi');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('api/get-sample-json.mmt');

    const api = parseYamlStrict(result.files[0].content);
    expect(api).toMatchObject({
      type: 'api',
      title: 'Get sample JSON',
      method: 'get',
      url: 'https://test.mmt.dev/json',
      headers: {trace: 'demo'},
    });
  });

  it('converts petstore3 JSON into one MMT file per operation', () => {
    const raw = readFixture('petstore3.openapi.json');
    const result = convertToMmt(raw, {sourcePath: 'petstore3.openapi.json'});
    expect(result.sourceKind).toBe('openapi');
    expect(result.title).toBe('Swagger Petstore - OpenAPI 3.0');
    expect(result.files).toHaveLength(19);
    expect(result.files.every(file => file.path.startsWith('api/') && file.path.endsWith('.mmt'))).toBe(true);

    const loginFile = result.files.find(file => file.sourceName === 'Logs user into the system.');
    expect(loginFile?.path).toBe('api/logs-user-into-the-system.mmt');
    const loginApi = parseYamlStrict(loginFile!.content);
    expect(loginApi.url).toBe('/api/v3/user/login');
    expect(loginApi.query).toEqual({username: '', password: ''});
  });
});
