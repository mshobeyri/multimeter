import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';
import {Format} from './CommonData';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {parseYamlWithOmitKeyword} from './omitKeyword';
import {restoreOmitKeyword} from './omitKeyword';
import {isOmitSentinel} from './omitKeyword';
import {applyDescriptionBlockLiteralStyles} from './multilineDescriptionYaml';
import {normalizeNewlines} from './textLines';
import {mergeYamlValue} from './yamlAstMerge';

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

function packYaml(obj: any, originalYaml?: string): string {
  try {
    const restored = restoreOmitKeyword(obj);
    // Monaco/Windows editors often produce CRLF; YAML double-quotes those as
    // visible `\r` escapes. Normalize before emit so .mmt files stay LF-only.
    const normalized = normalizeYamlStringNewlines(restored);
    if (typeof originalYaml === 'string' && originalYaml.length > 0) {
      const doc = parseYamlDoc(originalYaml);
      if (doc?.contents) {
        const merged = mergeYamlValue(doc, doc.contents, normalized);
        if (merged !== doc.contents) {
          doc.contents = merged as typeof doc.contents;
        }
        applyKeywordScalarStyles(doc.contents, obj);
        return stringifyYamlDocument(doc);
      }
    }
    const doc = new YAML.Document();
    doc.contents = doc.createNode(normalized);
    applyKeywordScalarStyles(doc.contents, obj);
    return stringifyYamlDocument(doc);
  } catch (e) {
    return '';
  }
}

function stringifyYamlDocument(doc: YAML.Document): string {
  applyDescriptionBlockLiteralStyles(doc.contents);
  return emitUnquotedOperators(doc.toString({
    aliasDuplicateObjects: false,
    blockQuote: 'literal',
    lineWidth: 0,
  } as any));
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
    case 'multipart':
      return 'multipart/form-data';
    case 'none':
      return '';
    case 'html':
      return 'text/html';
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

/** Parse YAML/JSON/XML text or pass structured objects through for format conversion. */
function coerceBodyToStructuredObject(body: string|object): string|object {
  if (typeof body !== 'string') {
    return body;
  }
  const normalized = normalizeNewlines(body);
  const trimmed = normalized.trimStart();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('<')) {
    return body;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(normalized);
    } catch {
      // fall through
    }
  }
  try {
    const parsed = YAML.parse(normalized);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // fall through
  }
  return normalized;
}

function formatXmlBody(body: string|object, pretty: boolean, expanded: boolean): string {
  const coerced = coerceBodyToStructuredObject(body);
  if (coerced === '') {
    return '';
  }
  const xmlObj = typeof coerced === 'string' ? xml2js(coerced, {compact: true}) : coerced;
  return js2xml(xmlObj, {
    compact: true,
    spaces: pretty ? 2 : 0,
    fullTagEmptyElement: expanded
  });
}

const HTML_VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const HTML_RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

