
import parseYaml, {packYaml} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject, safeList} from './safer';

import {APIData} from './APIData';

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
      description: doc.description || '',
      tags: safeList(doc.tags),
      import: doc.import,
      inputs: doc.inputs,
      outputs: doc.outputs,
      extract: doc.extract,
      setenv: doc.setenv,
      protocol: doc.protocol || '',
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
  if (isNonEmptyObject(api.import)) {
    yamlObj.import = api.import;
  };
  if (isNonEmptyObject(api.inputs)) {
    yamlObj.inputs = api.inputs;
  };
  if (isNonEmptyObject(api.outputs)) {
    yamlObj.outputs = api.outputs;
  };
  if (isNonEmptyObject(api.extract)) {
    yamlObj.extract = api.extract;
  };
  if (isNonEmptyObject(api.setenv)) {
    yamlObj.setenv = api.setenv;
  };
  if (api.protocol) {
    yamlObj.protocol = api.protocol;
  };
  if (api.format) {
    yamlObj.format = api.format;
  };
  if (api.url) {
    yamlObj.url = api.url;
  };
  if (api.method) {
    yamlObj.method = api.method;
  };
  if (isNonEmptyObject(api.headers)) {
    yamlObj.headers = api.headers;
  };
  if (api.body && api.body !== '') {
    yamlObj.body = api.body;
  };
  if (isNonEmptyObject(api.query)) {
    yamlObj.query = api.query;
  };
  if (isNonEmptyObject(api.cookies)) {
    yamlObj.cookies = api.cookies;
  };
  if (isNonEmptyList(api.examples)) {
    yamlObj.examples = api.examples;
  };
  return packYaml(yamlObj);
}