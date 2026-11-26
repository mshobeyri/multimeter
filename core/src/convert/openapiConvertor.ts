import { APIData, AuthConfig, ExampleData } from '../data/APIData';
import { EnvData, EnvVariableValue } from '../data/EnvData';
import { slugValue } from '../util/identifierUtils';
import { formatBody } from '../parse/markupConvertor';
import { OMIT_SENTINEL } from '../tokens/omitKeyword';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const SERVER_VAR_RE = /\{([a-zA-Z0-9._-]+)\}/g;
const SERVER_VAR_NAME_RE = /^[A-Za-z0-9._-]+$/;

export type OpenApiPrimaryServer = {
  urlTemplate: string;
  variables: Record<string, {default?: string; enum?: string[]}>;
};

/** Build a concrete server URL from Swagger 2.0 `host`, `basePath`, and `schemes`. */
export function buildSwagger2ServerUrl(spec: any): string {
  if (!spec?.swagger) {
    return '';
  }
  const host = String(spec?.host || '').trim().replace(/\/+$/, '');
  if (!host) {
    return '';
  }
  const schemes = Array.isArray(spec?.schemes) && spec.schemes.length > 0
    ? spec.schemes
    : ['https'];
  const scheme = String(schemes[0] || 'https').replace(/:$/, '');
  let basePath = String(spec?.basePath || '').trim();
  if (basePath === '/') {
    basePath = '';
  } else if (basePath) {
    basePath = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  }
  return `${scheme}://${host}${basePath}`;
}

/**
 * Read `servers[0]` into a URL template plus variable defs.
 * YAML often parses unquoted `{base_url}` as `{base_url: null}` — recover that here.
 */
export function readOpenApiPrimaryServer(spec: any): OpenApiPrimaryServer {
  const server = spec?.servers?.[0];
  if (!server) {
    const swagger2Url = spec?.swagger ? buildSwagger2ServerUrl(spec) : '';
    return {urlTemplate: swagger2Url, variables: {}};
  }

  const variables: Record<string, {default?: string; enum?: string[]}> = {};
  if (server.variables && typeof server.variables === 'object' && !Array.isArray(server.variables)) {
    for (const [name, def] of Object.entries(server.variables)) {
      if (def && typeof def === 'object') {
        variables[name] = def as {default?: string; enum?: string[]};
      }
    }
  }

  let urlTemplate = normalizeOpenApiServerUrl(server.url);
  const recovered = recoverYamlFlowMappingServerUrl(server.url);
  if (recovered?.defaultValue && !variables[recovered.name]?.default) {
    variables[recovered.name] = {...variables[recovered.name], default: recovered.defaultValue};
  }

  return {urlTemplate, variables};
}

function recoverYamlFlowMappingServerUrl(raw: unknown):
    {name: string; template: string; defaultValue?: string} | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length !== 1) {
    return undefined;
  }
  const [name, value] = entries[0];
  if (!SERVER_VAR_NAME_RE.test(name)) {
    return undefined;
  }
  if (value == null || value === '') {
    return {name, template: `{${name}}`};
  }
  if (typeof value === 'string') {
    return {name, template: `{${name}}`, defaultValue: value};
  }
  return undefined;
}

/** Coerce parsed OpenAPI server `url` values into a template string. */
export function normalizeOpenApiServerUrl(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw;
  }
  const recovered = recoverYamlFlowMappingServerUrl(raw);
  return recovered?.template || '';
}

export function listOpenApiServerVariableNames(serverUrl: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  SERVER_VAR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SERVER_VAR_RE.exec(serverUrl)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Replace OpenAPI `{name}` server variables with Multimeter `<<e:name>>` tokens. */
export function openApiServerUrlToMmtUrl(serverUrl: string): string {
  return serverUrl.replace(SERVER_VAR_RE, '<<e:$1>>');
}

export function resolveOpenApiBaseUrl(openApiSpec: any): string {
  const {urlTemplate} = readOpenApiPrimaryServer(openApiSpec);
  return openApiServerUrlToMmtUrl(urlTemplate);
}

function envChoiceKeyForValue(value: string, used: Set<string>): string {
  const base = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) ? value : slugValue(value);
  let key = base || 'value';
  if (!used.has(key)) {
    used.add(key);
    return key;
  }
  let index = 2;
  while (used.has(`${key}_${index}`)) {
    index++;
  }
  const unique = `${key}_${index}`;
  used.add(unique);
  return unique;
}

