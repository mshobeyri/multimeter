import { APIData, AuthConfig, ExampleData } from './APIData';
import { formatBody } from './markupConvertor';

export function openApiToAPI(openApiSpec: any): APIData[] {
  if (!openApiSpec || !openApiSpec.paths) {
    return [];
  }

  const apis: APIData[] = [];
  const baseUrl = openApiSpec.servers?.[0]?.url || '';

  // Iterate through all paths
  Object.entries(openApiSpec.paths).forEach(([p, pathItem]: [string, any]) => {
    // Iterate through all HTTP methods for this path
    Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method)) {
        return; // Skip non-HTTP methods
      }

      const title = operation.summary || operation.operationId || `${method.toUpperCase()} ${p}`;

      // Build headers from parameters
      const headers: Record<string, string> = {};
      const query: Record<string, string> = {};

      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === 'header') {
            headers[param.name] = param.example || param.schema?.example || '';
          } else if (param.in === 'query') {
            query[param.name] = param.example || param.schema?.example || '';
          }
        });
      }

      // Handle request body
      let body: string | object | undefined;
      let format: 'json' | 'xml' | 'text' = 'json';

      if (operation.requestBody?.content) {
        const contentTypes = Object.keys(operation.requestBody.content);
        const firstContentType = contentTypes[0];

        if (firstContentType) {
          if (firstContentType.includes('xml')) {
            format = 'xml';
          } else if (firstContentType.includes('text')) {
            format = 'text';
          }

          headers['Content-Type'] = firstContentType;

          const contentSpec = operation.requestBody.content[firstContentType];

          // Check for example at content level first (common for XML)
          if (contentSpec?.example) {
            body = typeof contentSpec.example === 'string' ? contentSpec.example : formatBody(format, contentSpec.example, true);
          }
          // Then check for example at schema level
          else if (contentSpec?.schema?.example) {
            body = typeof contentSpec.schema.example === 'string'
              ? contentSpec.schema.example
              : formatBody(format, contentSpec.schema.example, true);
          }
          // Generate example from schema properties
          else if (contentSpec?.schema?.properties) {
            const example: any = {};
            Object.entries(contentSpec.schema.properties).forEach(([propName, propSchema]: [string, any]) => {
              example[propName] = propSchema.example
                || propSchema.default
                || (propSchema.type === 'string' ? 'string'
                  : propSchema.type === 'number' ? 0
                  : propSchema.type === 'boolean' ? false
                  : null);
            });
            body = formatBody(format, example, true);
          }
          // For XML with string schema type, try to create a basic structure
          else if (format === 'xml' && contentSpec?.schema?.type === 'string') {
            body = '<root/>'; // Fallback XML structure
          }
        }
      }

      // Build full URL - handle path parameters
      let processedPath = p;
      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === 'path') {
            const example = param.example || param.schema?.example || `{${param.name}}`;
            processedPath = processedPath.replace(`{${param.name}}`, String(example));
          }
        });
      }

      const fullUrl = baseUrl + processedPath;

      // Resolve auth from operation or global security + securitySchemes
      const auth = resolveOpenApiAuth(operation, openApiSpec);

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

      // Clean up undefined fields
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

      attachOpenApiExamples(apiData, operation, format);

      apis.push(apiData);
    });
  });

  return apis;
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
  const schemes = spec.components?.securitySchemes || {};
  // Use the first security requirement's first scheme
  for (const req of secReqs) {
    const names = Object.keys(req || {});
    if (!names.length) {
      continue;
    }
    const schemeName = names[0];
    const scheme = schemes[schemeName];
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
