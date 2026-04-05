
import {APIData} from './APIData';
import parseYaml, {packYaml, parseYamlStrict} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject, safeList} from './safer';

/** Valid root-level keys for type: api files. */
const VALID_API_ROOT_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'inputs', 'outputs', 'setenv',
  'url', 'query', 'protocol', 'format', 'method', 'headers', 'cookies',
  'body', 'examples',
]);

export function yamlToAPI(yamlContent: string): APIData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== 'object') {
      return {} as APIData;
    }
    // Directly map YAML fields to APIField
    return {
      type: doc.type || '',
      title: doc.title || '',
      description: typeof doc.description === 'string' ? doc.description.trimEnd() : '',
      tags: doc.tags,
      inputs: doc.inputs,
      outputs: doc.outputs,
      setenv: doc.setenv,
      protocol: doc.protocol || undefined,
      format: doc.format || '',
      url: doc.url || '',
      method: doc.method || '',
      headers: doc.headers || {},
      body: doc.body || '',
      query: doc.query || {},
      cookies: doc.cookies || {},
      examples: safeList(doc.examples),
    };
  } catch {
    return {} as APIData;
  }
}

/**
 * Parse an API YAML strictly: throws on YAML parse errors and validates
 * the resulting structure. Used in execution paths.
 */
export function yamlToAPIStrict(yamlContent: string): APIData {
  const doc = parseYamlStrict(yamlContent) as any;
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid API file: YAML content is empty or not an object');
  }
  if (doc.type !== 'api') {
    throw new Error(`Invalid API file: expected type "api" but got "${doc.type || '(none)'}"`);
  }
  if (!doc.url) {
    throw new Error('Invalid API file: missing required "url" field');
  }
  const unknownKeys = Object.keys(doc).filter(k => !VALID_API_ROOT_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid API file: unknown key(s): ${unknownKeys.map(k => `"${k}"`).join(', ')}`);
  }
  return {
    type: doc.type || '',
    title: doc.title || '',
    description: typeof doc.description === 'string' ? doc.description.trimEnd() : '',
    tags: doc.tags,
    inputs: doc.inputs,
    outputs: doc.outputs,
    setenv: doc.setenv,
    protocol: doc.protocol || undefined,
    format: doc.format || '',
    url: doc.url || '',
    method: doc.method || '',
    headers: doc.headers || {},
    body: doc.body || '',
    query: doc.query || {},
    cookies: doc.cookies || {},
    examples: safeList(doc.examples),
  };
}

export function apiToYaml(api: APIData): string {
  // Directly map APIField fields to YAML
  const yamlObj: Record<string, any> = {
    type: api.type,
    title: api.title,
  };
  if (api.description) {
    yamlObj.description = api.description;
  };
  if (isNonEmptyList(api.tags)) {
    yamlObj.tags = api.tags;
  };
  if (isNonEmptyObject(api.inputs)) {
    yamlObj.inputs = api.inputs;
  };
  if (isNonEmptyObject(api.outputs)) {
    yamlObj.outputs = api.outputs;
  };
  if (isNonEmptyObject(api.setenv)) {
    yamlObj.setenv = api.setenv;
  };
  if (api.url) {
    yamlObj.url = api.url;
  };
  if (isNonEmptyObject(api.query)) {
    yamlObj.query = api.query;
  };
  if (api.protocol) {
    yamlObj.protocol = api.protocol;
  };
  if (api.method) {
    yamlObj.method = api.method;
  };
  if (api.format) {
    yamlObj.format = api.format;
  };
  if (isNonEmptyObject(api.headers)) {
    yamlObj.headers = api.headers;
  };
  if (isNonEmptyObject(api.cookies)) {
    yamlObj.cookies = api.cookies;
  };
  if (api.body && api.body !== '') {
    yamlObj.body = api.body;
  };
  if (isNonEmptyList(api.examples)) {
    yamlObj.examples = api.examples;
  };
  return packYaml(yamlObj);
}