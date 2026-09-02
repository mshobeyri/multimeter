import {APIData, ExampleData} from './APIData';
import {apiToYaml} from './apiParsePack';
import {brunoToAPI, brunoToTest, isBrunoFilePath, isBrunoRequestFilePath, sortBrunoSourceFiles} from './brunoParsePack';
import type {BrunoSourceFile} from './brunoParsePack';
import {safeStepIdFromAlias, slugToCamel, slugValue} from './identifierUtils';
import {httpRequestCallExtras, httpRequestToAPI, isHttpFilePath, parseHttpDocument} from './httpParsePack';
import {packYaml, parseYamlStrict} from './markupConvertor';
import {buildOpenApiEnvFromSpec, openApiToAPI} from './openapiConvertor';
import {postmanToAPI} from './postmanConvertor';
import {SuiteData} from './SuiteData';
import {suiteToYaml} from './suiteParsePack';
import {TestData, TestFlowStep} from './TestData';
import {testToYaml} from './testParsePack';
import {wsdlToAPI} from './wsdlConvertor';

export type ImportSourceKind = 'postman' | 'openapi' | 'wsdl' | 'http' | 'bruno';

export interface ConvertedMmtFile {
  path: string;
  kind: 'api' | 'test' | 'suite' | 'env' | 'doc';
  content: string;
  sourceName?: string;
  warnings?: string[];
}

export interface ConvertToMmtOptions {
  sourcePath?: string;
  sourceKind?: ImportSourceKind;
  postman?: {
    includeApis?: boolean;
    includeTests?: boolean;
    includeEnv?: boolean;
    scriptMode?: 'translate' | 'preserve' | 'skip';
  };
  openapi?: {
    baseUrlMode?: 'server' | 'input' | 'environment';
    includeDeprecated?: boolean;
  };
  wsdl?: {
    endpointMode?: 'service' | 'input' | 'environment';
  };
}

export interface ConvertToMmtResult {
  sourceKind: ImportSourceKind;
  title?: string;
  files: ConvertedMmtFile[];
  warnings: string[];
}

interface PostmanWalkItem {
  name?: string;
  item?: PostmanWalkItem[];
  request?: any;
  response?: any[];
  event?: any[];
}

interface PostmanRequestFile {
  api: APIData;
  apiPath: string;
  alias: string;
  groupKey: string;
  groupTitle: string;
  item: PostmanWalkItem;
}

interface PostmanTestFile {
  path: string;
  title: string;
  groupKey: string;
  data: TestData;
}

export const SPEC_SOURCE_KINDS = ['openapi', 'postman', 'wsdl'] as const;
export type SpecSourceKind = typeof SPEC_SOURCE_KINDS[number];

export function isSpecSourceKind(kind: string | undefined): kind is SpecSourceKind {
  return !!kind && (SPEC_SOURCE_KINDS as readonly string[]).includes(kind);
}

export interface SpecApiExampleItem {
  id: string;
  title: string;
  exampleIndex: number;
}

export interface SpecApiItem {
  id: string;
  title: string;
  method?: string;
  url?: string;
  api: APIData;
  examples: SpecApiExampleItem[];
}

export interface SpecApiSelection {
  item: SpecApiItem;
  exampleIndex: number;
}

function specExampleTitle(example: ExampleData | undefined, index: number): string {
  const name = String(example?.name || '').trim();
  return name || `Example ${index + 1}`;
}

export function findSpecApiSelection(
    items: SpecApiItem[], selectedId?: string): SpecApiSelection | undefined {
  if (!items.length) {
    return undefined;
  }
  for (const item of items) {
    if (item.id === selectedId) {
      return {item, exampleIndex: -1};
    }
    const example = item.examples.find(child => child.id === selectedId);
    if (example) {
      return {item, exampleIndex: example.exampleIndex};
    }
  }
  return {item: items[0], exampleIndex: -1};
}

