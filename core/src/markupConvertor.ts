import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';

function parseYamlDoc(yamlString: string): any {
  return YAML.parseDocument(yamlString);
}


function parseYaml(yamlString: string): any {
  try {
    return YAML.parse(yamlString);
  } catch (e) {
    return null;
  }
}

/**
 * Parse YAML strictly: throws on parse errors instead of returning null.
 * Use this in execution paths where errors must be surfaced.
 */
function parseYamlStrict(yamlString: string): any {
  return YAML.parse(yamlString);
}

function packYaml(obj: any): string {
  try {
    return YAML.stringify(obj, {aliasDuplicateObjects: false});
  } catch (e) {
    return '';
  }
}

function isXmlFormat(format: 'json'|'xml'|'xmle'|'text'): boolean {
  return format === 'xml' || format === 'xmle';
}

function formatXmlBody(body: string|object, pretty: boolean, expanded: boolean): string {
  const xmlObj = typeof body === 'string' ? xml2js(body, {compact: true}) : body;
  return js2xml(xmlObj, {
    compact: true,
    spaces: pretty ? 2 : 0,
    fullTagEmptyElement: expanded
  });
}

function formatBody(
    format: 'json'|'xml'|'xmle'|'text', body: string|object,
    pretty: boolean = true): string {
  // Normalize empty-ish inputs to empty string for display/editing purposes
  if (body === null || body === undefined) {
    return '';
  }
  if (typeof body === 'string' && body.trim() === '') {
    return '';
  }
  try {
    if (format === 'json') {
      const obj = typeof body === 'string' ? YAML.parse(body) : body;
      // If YAML.parse produced null (e.g., empty input), keep it empty
      if (obj === null || obj === undefined) {
        return '';
      }
      return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
    }
    if (isXmlFormat(format)) {
      return formatXmlBody(body, pretty, format === 'xmle');
    }
    if (format === 'text') {
      return typeof body === 'string' ?
          body :
          JSON.stringify(body, null, pretty ? 2 : 0);
    }
    return typeof body === 'string' ? body : YAML.stringify(body);
  } catch {
    return typeof body === 'string' ? body : String(body);
  }
}

function flattenXmlObj(obj: any): any {
  // This is a naive flatten for simple XML structures
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
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

function formattedBodyToYamlObject(
    format: 'json'|'xml'|'xmle'|'text', body: string): any {
  try {
    if (format === 'json') {
      return JSON.parse(body);
    }
    if (isXmlFormat(format)) {
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

function beautify(format: 'json'|'xml'|'xmle'|'text', value: string): string {
  try {
    if (format === 'json') {
      return JSON.stringify(JSON.parse(value), null, 2);
    }
    if (isXmlFormat(format)) {
      return formatXmlBody(value, true, format === 'xmle');
    }
    // Add YAML or other formats as needed
  } catch {
    // If invalid, return as is
    return value;
  }
  return value;
}

function beautifyWithContentType(contentType: string, value: string): string {
  if ((contentType && contentType.includes('json')) || value.startsWith('{') ||
      value.startsWith('[')) {
    return beautify('json', value);
  } else if (
      (contentType && contentType.includes('xml')) || value.startsWith('<')) {
    return beautify('xml', value);
  } else {
    return value;
  }
}

export {
  parseYaml,
  parseYamlStrict,
  parseYamlDoc,
  packYaml,
  formatBody,
  flattenXmlObj,
  formattedBodyToYamlObject,
  beautify,
  beautifyWithContentType
};

export default parseYaml;