import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';
import {Format} from './CommonData';
import {formatHtmlBody} from './htmlFormat';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {parseYamlWithOmitKeyword} from './omitKeyword';
import {restoreOmitKeyword} from './omitKeyword';
import {isOmitSentinel} from './omitKeyword';
import {
  isLiteralTokenValue,
  isTokenLikeScalar,
  restoreLiteralTokens,
} from './literalToken';
import {needsYamlDoubleQuotes} from './yamlValueConvert';
import {applyDescriptionBlockLiteralStyles} from './multilineDescriptionYaml';
import {normalizeNewlines} from './textLines';
import {mergeYamlValue} from './yamlAstMerge';
import {forceBlockStyleForStepSequences} from './yamlBlockSteps';
import {
  mapUnquotedDisplayRuntimeTokens,
  parseJsonWithRuntimeTokens,
  parseXmlTextWithRuntimeTokens,
  restoreAngleRuntimeTokensInUrlEncoded,
  reviveDisplayRuntimeTokensInValue,
  rewriteRuntimeLeavesToDisplayText,
  stringifyJsonWithRuntimeTokens,
  type RuntimeTokenValueContext,
} from './bodyRuntimeTokens';

/**
 * Rewrite Multimeter UI curly tokens `{{i|e|r|c:…}}` to `<<…>>` in raw YAML
 * *before* parse. Unquoted `{{r:uuid}}` is invalid YAML flow syntax
 * (`{` starts a map); angle form is a plain scalar. Skips double/single
 * quoted regions so `"{{r:uuid}}"` can stay a quoted literal. Postman-style
 * `{{var}}` without a prefix is left unchanged.
 */
export function normalizeCurlyTokensInYamlSource(yamlString: string): string {
  const src = String(yamlString ?? '');
  let out = '';
  let i = 0;
  let quote: '"'|"'"|null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === '\\' && quote === '"' && i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch as '"'|"'";
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '{' && src.startsWith('{{', i)) {
      const slice = src.slice(i);
      const m = /^\{\{\s*([ierce]:(?:[^{}]|\([^)]*\))+?)\s*\}\}/i.exec(slice);
      if (m) {
        out += `<<${m[1].trim()}>>`;
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Quote YAML-unsafe expect/debug operators (`!=`, `!*`, `>`, …) before parsing.
 * Without this, YAML treats `!…` as tags and silently drops the operator
 * (e.g. `status: != 100` → `status: 100`).
 */
function prepareYaml(yamlString: string): string {
  return quoteExpectOperators(normalizeCurlyTokensInYamlSource(yamlString || ''));
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
    const js = parseYamlWithOmitKeyword(prepareYaml(yamlString), false);
    // Option C: accept UI-style {{i|e|r|c:…}} in YAML; normalize to bare / <<>>.
    return reviveDisplayRuntimeTokensInValue(js);
  } catch (e) {
    return null;
  }
}

/**
 * Parse YAML strictly: throws on parse errors instead of returning null.
 * Use this in execution paths where errors must be surfaced.
 */