/** Build `type: env` from OpenAPI `servers[0].variables` when the server URL uses `{var}` placeholders. */
export function buildOpenApiEnvFromSpec(openApiSpec: any): EnvData | undefined {
  const {urlTemplate, variables: serverVars} = readOpenApiPrimaryServer(openApiSpec);
  const names = listOpenApiServerVariableNames(urlTemplate);
  if (names.length === 0) {
    return undefined;
  }

  const variables: Record<string, EnvVariableValue> = {};
  const presetChoices: Record<string, string> = {};

  for (const name of names) {
    const spec = serverVars[name];
    const defaultVal = spec?.default != null ? String(spec.default) : '';
    if (Array.isArray(spec?.enum) && spec.enum.length > 0) {
      const choices: Record<string, string> = {};
      const usedKeys = new Set<string>();
      for (const entry of spec.enum) {
        const val = String(entry);
        const key = envChoiceKeyForValue(val, usedKeys);
        choices[key] = val;
      }
      const defaultKey = Object.entries(choices).find(([, val]) => val === defaultVal)?.[0]
        || Object.keys(choices)[0];
      variables[name] = choices;
      presetChoices[name] = defaultKey;
    } else if (defaultVal) {
      variables[name] = {default: defaultVal};
      presetChoices[name] = 'default';
    } else {
      variables[name] = {default: ''};
      presetChoices[name] = 'default';
    }
  }

  return {
    type: 'env',
    variables,
    presets: {
      openapi: {
        default: presetChoices,
      },
    },
  };
}

export function openApiToAPI(openApiSpec: any): APIData[] {
  if (!openApiSpec || !openApiSpec.paths) {
    return [];
  }

  const apis: APIData[] = [];
  const baseUrl = resolveOpenApiBaseUrl(openApiSpec);

  Object.entries(openApiSpec.paths).forEach(([p, pathItem]: [string, any]) => {
    Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
      if (!HTTP_METHODS.has(method)) {
        return;
      }

      const title = operation.summary || operation.operationId || `${method.toUpperCase()} ${p}`;
      const parameters = mergeOpenApiParameters(openApiSpec, pathItem, operation);
      const requestBody = resolveOpenApiNode(openApiSpec, operation.requestBody);

      const headers: Record<string, string> = {};
      const query: Record<string, string> = {};

      parameters.forEach((param: any) => {
        if (param.in === 'header') {
          headers[param.name] = readOpenApiExampleValue(param);
        } else if (param.in === 'query') {
          query[param.name] = readOpenApiExampleValue(param);
        }
      });

      let body: string | object | undefined;
      let format: 'json' | 'xml' | 'text' = 'json';

      if (requestBody?.content) {
        const contentTypes = Object.keys(requestBody.content);
        const firstContentType = contentTypes[0];

        if (firstContentType) {
          if (firstContentType.includes('xml')) {
            format = 'xml';
          } else if (firstContentType.includes('text')) {
            format = 'text';
          }

          headers['Content-Type'] = firstContentType;

          const contentSpec = resolveOpenApiNode(openApiSpec, requestBody.content[firstContentType]);
          body = buildBodyFromContent(openApiSpec, contentSpec, format);
        }
      }

      const pathInputs: Record<string, string> = {};
      let processedPath = p;
      parameters.forEach((param: any) => {
        if (param.in === 'path' && param.name) {
          const inputKey = normalizeOpenApiInputKey(String(param.name));
          pathInputs[inputKey] = readOpenApiExampleValue(param);
          processedPath = processedPath.replace(
              `{${param.name}}`, `<<i:${inputKey}>>`);
        }
      });

      const fullUrl = baseUrl + processedPath;
      const auth = resolveOpenApiAuth(operation, openApiSpec);
      const operationForExamples = requestBody === operation.requestBody
        ? operation
        : {...operation, requestBody};

      const apiData: APIData = {
        type: 'api',
        title,
        description: operation.description,
        protocol: 'http',
        format,
        url: fullUrl,
        method: method as APIData['method'],
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        query: Object.keys(query).length > 0 ? query : undefined,
        body,
        auth,
        ...(Object.keys(pathInputs).length > 0 ? {inputs: pathInputs} : {}),
      } as APIData;

      if (!apiData.description) {
        delete (apiData as any).description;
      }
      if (!apiData.headers || Object.keys(apiData.headers).length === 0) {
        delete (apiData as any).headers;
      }
      if (!apiData.query || Object.keys(apiData.query).length === 0) {
        delete (apiData as any).query;
      }
      if (!apiData.body) {
        delete (apiData as any).body;
      }
      if (!apiData.auth) {
        delete (apiData as any).auth;
      }

      attachOpenApiExamples(apiData, operationForExamples, format, openApiSpec);

      apis.push(apiData);
    });
  });

  return apis;
}

