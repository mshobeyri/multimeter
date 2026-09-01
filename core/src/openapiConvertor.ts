import { APIData, AuthConfig, ExampleData } from './APIData';
import { formatBody } from './markupConvertor';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export function openApiToAPI(openApiSpec: any): APIData[] {
  if (!openApiSpec || !openApiSpec.paths) {
    return [];
  }

  const apis: APIData[] = [];
  const baseUrl = openApiSpec.servers?.[0]?.url || '';

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

      let processedPath = p;
      parameters.forEach((param: any) => {
        if (param.in === 'path') {
          const example = readOpenApiExampleValue(param) || `{${param.name}}`;
          processedPath = processedPath.replace(`{${param.name}}`, String(example));
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

      attachOpenApiExamples(apiData, operationForExamples, format);

      apis.push(apiData);
    });
  });

  return apis;
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

type NamedRequestExample = {name: string; description?: string; body: string};

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
    };
    if (typeof spec?.description === 'string' && spec.description) {
      example.description = spec.description;
    }
    examples.push(example);
  }
  return examples;
}

function attachOpenApiExamples(
    apiData: APIData, operation: any, format: 'json' | 'xml' | 'text'): void {
  const namedExamples = collectNamedRequestExamples(operation, format);
  if (namedExamples.length === 0) {
    return;
  }

  const defaultBody = typeof apiData.body === 'string'
    ? apiData.body
    : (apiData.body != null ? formatExampleBody(format, apiData.body) : namedExamples[0].body);
  if (!apiData.inputs) {
    apiData.inputs = {};
  }
  if (apiData.body !== '<<i:body>>') {
    apiData.inputs.body = defaultBody;
    apiData.body = '<<i:body>>';
  } else if (apiData.inputs.body === undefined) {
    apiData.inputs.body = defaultBody;
  }

  const examples: ExampleData[] = namedExamples.map((example) => {
    const item: ExampleData = {name: example.name};
    if (example.description) {
      item.description = example.description;
    }
    if (example.body !== apiData.inputs?.body) {
      item.inputs = {body: example.body};
    }
    return item;
  }).filter((example) => example.name || example.inputs || example.description);

  if (examples.length > 0) {
    apiData.examples = examples;
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
