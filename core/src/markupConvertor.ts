import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';
import {Format} from './CommonData';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {parseYamlWithOmitKeyword} from './omitKeyword';
import {restoreOmitKeyword} from './omitKeyword';
import {isOmitSentinel} from './omitKeyword';
import {applyDescriptionBlockLiteralStyles} from './multilineDescriptionYaml';

/**
 * Quote YAML-unsafe expect/debug operators (`!=`, `!*`, `>`, …) before parsing.
 * Without this, YAML treats `!…` as tags and silently drops the operator
 * (e.g. `status: != 100` → `status: 100`).
 */
function prepareYaml(yamlString: string): string {
  return quoteExpectOperators(yamlString || '');
}

function parseYamlDoc(yamlString: string): any {
  const prepared = prepareYaml(yamlString);
  const doc = YAML.parseDocument(prepared);
  if (doc.errors?.length) {
    // Fall back to original-text filtering so residual tag errors on unquoted
    // lines (if any) are still suppressed against the editor buffer.
    doc.errors = filterOperatorYamlErrors(yamlString, doc.errors);
  }
  return doc;
}


function parseYaml(yamlString: string): any {
  try {
    return parseYamlWithOmitKeyword(prepareYaml(yamlString), false);
  } catch (e) {
    return null;
  }
}

/**
 * Parse YAML strictly: throws on parse errors instead of returning null.
 * Use this in execution paths where errors must be surfaced.
 */
function parseYamlStrict(yamlString: string): any {
  return parseYamlWithOmitKeyword(prepareYaml(yamlString), true);
}

function applyKeywordScalarStyles(node: any, original: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const hasScalarValue = Object.prototype.hasOwnProperty.call(node, 'value');
  if (hasScalarValue && typeof node.value === 'string') {
    if (isOmitSentinel(original)) {
      node.type = 'PLAIN';
      return;
    }
    if ((original === 'omit' || original === 'null') &&
        typeof original === 'string') {
      node.type = 'QUOTE_DOUBLE';
    }
    return;
  }

  if (Array.isArray(node.items)) {
    const isArrayOriginal = Array.isArray(original);
    for (let i = 0; i < node.items.length; i++) {
      const item = node.items[i];
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        const key = item.key && typeof item.key === 'object' ?
          item.key.value :
          undefined;
        const nextOriginal =
          original && typeof original === 'object' && !Array.isArray(original) &&
            key !== undefined ?
            (original as Record<string, any>)[String(key)] :
            undefined;
        applyKeywordScalarStyles(item.value, nextOriginal);
      } else {
        const nextOriginal = isArrayOriginal ? original[i] : undefined;
        applyKeywordScalarStyles(item, nextOriginal);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    applyKeywordScalarStyles(node.key, undefined);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    applyKeywordScalarStyles(node.value, original);
  }
}

function packYaml(obj: any): string {
  try {
    const restored = restoreOmitKeyword(obj);
    const doc = new YAML.Document();
    doc.contents = doc.createNode(restored);
    applyKeywordScalarStyles(doc.contents, obj);
    applyDescriptionBlockLiteralStyles(doc.contents);
    return emitUnquotedOperators(doc.toString({
      aliasDuplicateObjects: false,
      blockQuote: 'literal',
      lineWidth: 0,
    } as any));
  } catch (e) {
    return '';
  }
}

function isXmlFormat(format: Format): boolean {
  return format === 'xml' || format === 'xmle';
}

/** Content-Type for a body format (without charset). */
function contentTypeForFormat(format: Format): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'xml':
    case 'xmle':
      return 'application/xml';
    case 'urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'text':
    default:
      return 'text/plain';
  }
}

function formValueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function objectToUrlEncoded(obj: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    params.append(key, formValueToString(value));
  }
  return params.toString();
}

function formatUrlEncodedBody(body: string|object): string {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) {
      return '';
    }
    try {
      const parsed = YAML.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return objectToUrlEncoded(parsed as Record<string, unknown>);
      }
    } catch {
      // Keep as raw string (already encoded or plain text)
    }
    return trimmed;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return objectToUrlEncoded(body as Record<string, unknown>);
  }
  return body == null ? '' : String(body);
}

function parseUrlEncodedBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(body);
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
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
    format: Format, body: string|object,
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
    if (format === 'urlencoded') {
      return formatUrlEncodedBody(body);
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
    format: Format, body: string): any {
  try {
    if (format === 'json') {
      return JSON.parse(body);
    }
    if (isXmlFormat(format)) {
      // Convert XML to JS object, then try to normalize it
      const jsObj = xml2js(body, {compact: true});
      return flattenXmlObj(jsObj);
    }
    if (format === 'urlencoded') {
      return parseUrlEncodedBody(body);
    }
    // Default: YAML
    return YAML.parse(body);
  } catch (e) {
    console.error('Failed to convert formatted body to YAML object:', e);
    return null;
  }
}

function beautify(format: Format, value: string): string {
  try {
    if (format === 'json') {
      return JSON.stringify(JSON.parse(value), null, 2);
    }
    if (isXmlFormat(format)) {
      return formatXmlBody(value, true, format === 'xmle');
    }
    if (format === 'urlencoded') {
      return objectToUrlEncoded(parseUrlEncodedBody(value));
    }
    // Add YAML or other formats as needed
  } catch {
    // If invalid, return as is
    return value;
  }
  return value;
}

function beautifyWithContentType(contentType: string, value: string): string {
  const trimmedValue = value.trimStart();
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('json') || trimmedValue.startsWith('{') ||
      trimmedValue.startsWith('[')) {
    return beautify('json', value);
  }
  if (ct.includes('xml') || trimmedValue.startsWith('<')) {
    return beautify('xml', value);
  }
  if (ct.includes('urlencoded') || ct.includes('x-www-form-urlencoded')) {
    return beautify('urlencoded', value);
  }
  return value;
}

export {
  parseYaml,
  parseYamlStrict,
  parseYamlDoc,
  packYaml,
  formatBody,
  contentTypeForFormat,
  flattenXmlObj,
  formattedBodyToYamlObject,
  beautify,
  beautifyWithContentType
};

export default parseYaml;