function normalizeOpenApiInputKey(value: string): string {
  return String(value)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/__+/g, '_') || 'value';
}

function readOpenApiExampleValue(value: any): string {
  if (value == null) {
    return '';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  const example = value.example ?? value.schema?.example ?? value.schema?.default;
  return example == null ? '' : String(example);
}

function parameterKey(param: any): string {
  return `${param?.in || ''}:${param?.name || ''}`;
}

function mergeOpenApiParameters(spec: any, pathItem: any, operation: any): any[] {
  const merged = new Map<string, any>();
  const pathParams = Array.isArray(pathItem?.parameters) ? pathItem.parameters : [];
  const operationParams = Array.isArray(operation?.parameters) ? operation.parameters : [];

  for (const param of pathParams) {
    const resolved = resolveOpenApiNode(spec, param);
    if (resolved?.name && resolved?.in) {
      merged.set(parameterKey(resolved), resolved);
    }
  }
  for (const param of operationParams) {
    const resolved = resolveOpenApiNode(spec, param);
    if (resolved?.name && resolved?.in) {
      merged.set(parameterKey(resolved), resolved);
    }
  }
  return Array.from(merged.values());
}

function resolveInternalRef(spec: any, ref: string): any {
  if (!ref.startsWith('#/')) {
    return undefined;
  }
  const tokens = ref.slice(2).split('/').map(decodeJsonPointerToken);
  let current: any = spec;
  for (const token of tokens) {
    if (current == null) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

function decodeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveOpenApiNode(spec: any, node: any, seen: Set<string> = new Set()): any {
  if (node == null || typeof node !== 'object') {
    return node;
  }
  if (!node.$ref || typeof node.$ref !== 'string') {
    return node;
  }

  const ref = node.$ref;
  if (!ref.startsWith('#/')) {
    return node;
  }
  if (seen.has(ref)) {
    return node;
  }

  const target = resolveInternalRef(spec, ref);
  if (target == null) {
    return node;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(ref);
  const resolved = resolveOpenApiNode(spec, target, nextSeen);
  const {$ref, ...overrides} = node;
  if (Object.keys(overrides).length === 0) {
    return resolved;
  }
  if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
    return {...resolved, ...overrides};
  }
  return resolved;
}

function buildBodyFromContent(
    spec: any, contentSpec: any, format: 'json' | 'xml' | 'text'): string | object | undefined {
  if (!contentSpec) {
    return undefined;
  }
  if (contentSpec.example !== undefined) {
    return typeof contentSpec.example === 'string'
      ? contentSpec.example
      : formatBody(format, contentSpec.example, true);
  }

  const schema = resolveOpenApiNode(spec, contentSpec.schema);
  return buildBodyFromSchema(spec, schema, format);
}

function buildBodyFromSchema(
    spec: any, schema: any, format: 'json' | 'xml' | 'text', seen: Set<string> = new Set()): string | undefined {
  const resolved = resolveOpenApiNode(spec, schema, seen);
  if (!resolved) {
    return undefined;
  }
  if (resolved.example !== undefined) {
    return typeof resolved.example === 'string'
      ? resolved.example
      : formatBody(format, resolved.example, true);
  }
  if (resolved.properties && typeof resolved.properties === 'object') {
    const example: any = {};
    Object.entries(resolved.properties).forEach(([propName, propSchema]: [string, any]) => {
      const resolvedProp = resolveOpenApiNode(spec, propSchema, seen);
      example[propName] = readSchemaExampleValue(spec, resolvedProp, seen);
    });
    return formatBody(format, example, true);
  }
  if (format === 'xml' && resolved.type === 'string') {
    return '<root/>';
  }
  return undefined;
}

function readSchemaExampleValue(spec: any, schema: any, seen: Set<string> = new Set()): any {
  const resolved = resolveOpenApiNode(spec, schema, seen);
  if (!resolved) {
    return null;
  }
  if (resolved.example !== undefined) {
    return resolved.example;
  }
  if (resolved.default !== undefined) {
    return resolved.default;
  }
  if (resolved.enum && Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum[0];
  }
  if (resolved.type === 'string') {
    return 'string';
  }
  if (resolved.type === 'number' || resolved.type === 'integer') {
    return 0;
  }
  if (resolved.type === 'boolean') {
    return false;
  }
  if (resolved.type === 'array') {
    const item = readSchemaExampleValue(spec, resolved.items, seen);
    return item == null ? [] : [item];
  }
  if (resolved.properties && typeof resolved.properties === 'object') {
    const example: any = {};
    Object.entries(resolved.properties).forEach(([propName, propSchema]: [string, any]) => {
      example[propName] = readSchemaExampleValue(spec, propSchema, seen);
    });
    return example;
  }
  return null;
}

function formatExampleBody(format: 'json' | 'xml' | 'text', value: any): string {
  if (typeof value === 'string') {
    return value;
  }
  return formatBody(format, value, true);
}

type NamedRequestExample = {name: string; description?: string; body: string; value: any};
type NamedResponseExample = {
  name: string;
  description?: string;
  status: number;
  body: any;
};

const MISSING = Symbol('openapi-missing');

function collectNamedRequestExamples(
    operation: any, format: 'json' | 'xml' | 'text'): NamedRequestExample[] {
  const content = operation?.requestBody?.content;
  if (!content || typeof content !== 'object') {
    return [];
  }
  const contentTypes = Object.keys(content);
  const firstContentType = contentTypes[0];
  const named = firstContentType ? content[firstContentType]?.examples : undefined;
  if (!named || typeof named !== 'object' || Array.isArray(named)) {
    return [];
  }
  const examples: NamedRequestExample[] = [];
  for (const [key, spec] of Object.entries(named) as Array<[string, any]>) {
    const value = spec?.value ?? spec?.example;
    if (value === undefined) {
      continue;
    }
    const name = String(spec?.summary || spec?.name || key || '').trim() || key;
    const example: NamedRequestExample = {
      name,
      body: formatExampleBody(format, value),
      value,
    };
    if (typeof spec?.description === 'string' && spec.description) {
      example.description = spec.description;
    }
    examples.push(example);
  }
  return examples;
}

function parseJsonObject(value: unknown): Record<string, any>|null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // not JSON
  }
  return null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build a shared JSON body: keep common values, put omit + <<i:…>> on diverging
 * leaves (including whole-body omit when shapes are incompatible).
 */
function planJsonRequestBodies(
    namedExamples: NamedRequestExample[],
): {
  body: any;
  inputs: Record<string, any>;
  exampleInputs: Record<string, Record<string, any>>;
} {
  const objects = namedExamples.map((example) => parseJsonObject(example.value ?? example.body));
  if (objects.some((obj) => !obj) || objects.length === 0) {
    return planWholeBodyInputs(namedExamples);
  }

  const inputs: Record<string, any> = {};
  const exampleInputs: Record<string, Record<string, any>> = {};
  for (const example of namedExamples) {
    exampleInputs[example.name] = {};
  }
  let inputSeq = 0;
  const nextInputKey = (path: string[]): string => {
    const base = normalizeOpenApiInputKey(['body', ...path].join('_')) || `body_field_${inputSeq}`;
    let key = base;
    while (Object.prototype.hasOwnProperty.call(inputs, key)) {
      inputSeq += 1;
      key = `${base}_${inputSeq}`;
    }
    return key;
  };

  const merge = (values: any[], path: string[]): any => {
    const present = values.filter((v) => v !== MISSING);
    if (present.length === values.length && present.every((v) => valuesEqual(v, present[0]))) {
      return present[0];
    }
    if (present.length > 0 && present.every(isPlainObject) &&
        values.every((v) => v === MISSING || isPlainObject(v))) {
      const keySet = new Set<string>();
      for (const obj of present) {
        Object.keys(obj).forEach((k) => keySet.add(k));
      }
      const out: Record<string, any> = {};
      for (const key of keySet) {
        const childValues = values.map((v) =>
          (v !== MISSING && isPlainObject(v) && Object.prototype.hasOwnProperty.call(v, key))
            ? v[key]
            : MISSING);
        out[key] = merge(childValues, [...path, key]);
      }
      return out;
    }

    const inputKey = nextInputKey(path);
    inputs[inputKey] = OMIT_SENTINEL;
    namedExamples.forEach((example, idx) => {
      const value = values[idx];
      if (value === MISSING) {
        return;
      }
      exampleInputs[example.name][inputKey] = value;
    });
    return `<<i:${inputKey}>>`;
  };

  const body = merge(objects as any[], []);
  return {body, inputs, exampleInputs};
}

function planWholeBodyInputs(namedExamples: NamedRequestExample[]): {
  body: any;
  inputs: Record<string, any>;
  exampleInputs: Record<string, Record<string, any>>;
} {
  const inputs: Record<string, any> = {body: OMIT_SENTINEL};
  const exampleInputs: Record<string, Record<string, any>> = {};
  for (const example of namedExamples) {
    exampleInputs[example.name] = {body: example.body};
  }
  return {body: '<<i:body>>', inputs, exampleInputs};
}

function collectNamedResponseExamples(
    operation: any, spec: any, format: 'json' | 'xml' | 'text'): NamedResponseExample[] {
  const responses = operation?.responses;
  if (!responses || typeof responses !== 'object') {
    return [];
  }
  const statusKeys = Object.keys(responses).sort((a, b) => {
    const rank = (code: string) => {
      if (code === '200') {
        return 0;
      }
      if (code === '201') {
        return 1;
      }
      if (/^2\d\d$/.test(code)) {
        return 2;
      }
      if (code.toLowerCase() === 'default') {
        return 9;
      }
      return 5;
    };
    const ra = rank(a);
    const rb = rank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b);
  });

  const out: NamedResponseExample[] = [];
  for (const statusKey of statusKeys) {
    const status = /^\d+$/.test(statusKey) ? Number(statusKey) : 200;
    if (status >= 300 && statusKey.toLowerCase() !== 'default') {
      continue;
    }
    const response = resolveOpenApiNode(spec, responses[statusKey]);
    const content = response?.content;
    if (!content || typeof content !== 'object') {
      continue;
    }
    const contentTypes = Object.keys(content);
    const firstContentType = contentTypes[0];
    if (!firstContentType) {
      continue;
    }
    const contentSpec = resolveOpenApiNode(spec, content[firstContentType]);
    const named = contentSpec?.examples;
    if (named && typeof named === 'object' && !Array.isArray(named)) {
      for (const [key, exampleSpec] of Object.entries(named) as Array<[string, any]>) {
        const value = exampleSpec?.value ?? exampleSpec?.example;
        if (value === undefined) {
          continue;
        }
        const name = String(exampleSpec?.summary || exampleSpec?.name || key || '').trim() || key;
        const item: NamedResponseExample = {name, status, body: value};
        if (typeof exampleSpec?.description === 'string' && exampleSpec.description) {
          item.description = exampleSpec.description;
        }
        out.push(item);
      }
      continue;
    }
    if (contentSpec?.example !== undefined) {
      out.push({
        name: statusKey === 'default' ? 'default' : String(status),
        status,
        body: contentSpec.example,
      });
    }
  }
  return out;
}

function exampleLookupKey(name: string): string {
  return slugValue(name).replace(/-/g, '');
}

function attachResponseExpects(
    examples: ExampleData[],
    responseExamples: NamedResponseExample[],
): ExampleData[] {
  if (responseExamples.length === 0) {
    return examples;
  }
  const byKey = new Map<string, ExampleData>();
  for (const example of examples) {
    const id = example.id || example.title || '';
    if (id) {
      byKey.set(exampleLookupKey(id), example);
    }
  }
  const next = [...examples];
  let matchedAny = false;
  for (const response of responseExamples) {
    const expectMap: Record<string, any> = {
      status: response.status,
      body: response.body,
    };
    const key = exampleLookupKey(response.name);
    const existing = byKey.get(key);
    if (existing) {
      existing.expect = {...(existing.expect || {}), ...expectMap};
      if (!existing.description && response.description) {
        existing.description = response.description;
      }
      matchedAny = true;
      continue;
    }
    const created: ExampleData = {
      id: response.name,
      title: response.name,
      expect: expectMap,
    };
    if (response.description) {
      created.description = response.description;
    }
    next.push(created);
    byKey.set(key, created);
  }
  // No name overlap: give every request example the first success response expect.
  if (!matchedAny && examples.length > 0 && responseExamples.length > 0) {
    const primary = responseExamples[0];
    const fallbackExpect = {status: primary.status, body: primary.body};
    for (const example of next) {
      if (examples.includes(example) && !example.expect) {
        example.expect = {...fallbackExpect};
      }
    }
  }
  return next;
}

function attachOpenApiExamples(
    apiData: APIData,
    operation: any,
    format: 'json' | 'xml' | 'text',
    spec: any,
): void {
  const namedExamples = collectNamedRequestExamples(operation, format);
  const responseExamples = collectNamedResponseExamples(operation, spec, format);

  let examples: ExampleData[] = [];

  if (namedExamples.length === 1) {
    const only = namedExamples[0];
    const parsed = format === 'json' ? parseJsonObject(only.value ?? only.body) : null;
    apiData.body = parsed ?? only.body;
    const item: ExampleData = {id: only.name, title: only.name};
    if (only.description) {
      item.description = only.description;
    }
    examples = [item];
  } else if (namedExamples.length > 1) {
    if (!apiData.inputs) {
      apiData.inputs = {};
    }
    const plan = format === 'json'
      ? planJsonRequestBodies(namedExamples)
      : planWholeBodyInputs(namedExamples);
    apiData.body = plan.body;
    Object.assign(apiData.inputs, plan.inputs);
    examples = namedExamples.map((example) => {
      const item: ExampleData = {id: example.name, title: example.name};
      if (example.description) {
        item.description = example.description;
      }
      const overrides = plan.exampleInputs[example.name] || {};
      if (Object.keys(overrides).length > 0) {
        item.inputs = overrides;
      }
      return item;
    });
  }

  if (namedExamples.length === 0 && responseExamples.length === 0) {
    return;
  }

  examples = attachResponseExpects(examples, responseExamples);

  examples = examples.filter(
      (example) => example.id || example.inputs || example.description || example.expect);

  if (examples.length > 0) {
    apiData.examples = examples;
  }
  if (Object.keys(apiData.inputs || {}).length === 0) {
    delete (apiData as any).inputs;
  }
  if (apiData.body === undefined || apiData.body === null || apiData.body === '') {
    delete (apiData as any).body;
  }
}

function resolveOpenApiAuth(operation: any, spec: any): AuthConfig | undefined {
  const secReqs: any[] = operation.security ?? spec.security;
  if (!Array.isArray(secReqs) || secReqs.length === 0) {
    return undefined;
  }
  const schemes = spec.components?.securitySchemes || spec.securityDefinitions || {};
  for (const req of secReqs) {
    const names = Object.keys(req || {});
    if (!names.length) {
      continue;
    }
    const schemeName = names[0];
    const scheme = resolveOpenApiNode(spec, schemes[schemeName]);
    if (!scheme) {
      continue;
    }
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      return {type: 'bearer', token: 'i:token'};
    }
    if (scheme.type === 'http' && scheme.scheme === 'basic') {
      return {type: 'basic', username: 'i:username', password: 'i:password'};
    }
    if (scheme.type === 'apiKey') {
      const inField = scheme.in === 'query' ? 'query' : 'header';
      return {
        type: 'api-key',
        ...(inField === 'query' ? {query: scheme.name} : {header: scheme.name}),
        value: 'i:api_key',
      };
    }
    if (scheme.type === 'oauth2' && scheme.flows?.clientCredentials) {
      const cc = scheme.flows.clientCredentials;
      return {
        type: 'oauth2',
        grant: 'client_credentials',
        token_url: cc.tokenUrl || '',
        client_id: 'i:client_id',
        client_secret: 'i:client_secret',
        ...(cc.scopes ? {scope: Object.keys(cc.scopes).join(' ')} : {}),
      };
    }
  }
  return undefined;
}
