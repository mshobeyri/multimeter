import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';
import {Format} from './CommonData';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {parseYamlWithOmitKeyword} from './omitKeyword';
import {restoreOmitKeyword} from './omitKeyword';
import {isOmitSentinel} from './omitKeyword';
import {applyDescriptionBlockLiteralStyles} from './multilineDescriptionYaml';
import {normalizeNewlines} from './textLines';

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
    // Monaco/Windows editors often produce CRLF; YAML double-quotes those as
    // visible `\r` escapes. Normalize before emit so .mmt files stay LF-only.
    const normalized = normalizeYamlStringNewlines(restored);
    const doc = new YAML.Document();
    doc.contents = doc.createNode(normalized);
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

/** Deep-normalize CRLF/CR to LF in string leaves destined for YAML output. */
function normalizeYamlStringNewlines(value: any): any {
  if (typeof value === 'string') {
    return normalizeNewlines(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeYamlStringNewlines);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, normalizeYamlStringNewlines(v)]));
  }
  return value;
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
    case 'binary':
      return 'application/octet-stream';
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
  if (typeof body === 'string') {
    body = normalizeNewlines(body);
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
    if (format === 'binary') {
      // Body is a file path string; do not re-encode
      return typeof body === 'string' ? body.trim() : String(body);
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
    // Windows Monaco bodies use CRLF; keep LF in the data model / YAML.
    const text = normalizeNewlines(body);
    if (format === 'json') {
      return JSON.parse(text);
    }
    if (isXmlFormat(format)) {
      // Convert XML to JS object, then try to normalize it
      const jsObj = xml2js(text, {compact: true});
      return flattenXmlObj(jsObj);
    }
    if (format === 'urlencoded') {
      return parseUrlEncodedBody(text);
    }
    if (format === 'binary') {
      // Keep the file path as a plain string for YAML round-trip
      return text;
    }
    if (format === 'text') {
      // Keep raw text (including XML pasted as text) — do not YAML-parse it.
      return text;
    }
    // Default: YAML
    return YAML.parse(text);
  } catch (e) {
    console.error('Failed to convert formatted body to YAML object:', e);
    return null;
  }
}

/**
 * Align UI body with YAML for diffs / write-back.
 * If the YAML-side body is structured (not plain text), pack the UI string
 * via {@link formattedBodyToYamlObject}. On pack failure, keep the UI text.
 */
function packBodyForYamlCompare(
    yamlBody: unknown,
    uiBody: unknown,
    format: Format,
): unknown {
  if (yamlBody == null || typeof yamlBody === 'string') {
    return uiBody;
  }
  if (typeof uiBody !== 'string') {
    return uiBody;
  }
  const packed = formattedBodyToYamlObject(format, uiBody);
  if (packed === null || packed === undefined) {
    return uiBody;
  }
  return packed;
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
  packBodyForYamlCompare,
  beautify,
  beautifyWithContentType
};

export default parseYaml;