export function listSpecApis(rawFile: string, filePath = ''): SpecApiItem[] {
  const kind = detectImportSource(rawFile, filePath);
  let apis: APIData[] = [];
  if (kind === 'openapi') {
    const spec = parseStructured(rawFile);
    if (!isOpenApiSpec(spec)) {
      return [];
    }
    apis = openApiToAPI(spec);
  } else if (kind === 'postman') {
    const collection = parseStructured(rawFile);
    if (!isPostmanCollection(collection)) {
      return [];
    }
    apis = postmanToAPI(collection);
  } else if (kind === 'wsdl') {
    apis = wsdlToAPI(rawFile);
  } else if (kind === 'http') {
    apis = parseHttpDocument(rawFile).requests
        .map((request, index) => httpRequestToAPI(request, index))
        .filter((api): api is APIData => !!api);
  } else if (kind === 'bruno') {
    const api = brunoToAPI(rawFile, filePath);
    if (api) {
      apis = [api];
    }
  }
  return apis.map((api, index) => {
    const id = `${index}:${api.title || api.url || 'api'}`;
    const examples = (api.examples || []).map((example, exampleIndex) => ({
      id: `${id}:ex:${exampleIndex}`,
      title: specExampleTitle(example, exampleIndex),
      exampleIndex,
    }));
    return {
      id,
      title: api.title || api.url || `API ${index + 1}`,
      method: api.method,
      url: typeof api.url === 'string' ? api.url : undefined,
      api,
      examples,
    };
  });
}

export function listSpecApisFromFiles(files: BrunoSourceFile[]): SpecApiItem[] {
  const items: SpecApiItem[] = [];
  const brunoFiles = sortBrunoSourceFiles(files.filter(file => isBrunoRequestFilePath(file.path)));
  const sources = brunoFiles.length > 0 ? brunoFiles : files;
  for (const file of sources) {
    for (const item of listSpecApis(file.content, file.path)) {
      items.push(item);
    }
  }
  return items.map((item, index) => {
    const id = `${index}:${item.title || item.url || 'api'}`;
    return {
      ...item,
      id,
      examples: item.examples.map(example => ({
        ...example,
        id: `${id}:ex:${example.exampleIndex}`,
      })),
    };
  });
}

export function detectImportSource(rawFile: string, sourcePath?: string): ImportSourceKind | undefined {
  const lowerPath = String(sourcePath || '').toLowerCase();
  const trimmed = String(rawFile || '').trim();
  if (isHttpFilePath(lowerPath)) {
    return 'http';
  }
  if (isBrunoFilePath(lowerPath)) {
    return 'bruno';
  }
  if (lowerPath.endsWith('.wsdl') || looksLikeWsdl(trimmed)) {
    return 'wsdl';
  }

  const parsed = parseStructured(trimmed);
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  if (isPostmanCollection(parsed)) {
    return 'postman';
  }
  if (isOpenApiSpec(parsed)) {
    return 'openapi';
  }
  return undefined;
}

export function convertToMmt(rawFile: string, options: ConvertToMmtOptions = {}): ConvertToMmtResult {
  const sourceKind = options.sourceKind || detectImportSource(rawFile, options.sourcePath);
  if (!sourceKind) {
    throw new Error('Unsupported import file. Select a Postman collection, OpenAPI spec, WSDL document, HTTP file, or Bruno file.');
  }
  if (sourceKind === 'postman') {
    const postmanJson = parseStructured(rawFile);
    if (!isPostmanCollection(postmanJson)) {
      throw new Error('The selected file does not look like a Postman collection.');
    }
    return convertPostmanToMmt(postmanJson, options);
  }
  if (sourceKind === 'openapi') {
    const openApiSpec = parseStructured(rawFile);
    if (!isOpenApiSpec(openApiSpec)) {
      throw new Error('The selected file does not look like an OpenAPI spec.');
    }
    return convertOpenApiToMmt(openApiSpec, options);
  }
  if (sourceKind === 'http') {
    return convertHttpToMmt(rawFile, options);
  }
  if (sourceKind === 'bruno') {
    return convertBrunoToMmt(rawFile, options);
  }
  return convertWsdlToMmt(rawFile, options);
}

function parseStructured(rawFile: string): any {
  try {
    return JSON.parse(rawFile);
  } catch {
    try {
      return parseYamlStrict(rawFile);
    } catch {
      return undefined;
    }
  }
}

function isPostmanCollection(value: any): boolean {
  const schema = String(value?.info?.schema || '').toLowerCase();
  return Array.isArray(value?.item) && (schema.includes('postman') || !!value?.info?.name);
}

function isOpenApiSpec(value: any): boolean {
  return !!value && typeof value === 'object' && !!value.paths && (!!value.openapi || !!value.swagger);
}