function parseYamlStrict(yamlString: string): any {
  return reviveDisplayRuntimeTokensInValue(
      parseYamlWithOmitKeyword(prepareYaml(yamlString), true));
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
    if (isLiteralTokenValue(original)) {
      node.type = 'QUOTE_DOUBLE';
      return;
    }
    // Resolving tokens must stay plain. Merge keeps prior scalar style, so a
    // mid-edit quoted `"{{r:u}}"` would otherwise stick and turn a completed
    // `r:uuid` into a non-resolving quoted literal.
    if (typeof original === 'string' && isTokenLikeScalar(original)) {
      node.type = 'PLAIN';
      return;
    }
    // Keep `"112"` / `"true"` / `"omit"` as quoted strings on emit.
    if (typeof original === 'string' && needsYamlDoubleQuotes(original)) {
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
    const restored = restoreLiteralTokens(restoreOmitKeyword(obj));
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
        forceBlockStyleForStepSequences(doc.contents);
        return stringifyYamlDocument(doc);
      }
    }
    const doc = new YAML.Document();
    doc.contents = doc.createNode(normalized);
    applyKeywordScalarStyles(doc.contents, obj);
    forceBlockStyleForStepSequences(doc.contents);
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
  // Keep <<r:/c:>> readable in the editor (do not leave them percent-encoded).
  return restoreAngleRuntimeTokensInUrlEncoded(params.toString());
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
    return restoreAngleRuntimeTokensInUrlEncoded(trimmed);
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return objectToUrlEncoded(body as Record<string, unknown>);
  }
  return body == null ? '' : restoreAngleRuntimeTokensInUrlEncoded(String(body));
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
      return parseJsonWithRuntimeTokens(normalized) as string|object;
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
  let xmlObj: unknown;
  if (typeof body === 'string') {
    const normalized = normalizeNewlines(body);
    if (normalized.trim() === '') {
      return '';
    }
    const trimmed = normalized.trimStart();
    if (trimmed.startsWith('<')) {
      // Lenient parse + revive {{random …}} / {{current …}} leaves to r:/c:.
      xmlObj = parseXmlTextWithRuntimeTokens(
          normalized,
          (xml) => flattenXmlObj(xml2js(xml, {compact: true})),
      );
      xmlObj = rewriteRuntimeLeavesToDisplayText(xmlObj);
    } else {
      // JSON/YAML object text → structured object, then XML (existing convert path).
      const coerced = coerceBodyToStructuredObject(normalized);
      if (coerced === '') {
        return '';
      }
      xmlObj = typeof coerced === 'string' ?
        flattenXmlObj(xml2js(coerced, {compact: true})) :
        coerced;
    }
  } else {
    const coerced = coerceBodyToStructuredObject(body);
    if (coerced === '') {
      return '';
    }
    xmlObj = typeof coerced === 'string' ?
      flattenXmlObj(xml2js(coerced, {compact: true})) :
      coerced;
  }
  return js2xml(xmlObj as object, {
    compact: true,
    spaces: pretty ? 2 : 0,
    fullTagEmptyElement: expanded,
  });
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
    return parseJsonWithRuntimeTokens(coerced);
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
    pretty: boolean = true,
    valueContext?: RuntimeTokenValueContext,
): string {
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
      // Keep r:/c:/i:/e: as `{{…}}` (JSON.stringify would emit bare `"r:city"`).
      return stringifyJsonWithRuntimeTokens(obj, pretty, valueContext);
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
      if (Array.isArray(body) || (body && typeof body === 'object')) {
        return stringifyJsonWithRuntimeTokens(body, pretty);
      }
      return typeof body === 'string' ? body : String(body ?? '');
    }
    if (format === 'html') {
      if (typeof body !== 'string') {
        // Same as text/none: keep number/bool runtime tokens unquoted.
        return stringifyJsonWithRuntimeTokens(body, pretty);
      }
      return pretty ? formatHtmlBody(body) : body;
    }
    if (format === 'text' || format === 'none') {
      return typeof body === 'string' ?
          body :
          stringifyJsonWithRuntimeTokens(body, pretty);
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
 * Pack UI formatted text into a structured YAML body value only when it is
 * valid for `format`. Lenient YAML-fallback parsing is intentionally avoided
 * so invalid mid-edit JSON stays text for text-vs-yaml diffs.
 * Returns null when the text cannot be packed as that format.
 */
function packUiBodyStrictForYaml(format: Format, body: string): unknown|null {
  const text = normalizeNewlines(body);
  if (text.trim() === '') {
    return null;
  }
  try {
    if (format === 'json' || format === 'multipart') {
      // Allow unquoted `<<r:…>>` / `<<c:…>>` and revive them to bare tokens.
      return parseJsonWithRuntimeTokens(text);
    }
    if (isXmlFormat(format)) {
      return parseXmlTextWithRuntimeTokens(
          text,
          (xml) => flattenXmlObj(xml2js(xml, {compact: true})),
      );
    }
    if (format === 'urlencoded') {
      return reviveDisplayRuntimeTokensInValue(parseUrlEncodedBody(text));
    }
    if (format === 'binary' || format === 'text' || format === 'html' ||
        format === 'none') {
      // These formats are already plain text in YAML — not encoded objects.
      return null;
    }
    return YAML.parse(text);
  } catch {
    return null;
  }
}

/**
 * Align UI body with YAML for diffs / write-back.
 * When the YAML body is structured (encoded) and the UI text is valid for the
 * request format, pack for encoded-vs-encoded compare. Otherwise keep the UI
 * text (text-vs-yaml) — including invalid mid-edit JSON/XML.
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
  const packed = packUiBodyStrictForYaml(format, uiBody);
  // Only structured packs count as encoded-vs-encoded. A JSON string/number
  // primitive is still "text" relative to an object YAML body.
  if (packed === null || packed === undefined || typeof packed !== 'object') {
    return uiBody;
  }
  return packed;
}

/** Collect i:/e: plains that appear unquoted in JSON source (for beautify). */
function collectUnquotedIePlains(text: string): Set<string> {
  const plains = new Set<string>();
  mapUnquotedDisplayRuntimeTokens(text, (plain) => {
    if (/^[ie]:/i.test(plain)) {
      plains.add(plain);
    }
    return 'null';
  });
  return plains;
}

function beautify(
    format: Format,
    value: string,
    valueContext?: RuntimeTokenValueContext,
): string {
  try {
    if (format === 'json' || format === 'multipart') {
      const normalized = normalizeNewlines(value);
      const forceBarePlains = collectUnquotedIePlains(normalized);
      return stringifyJsonWithRuntimeTokens(
          parseJsonWithRuntimeTokens(normalized),
          true,
          valueContext,
          undefined,
          forceBarePlains);
    }
    if (isXmlFormat(format)) {
      const parsed = parseXmlTextWithRuntimeTokens(
          value,
          (xml) => flattenXmlObj(xml2js(xml, {compact: true})),
      );
      return formatXmlBody(
          rewriteRuntimeLeavesToDisplayText(parsed) as string|object,
          true,
          format === 'xmle');
    }
    if (format === 'urlencoded') {
      const parsed = reviveDisplayRuntimeTokensInValue(parseUrlEncodedBody(value));
      return objectToUrlEncoded(
          rewriteRuntimeLeavesToDisplayText(parsed) as Record<string, unknown>);
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