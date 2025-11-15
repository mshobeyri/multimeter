import { APIData } from './APIData';

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
            body = contentSpec.example;
          }
          // Then check for example at schema level
          else if (contentSpec?.schema?.example) {
            body = typeof contentSpec.schema.example === 'string'
              ? contentSpec.schema.example
              : JSON.stringify(contentSpec.schema.example, null, 2);
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
            body = format === 'xml' ? JSON.stringify(example, null, 2) : JSON.stringify(example, null, 2);
          }
          // For XML with string schema type, try to create a basic structure
          else if (format === 'xml' && contentSpec?.schema?.type === 'string') {
            body = '<root></root>'; // Fallback XML structure
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

      apis.push(apiData);
    });
  });

  return apis;
}