function looksLikeWsdl(rawFile: string): boolean {
  return /<\s*(?:\w+:)?definitions\b/i.test(rawFile) && /xmlns(?::\w+)?=["'][^"']*schemas\.xmlsoap\.org\/wsdl/i.test(rawFile);
}

function convertOpenApiToMmt(openApiSpec: any, _options: ConvertToMmtOptions): ConvertToMmtResult {
  const apis = openApiToAPI(openApiSpec);
  const used = new Set<string>();
  const files: ConvertedMmtFile[] = apis.map(api => ({
    path: uniquePath(`api/${slug(api.title || `${api.method || 'api'}-${api.url || 'request'}`)}.mmt`, used),
    kind: 'api' as const,
    sourceName: api.title,
    content: apiToYaml(api),
  }));
  const env = buildOpenApiEnvFromSpec(openApiSpec);
  if (env) {
    files.push({
      path: uniquePath('multimeter.mmt', used),
      kind: 'env',
      sourceName: 'OpenAPI server variables',
      content: packYaml(env),
    });
  }
  return {
    sourceKind: 'openapi',
    title: openApiSpec.info?.title,
    files,
    warnings: files.length === 0 ? ['No OpenAPI operations were found.'] : [],
  };
}

function convertWsdlToMmt(rawFile: string, _options: ConvertToMmtOptions): ConvertToMmtResult {
  const apis = wsdlToAPI(rawFile);
  const used = new Set<string>();
  const files = apis.map(api => ({
    path: uniquePath(`api/${slug(api.title || 'soap-operation')}.mmt`, used),
    kind: 'api' as const,
    sourceName: api.title,
    content: apiToYaml(api),
  }));
  return {
    sourceKind: 'wsdl',
    files,
    warnings: files.length === 0 ? ['No WSDL SOAP operations were found.'] : [],
  };
}

function convertHttpToMmt(rawFile: string, options: ConvertToMmtOptions): ConvertToMmtResult {
  const sourcePath = options.sourcePath || 'request.http';
  const document = parseHttpDocument(rawFile);
  const title = basename(sourcePath);
  const testSlug = slug(title);
  const files: ConvertedMmtFile[] = [];
  const usedPaths = new Set<string>();
  const usedAliases = new Set<string>();
  const imports: Record<string, string> = {};
  const steps: TestFlowStep[] = [];
  const warnings = document.warnings.map(warning => `line ${warning.line}: ${warning.message}`);

  for (let index = 0; index < document.requests.length; index++) {
    const request = document.requests[index];
    const api = httpRequestToAPI(request, index);
    if (!api) {
      warnings.push(`Skipped HTTP request on line ${request.startLine} because it has no URL.`);
      continue;
    }
    const requestTitle = api.title || `request_${index + 1}`;
    const apiPath = uniquePath(`api/${slug(requestTitle)}.mmt`, usedPaths);
    const alias = uniqueAlias(slugToCamel(requestTitle), usedAliases);
    files.push({
      path: apiPath,
      kind: 'api',
      sourceName: requestTitle,
      content: apiToYaml(api),
    });
    imports[alias] = `../${apiPath}`;
    const stepId = safeStepIdFromAlias(alias);
    const step: TestFlowStep = {
      call: alias,
      id: stepId,
      debug: true,
    };
    const {expect, setenv} = httpRequestCallExtras(request, stepId);
    if (expect && Object.keys(expect).length > 0) {
      step.expect = expect;
    }
    steps.push(step);
    if (setenv && Object.keys(setenv).length > 0) {
      steps.push({setenv});
    }
  }

  if (steps.length > 0) {
    files.push({
      path: `tests/${testSlug}.mmt`,
      kind: 'test',
      sourceName: title,
      content: testToYaml({
        type: 'test',
        title,
        description: document.requests.length === 1
          ? `Generated from HTTP request "${document.requests[0].title || document.requests[0].name || title}".`
          : `Generated from HTTP file "${title}".`,
        tags: ['http'],
        import: imports,
        steps,
      }),
    });
  }

  return {
    sourceKind: 'http',
    title,
    files,
    warnings: files.length > 0 ? warnings : [...warnings, 'No HTTP requests were found.'],
  };
}

function convertBrunoToMmt(rawFile: string, options: ConvertToMmtOptions): ConvertToMmtResult {
  const sourcePath = options.sourcePath || 'request.bru';
  const api = brunoToAPI(rawFile, sourcePath);
  const test = brunoToTest(rawFile, sourcePath);
  const title = test.title || basename(sourcePath);
  const slugName = slug(title);
  const files: ConvertedMmtFile[] = [];

  if (api) {
    const apiPath = `api/${slugName}.mmt`;
    const alias = slugToCamel(title);
    files.push({
      path: apiPath,
      kind: 'api',
      sourceName: api.title,
      content: apiToYaml(api),
    });

    const inlineStep = test.steps?.[0];
    const step: TestFlowStep = {
      call: alias,
      id: safeStepIdFromAlias(alias),
      debug: true,
    };
    if (inlineStep && 'expect' in inlineStep && inlineStep.expect && Object.keys(inlineStep.expect).length > 0) {
      step.expect = inlineStep.expect;
    }

    files.push({
      path: `tests/${slugName}.mmt`,
      kind: 'test',
      sourceName: title,
      content: testToYaml({
        type: 'test',
        title,
        description: `Generated from Bruno request "${title}".`,
        tags: ['bruno'],
        import: {
          [alias]: `../${apiPath}`,
        },
        steps: [step],
      }),
    });
  } else {
    files.push({
      path: `tests/${slugName}.mmt`,
      kind: 'test',
      sourceName: title,
      content: testToYaml(test),
    });
  }

  return {
    sourceKind: 'bruno',
    title,
    files,
    warnings: files.length > 0 && (api || (test.steps && test.steps.length > 0)) ? [] : ['No Bruno request was found.'],
  };
}

function convertPostmanToMmt(postmanJson: any, options: ConvertToMmtOptions): ConvertToMmtResult {
  const includeApis = options.postman?.includeApis !== false;
  const includeTests = options.postman?.includeTests !== false;
  const includeEnv = options.postman?.includeEnv !== false;
  const scriptMode = options.postman?.scriptMode || 'translate';
  const warnings: string[] = [];
  const requestFiles = collectPostmanRequests(postmanJson, warnings);
  const files: ConvertedMmtFile[] = [];
  const used = new Set<string>();
  const useProjectRootImports = requestFiles.length >= 5;

  if (includeApis) {
    for (const requestFile of requestFiles) {
      const path = uniquePath(requestFile.apiPath, used);
      requestFile.apiPath = path;
      files.push({
        path,
        kind: 'api',
        sourceName: requestFile.api.title,
        content: apiToYaml(requestFile.api),
      });
    }
  }

  if (includeTests) {
    const tests = buildPostmanTests(requestFiles, scriptMode, warnings, useProjectRootImports);
    for (const test of tests) {
      const path = uniquePath(test.path, used);
      test.path = path;
      files.push({path, kind: 'test', sourceName: test.title, content: testToYaml(test.data)});
    }
    for (const suite of buildPostmanSuites(postmanJson, tests, useProjectRootImports)) {
      const path = uniquePath(suite.path, used);
      files.push({path, kind: 'suite', sourceName: suite.title, content: suiteToYaml(suite.data)});
    }
  }

  if (includeEnv) {
    const env = buildPostmanEnv(postmanJson, useProjectRootImports);
    if (env) {
      files.push({path: uniquePath('multimeter.mmt', used), kind: 'env', sourceName: 'Postman variables', content: packYaml(env)});
    }
  }

  return {
    sourceKind: 'postman',
    title: postmanJson.info?.name,
    files,
    warnings,
  };
}

function collectPostmanRequests(postmanJson: any, warnings: string[]): PostmanRequestFile[] {
  const requests: PostmanRequestFile[] = [];
  const usedAliases = new Set<string>();

  const walk = (items: PostmanWalkItem[], folders: string[]) => {
    for (const item of items || []) {
      const name = item.name || 'Request';
      if (Array.isArray(item.item)) {
        walk(item.item, [...folders, name]);
        continue;
      }
      if (!item.request) {
        if (Array.isArray(item.response) && item.response.length > 0) {
          warnings.push(`Skipped response-only Postman item "${name}" because it has no request.`);
        }
        continue;
      }
      const api = postmanToAPI({item: [item]})[0];
      if (!api) {
        warnings.push(`Skipped Postman item "${name}" because it could not be converted.`);
        continue;
      }
      const folderPath = folders.map(slug).filter(Boolean);
      const apiPath = ['api', ...folderPath, `${slug(api.title || name)}.mmt`].join('/');
      const alias = uniqueAlias(slugToCamel(api.title || name), usedAliases);
      const groupKey = folderPath.join('/') || 'collection';
      const groupTitle = folders[folders.length - 1] || postmanJson.info?.name || 'Postman Collection';
      requests.push({api, apiPath, alias, groupKey, groupTitle, item});
    }
  };

  walk(postmanJson.item || [], []);
  return requests;
}

function buildPostmanTests(
  requestFiles: PostmanRequestFile[], scriptMode: 'translate' | 'preserve' | 'skip', warnings: string[], useProjectRootImports: boolean): PostmanTestFile[] {
  const groups = new Map<string, PostmanRequestFile[]>();
  for (const requestFile of requestFiles) {
    const existing = groups.get(requestFile.groupKey) || [];
    existing.push(requestFile);
    groups.set(requestFile.groupKey, existing);
  }

  const tests: PostmanTestFile[] = [];
  for (const [groupKey, groupRequests] of groups.entries()) {
    const title = groupRequests[0]?.groupTitle || 'Postman Collection';
    const imports: Record<string, string> = {};
    const steps: TestFlowStep[] = [];
    for (const requestFile of groupRequests) {
      imports[requestFile.alias] = importPathForTest(groupKey, requestFile.apiPath, useProjectRootImports);
      const preRequestScript = unsupportedPostmanScript(requestFile.item, 'prerequest', scriptMode);
      if (preRequestScript) {
        steps.push({js: preRequestScript});
      }
      const step: any = {
        call: requestFile.alias,
        id: safeStepIdFromAlias(requestFile.alias),
        debug: true,
      };
      const expect = buildPostmanExpect(requestFile.item, scriptMode, warnings);
      if (expect && Object.keys(expect).length > 0) {
        step.expect = expect;
      }
      steps.push(step);
      const setenv = buildPostmanSetEnv(requestFile.item, scriptMode, warnings);
      if (setenv && Object.keys(setenv).length > 0) {
        steps.push({setenv});
      }
      const testScript = unsupportedPostmanScript(requestFile.item, 'test', scriptMode);
      if (testScript) {
        steps.push({js: testScript});
      }
    }
    tests.push({
      path: `tests/${groupKey === 'collection' ? 'collection' : groupKey}.mmt`,
      title,
      groupKey,
      data: {
        type: 'test',
        title,
        description: `Generated from Postman collection folder "${title}".`,
        tags: ['postman'],
        import: imports,
        steps,
      },
    });
  }
  return tests;
}

function buildPostmanSuites(postmanJson: any, tests: PostmanTestFile[], useProjectRootImports: boolean): Array<{path: string; title: string; data: SuiteData}> {
  const testByGroup = new Map(tests.map(test => [test.groupKey, test]));
  const folderTitles = new Map<string, string>();
  folderTitles.set('collection', postmanJson.info?.name || 'Postman Collection');
  collectFolderTitles(postmanJson.item || [], [], folderTitles);

  const groups = new Set<string>(['collection', ...tests.map(test => test.groupKey)]);
  for (const group of Array.from(groups)) {
    const parts = group === 'collection' ? [] : group.split('/');
    for (let index = 1; index < parts.length; index++) {
      groups.add(parts.slice(0, index).join('/'));
    }
  }

  return Array.from(groups)
      .sort((left, right) => groupDepth(right) - groupDepth(left) || left.localeCompare(right))
      .map(groupKey => {
        const title = folderTitles.get(groupKey) || (groupKey === 'collection' ? 'Postman Collection' : titleFromGroupKey(groupKey));
        const testsList = suiteEntriesForGroup(groupKey, testByGroup, groups, useProjectRootImports);
        return {
          path: `suites/${groupKey === 'collection' ? 'collection' : groupKey}.mmt`,
          title,
          data: {
            type: 'suite' as const,
            title,
            description: `Generated from Postman collection folder "${title}".`,
            tags: ['postman'],
            items: testsList.length > 0 ? testsList : ['then'],
          },
        };
      })
      .filter(suite => suite.data.items.length > 0 && suite.data.items[0] !== 'then');
}

function collectFolderTitles(items: PostmanWalkItem[], folders: string[], folderTitles: Map<string, string>): void {
  for (const item of items || []) {
    if (!Array.isArray(item.item)) {
      continue;
    }
    const nextFolders = [...folders, item.name || 'Folder'];
    const groupKey = nextFolders.map(slug).filter(Boolean).join('/');
    folderTitles.set(groupKey, item.name || titleFromGroupKey(groupKey));
    collectFolderTitles(item.item, nextFolders, folderTitles);
  }
}

function suiteEntriesForGroup(groupKey: string, testByGroup: Map<string, PostmanTestFile>, groups: Set<string>, useProjectRootImports: boolean): string[] {
  const entries: string[] = [];
  const ownTest = testByGroup.get(groupKey);
  if (ownTest) {
    entries.push(pathForSuiteReference(groupKey, ownTest.path, useProjectRootImports));
  }
  const childSuites = Array.from(groups)
      .filter(candidate => parentGroup(candidate) === groupKey)
      .sort();
  for (const child of childSuites) {
    if (entries.length > 0) {
      entries.push('then');
    }
    entries.push(pathForSuiteReference(groupKey, `suites/${child}.mmt`, useProjectRootImports));
  }
  return entries;
}

function buildPostmanExpect(item: PostmanWalkItem, scriptMode: 'translate' | 'preserve' | 'skip', warnings: string[]): Record<string, any> | undefined {
  const expect: Record<string, any> = {};
  const firstCode = Array.isArray(item.response) ? item.response.find(response => typeof response?.code === 'number')?.code : undefined;
  if (firstCode) {
    expect.status = `== ${firstCode}`;
  }
  if (scriptMode === 'skip') {
    return Object.keys(expect).length > 0 ? expect : undefined;
  }
  for (const script of getPostmanScripts(item, 'test')) {
    const statusMatches = script.matchAll(/(?:pm\.response\.to\.have\.status\(|pm\.expect\(\s*pm\.response\.code\s*\)\.to\.(?:eql|equal)\()\s*(\d+)\s*\)/g);
    for (const match of statusMatches) {
      expect.status = `== ${match[1]}`;
    }
    const jsonEquals = script.matchAll(/pm\.expect\(\s*pm\.response\.json\(\)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\.to\.(?:eql|equal)\(\s*(['"])(.*?)\2\s*\)/g);
    for (const match of jsonEquals) {
      expect[`body.${match[1]}`] = `== ${match[3]}`;
    }
    if (scriptMode === 'preserve' || hasUnsupportedPostmanScript(script)) {
      warnings.push(`Postman script on "${item.name || 'request'}" needs manual review.`);
    }
  }
  return Object.keys(expect).length > 0 ? expect : undefined;
}

function buildPostmanSetEnv(item: PostmanWalkItem, scriptMode: 'translate' | 'preserve' | 'skip', warnings: string[]): Record<string, any> | undefined {
  if (scriptMode === 'skip') {
    return undefined;
  }
  const setenv: Record<string, any> = {};
  for (const script of getPostmanScripts(item, 'test')) {
    const responseSets = script.matchAll(/pm\.(?:environment|collectionVariables)\.set\(\s*(['"])([^'"]+)\1\s*,\s*pm\.response\.json\(\)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g);
    for (const match of responseSets) {
      setenv[match[2]] = `body.${match[3]}`;
    }
    if (scriptMode === 'preserve' && script.includes('pm.')) {
      warnings.push(`Postman variable script on "${item.name || 'request'}" was preserved as a warning.`);
    }
  }
  return Object.keys(setenv).length > 0 ? setenv : undefined;
}

function getPostmanScripts(item: PostmanWalkItem, listen: 'test' | 'prerequest'): string[] {
  const scripts: string[] = [];
  for (const event of item.event || []) {
    if (event?.listen !== listen) {
      continue;
    }
    const exec = event?.script?.exec;
    if (Array.isArray(exec)) {
      scripts.push(exec.join('\n'));
    } else if (typeof exec === 'string') {
      scripts.push(exec);
    }
  }
  return scripts;
}

function unsupportedPostmanScript(item: PostmanWalkItem, listen: 'test' | 'prerequest', scriptMode: 'translate' | 'preserve' | 'skip'): string | undefined {
  if (scriptMode === 'skip') {
    return undefined;
  }
  const scripts = getPostmanScripts(item, listen)
      .map(script => script.trim())
      .filter(script => scriptMode === 'preserve' || hasUnsupportedPostmanScript(script));
  if (scripts.length === 0) {
    return undefined;
  }
  return [
    `// Original Postman ${listen} script. Review before relying on it at runtime.`,
    ...scripts,
  ].join('\n');
}

function hasUnsupportedPostmanScript(script: string): boolean {
  const reduced = script
      .replace(/pm\.response\.to\.have\.status\(\s*\d+\s*\)/g, '')
      .replace(/pm\.expect\(\s*pm\.response\.code\s*\)\.to\.(?:eql|equal)\(\s*\d+\s*\)/g, '')
      .replace(/pm\.expect\(\s*pm\.response\.json\(\)\.[A-Za-z_$][A-Za-z0-9_$]*\s*\)\.to\.(?:eql|equal)\(\s*(['"]).*?\1\s*\)/g, '')
      .replace(/pm\.(?:environment|collectionVariables)\.set\(\s*(['"])[^'"]+\1\s*,\s*pm\.response\.json\(\)\.[A-Za-z_$][A-Za-z0-9_$]*\s*\)/g, '');
  return /\bpm\./.test(reduced);
}

function buildPostmanEnv(postmanJson: any, force: boolean): any | undefined {
  const variables = Array.isArray(postmanJson.variable) ? postmanJson.variable : [];
  const out: Record<string, any> = {};
  for (const variable of variables) {
    if (!variable?.key) {
      continue;
    }
    out[variable.key] = {default: variable.value ?? ''};
  }
  if (Object.keys(out).length === 0 && !force) {
    return undefined;
  }
  const env: any = {
    type: 'env',
  };
  if (Object.keys(out).length > 0) {
    env.variables = out;
    env.presets = {
      postman: {
        default: Object.fromEntries(Object.keys(out).map(key => [key, 'default'])),
      },
    };
  }
  return env;
}

function importPathForTest(groupKey: string, apiPath: string, useProjectRootImports: boolean): string {
  if (useProjectRootImports) {
    return `+/${apiPath}`;
  }
  const testDepth = groupKey === 'collection' ? 1 : groupKey.split('/').filter(Boolean).length;
  return `${'../'.repeat(testDepth)}${apiPath}`;
}

function pathForSuiteReference(groupKey: string, targetPath: string, useProjectRootImports: boolean): string {
  if (useProjectRootImports) {
    return `+/${targetPath}`;
  }
  const suiteDepth = groupKey === 'collection' ? 1 : groupKey.split('/').filter(Boolean).length;
  return `${'../'.repeat(suiteDepth)}${targetPath}`;
}

function parentGroup(groupKey: string): string | undefined {
  if (groupKey === 'collection') {
    return undefined;
  }
  const slash = groupKey.lastIndexOf('/');
  return slash >= 0 ? groupKey.slice(0, slash) : 'collection';
}

function groupDepth(groupKey: string): number {
  return groupKey === 'collection' ? 0 : groupKey.split('/').filter(Boolean).length;
}

function titleFromGroupKey(groupKey: string): string {
  if (groupKey === 'collection') {
    return 'Postman Collection';
  }
  const last = groupKey.split('/').filter(Boolean).pop() || groupKey;
  return last.split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf('.');
  const base = dot >= 0 ? path.slice(0, dot) : path;
  const ext = dot >= 0 ? path.slice(dot) : '';
  let index = 2;
  while (used.has(`${base}-${index}${ext}`)) {
    index++;
  }
  const next = `${base}-${index}${ext}`;
  used.add(next);
  return next;
}

function uniqueAlias(value: string, used: Set<string>): string {
  let alias = value || 'request';
  if (!used.has(alias)) {
    used.add(alias);
    return alias;
  }
  let index = 2;
  while (used.has(`${alias}${index}`)) {
    index++;
  }
  alias = `${alias}${index}`;
  used.add(alias);
  return alias;
}

function slug(value: string): string {
  return slugValue(value);
}

function basename(filePath: string): string {
  return String(filePath || '').split(/[/\\]/).pop() || 'converted';
}
