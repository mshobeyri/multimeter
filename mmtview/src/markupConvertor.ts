import {js2xml, xml2js} from 'xml-js';
import YAML from 'yaml';

function parseYamlDoc(yamlString: string): any {
  return YAML.parseDocument(yamlString);
}


function parseYaml(yamlString: string): any {
  try {
    return YAML.parse(yamlString);
  } catch (e) {
    console.error('Failed to parse YAML:', e);
    return null;
  }
}

function packYaml(obj: any): string {
  try {
    return YAML.stringify(obj);
  } catch (e) {
    console.error('Failed to stringify YAML:', e);
    return '';
  }
}


function formatBody(format: string, body: string|object): string {
  if (body === null) {
    return '';
  }
  try {
    if (format === 'json') {
      const obj = typeof body === 'string' ? YAML.parse(body) : body;
      return JSON.stringify(obj, null, 2);
    }
    if (format === 'xml') {
      const obj = typeof body === 'string' ? YAML.parse(body) : body;
      return js2xml(obj, {compact: true, spaces: 2});
    }
    if (format === 'text') {
      return typeof body === 'string' ? body : String(body);
    }
    return typeof body === 'string' ? body : YAML.stringify(body);
  } catch {
    return typeof body === 'string' ? body : String(body);
  }
}

function flattenXmlObj(obj: any): any {
  // This is a naive flatten for simple XML structures
  if (typeof obj !== 'object' || obj === null) return obj;
  const result: any = {};
  for (const key in obj) {
    if (typeof obj[key] === 'object' && '_text' in obj[key]) {
      result[key] = obj[key]._text;
    } else {
      result[key] = flattenXmlObj(obj[key]);
    }
  }
  return result;
}

function formattedBodyToYamlObject(format: string, body: string): any {
  try {
    if (format === 'json') {
      return JSON.parse(body);
    }
    if (format === 'xml') {
      // Convert XML to JS object, then try to normalize it
      const jsObj = xml2js(body, {compact: true});
      return flattenXmlObj(jsObj);
    }
    // Default: YAML
    return YAML.parse(body);
  } catch (e) {
    console.error('Failed to convert formatted body to YAML object:', e);
    return null;
  }
}

function beautify(format: string, value: string): string {
  try {
    if (format === 'json') {
      return JSON.stringify(JSON.parse(value), null, 2);
    }
    if (format === 'xml') {
      // Parse and re-stringify with xml-js for pretty output
      const jsObj = xml2js(value, {compact: true});
      return js2xml(jsObj, {compact: true, spaces: 2});
    }
    // Add YAML or other formats as needed
  } catch {
    // If invalid, return as is
    return value;
  }
  return value;
}


export {
  parseYaml,
  parseYamlDoc,
  packYaml,
  formatBody,
  formattedBodyToYamlObject,
  beautify
};
export default parseYaml;