/** Indent HTML without requiring well-formed XML (real pages like google.com). */
function formatHtmlLenient(html: string): string {
  const normalized = normalizeNewlines(html);
  const lines: string[] = [];
  let indent = 0;
  let i = 0;

  const pushLine = (text: string, level = indent) => {
    const trimmed = text.trim();
    if (trimmed) {
      lines.push(`${'  '.repeat(level)}${trimmed}`);
    }
  };

  while (i < normalized.length) {
    if (normalized.slice(i, i + 4) === '<!--') {
      const commentEnd = normalized.indexOf('-->', i + 4);
      if (commentEnd === -1) {
        pushLine(normalized.slice(i));
        break;
      }
      pushLine(normalized.slice(i, commentEnd + 3));
      i = commentEnd + 3;
      continue;
    }

    if (normalized[i] !== '<') {
      const next = normalized.indexOf('<', i);
      const text = normalized.slice(i, next === -1 ? undefined : next);
      pushLine(text);
      i = next === -1 ? normalized.length : next;
      continue;
    }

    const tagEnd = normalized.indexOf('>', i);
    if (tagEnd === -1) {
      pushLine(normalized.slice(i));
      break;
    }

    const tag = normalized.slice(i, tagEnd + 1);
    const tagName = tag.match(/^<\/?([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
    const isClosing = tag.startsWith('</');
    const isSelfClosing = /\/>\s*$/.test(tag);
    const isSpecial = tag.startsWith('<!') || tag.startsWith('<?');

    if (!isClosing && tagName && HTML_RAW_TEXT_ELEMENTS.has(tagName)) {
      const closeTag = `</${tagName}>`;
      const closeIdx = normalized.toLowerCase().indexOf(closeTag, tagEnd + 1);
      pushLine(tag);
      if (closeIdx !== -1) {
        pushLine(normalized.slice(tagEnd + 1, closeIdx), indent + 1);
        pushLine(closeTag);
        i = closeIdx + closeTag.length;
        continue;
      }
    }

    if (isClosing && tagName) {
      indent = Math.max(0, indent - 1);
      pushLine(tag);
      i = tagEnd + 1;
      continue;
    }

    pushLine(tag);
    if (!isSelfClosing && !isSpecial && tagName && !HTML_VOID_ELEMENTS.has(tagName)) {
      indent++;
    }
    i = tagEnd + 1;
  }

  return lines.join('\n');
}

function formatHtmlBody(body: string): string {
  try {
    return formatXmlBody(body, true, true);
  } catch {
    try {
      return formatHtmlLenient(body);
    } catch {
      return body;
    }
  }
}

/** Normalize JSON/YAML/XML text or xml-js objects into a plain JSON object. */
function normalizeBodyToJsonObject(body: string|object): unknown {
  if (body === null || body === undefined) {
    return body;
  }
  if (typeof body === 'object') {
    return flattenXmlObj(body);
  }
  const normalized = normalizeNewlines(body);
  if (normalized.trim() === '') {
    return '';
  }
  const coerced = coerceBodyToStructuredObject(normalized);
  if (coerced === '') {
    return '';
  }
  if (typeof coerced === 'object') {
    return flattenXmlObj(coerced);
  }
  const trimmed = coerced.trimStart();
  if (trimmed.startsWith('<')) {
    try {
      return flattenXmlObj(xml2js(coerced, {compact: true}));
    } catch {
      return coerced;
    }
  }
  try {
    return JSON.parse(coerced);
  } catch {
    try {
      return YAML.parse(coerced);
    } catch {
      return coerced;
    }
  }
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
      const obj = normalizeBodyToJsonObject(body);
      // If parsing produced null (e.g., empty input), keep it empty
      if (obj === null || obj === undefined || obj === '') {
        return '';
      }
      if (typeof obj === 'string') {
        return obj;
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
    if (format === 'multipart') {
      if (Array.isArray(body)) {
        return JSON.stringify(body, null, pretty ? 2 : 0);
      }
      if (body && typeof body === 'object') {
        return JSON.stringify(body, null, pretty ? 2 : 0);
      }
      return typeof body === 'string' ? body : String(body ?? '');
    }
    if (format === 'html') {
      if (typeof body !== 'string') {
        return JSON.stringify(body, null, pretty ? 2 : 0);
      }
      return pretty ? formatHtmlBody(body) : body;
    }
    if (format === 'text' || format === 'none') {
      return typeof body === 'string' ?
          body :
          JSON.stringify(body, null, pretty ? 2 : 0);
    }
    return typeof body === 'string' ? body : YAML.stringify(body);
  } catch {
    return typeof body === 'string' ? body : String(body);
  }
}

/**
 * Collapse `xml-js` compact nodes for YAML round-trips:
 * text-only elements become their text, repeated elements stay arrays, and
 * attributes are preserved so converting back to XML keeps them.
 */
function flattenXmlObj(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(flattenXmlObj);
  }
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === '_text') {
    return obj._text;
  }
  const result: any = {};
  for (const key of keys) {
    result[key] = flattenXmlObj(obj[key]);
  }
  return result;
}

function formattedBodyToYamlObject(
    format: Format, body: string): any {
  try {
    // Windows Monaco bodies use CRLF; keep LF in the data model / YAML.
    const text = normalizeNewlines(body);
    if (format === 'json') {
      return normalizeBodyToJsonObject(text);
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
    if (format === 'multipart') {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    if (format === 'text' || format === 'html' || format === 'none') {
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
    if (format === 'json' || format === 'multipart') {
      return JSON.stringify(JSON.parse(value), null, 2);
    }
    if (isXmlFormat(format)) {
      return formatXmlBody(value, true, format === 'xmle');
    }
    if (format === 'urlencoded') {
      return objectToUrlEncoded(parseUrlEncodedBody(value));
    }
    if (format === 'html') {
      return formatHtmlBody(value);
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
  if (ct.includes('html')) {
    return formatHtmlBody(value);
  }
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
  stringifyYamlDocument,
  formatBody,
  contentTypeForFormat,
  flattenXmlObj,
  formattedBodyToYamlObject,
  packBodyForYamlCompare,
  beautify,
  beautifyWithContentType
};

export default parseYaml;