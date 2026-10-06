import {js2xml, xml2js} from 'xml-js';
import * as YAML from 'yaml';
import {Format, JSONValue} from './CommonData';
import {formatHtmlBody} from './htmlFormat';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {parseYamlWithOmitKeyword} from './omitKeyword';
import {restoreOmitKeyword} from './omitKeyword';
import {isOmitSentinel} from './omitKeyword';
import {
  isLiteralTokenValue,
  isTokenLikeScalar,
  restoreLiteralTokens,
  unwrapLiteralToken,
} from './literalToken';
import {
  inputBoxToYamlValue,
  needsYamlDoubleQuotes,
  yamlValueToInputBox,
} from './yamlValueConvert';
import {applyDescriptionBlockLiteralStyles} from './multilineDescriptionYaml';
import {normalizeNewlines} from './textLines';
import {mergeYamlValue} from './yamlAstMerge';
import {
  restoreUnchangedScalarSpellings,
  yamlModelsUnchanged,
} from './yamlAuthoredScalars';
import {forceBlockStyleForStepSequences} from './yamlBlockSteps';
import {
  mapUnquotedDisplayRuntimeTokens,
  parseJsonWithRuntimeTokens,
  parseXmlTextWithRuntimeTokens,
  restoreAngleRuntimeTokensInUrlEncoded,
  reviveDisplayRuntimeTokensInValue,
  reviveEditorBodyValue,
  rewriteAllLeavesToDisplayText,
  rewriteRuntimeLeavesToDisplayText,
  peerStringToDisplay,
  stringifyJsonWithRuntimeTokens,
  type RuntimeTokenValueContext,
} from './bodyRuntimeTokens';

/** Unquoted `{{i|e|r|c:…}}` at the cursor. Quoted text is handled by the walker. */
const CURLY_TOKEN_AT_RE =
    /^\{\{\s*([ierceo]:(?:[^{}]|\([^)]*\))+?)\s*\}\}/i;

/**
 * Walk raw YAML, skipping single- and double-quoted regions, and replace
 * unquoted `{{i|e|r|c:…}}` tokens. Postman-style `{{var}}` (no prefix) is
 * left unchanged. Quoted `"{{r:uuid}}"` stays literal text.
 */
function mapUnquotedCurlyTokens(
    yamlString: string,
    replace: (match: RegExpExecArray) => string,
): string {
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
      const m = CURLY_TOKEN_AT_RE.exec(src.slice(i));
      if (m) {
        out += replace(m);
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
 * Rewrite Multimeter UI curly tokens `{{i|e|r|c|o:…}}` to `<<…>>` in raw YAML
 * *before* parse. Unquoted `{{r:uuid}}` is invalid YAML flow syntax
 * (`{` starts a map); angle form is a plain scalar.
 */
export function normalizeCurlyTokensInYamlSource(yamlString: string): string {
  return mapUnquotedCurlyTokens(yamlString, (m) => `<<${m[1].trim()}>>`);
}

export type ShieldedCurlyTokens = {
  text: string;
  tokens: string[];
  placeholderPrefix: string;
};

/**
 * Replace unquoted `{{i|e|r|c|o:…}}` with plain placeholders so the YAML
 * parser cannot read `{` as a flow map. Restore with
 * `restoreShieldedCurlyTokens` after `doc.toString()`.
 */
export function shieldCurlyTokensInYamlSource(yamlString: string): ShieldedCurlyTokens {
  const src = String(yamlString ?? '');
  let placeholderPrefix = 'mmtCurlyToken';
  let n = 0;
  while (src.includes(placeholderPrefix)) {
    n += 1;
    placeholderPrefix = `mmtCurlyToken${n}X`;
  }
  const tokens: string[] = [];
  const text = mapUnquotedCurlyTokens(src, (m) => {
    const id = tokens.length;
    tokens.push(m[0]);
    return `${placeholderPrefix}${id}`;
  });
  return {text, tokens, placeholderPrefix};
}

/** Put shielded `{{i|e|r|c|o:…}}` tokens back after a YAML emit. */
export function restoreShieldedCurlyTokens(
    yamlString: string,
    shielded: ShieldedCurlyTokens,
): string {
  if (!shielded.tokens.length) {
    return yamlString;
  }
  const prefix = shielded.placeholderPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${prefix}(\\d+)`, 'g');
  return yamlString.replace(re, (full, index) => {
    const token = shielded.tokens[Number(index)];
    return token ?? full;
  });
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
        return finishPackedYaml(stringifyYamlDocument(doc), originalYaml);
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

/**
 * A load/resave of the same model must not rewrite expects or token spelling.
 * A real edit still updates that value, and leaves every other scalar as authored.
 */
function finishPackedYaml(packed: string, originalYaml?: string): string {
  if (!packed || typeof originalYaml !== 'string' || originalYaml.length === 0) {
    return packed;
  }
  try {
    const originalJs = parseYaml(originalYaml);
    const packedJs = parseYaml(packed);
    if (yamlModelsUnchanged(originalJs, packedJs)) {
      return originalYaml;
    }
  } catch {
    return packed;
  }
  return restoreUnchangedScalarSpellings(packed, originalYaml);
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

function formValueToString(value: unknown, keepLiteralMarkers = false): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' && isLiteralTokenValue(value)) {
    return keepLiteralMarkers ? value : unwrapLiteralToken(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // One form field stays one string. Spell nested JSON the way the editor
  // spells leaves (`omit`, quoted token text) so internal markers stay out.
  return stringifyJsonWithRuntimeTokens(value, false);
}

/** True for numeric text that would change when typed (`1.0`, `007`, `1e3`). */
function isNonCanonicalNumberText(text: string): boolean {
  if (isLiteralTokenValue(text) || isTokenLikeScalar(text)) {
    return false;
  }
  const typed = inputBoxToYamlValue(text);
  return typeof typed === 'number' && String(typed) !== text;
}

/**
 * Editor form text uses the input-box spelling: `100`, `true`, `null`,
 * `"112"`, `"true"`. The wire spelling stays in {@link formValueToString}
 * (`null` is an empty field, strings are not wrapped in quotes).
 */
function editorFormValue(value: unknown): string {
  if (typeof value === 'string' && value !== '') {
    // Form fields are text on the wire. Quotes are a JSON-only spelling.
    return isLiteralTokenValue(value) ? unwrapLiteralToken(value) : value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean' ||
      typeof value === 'string') {
    return yamlValueToInputBox(value as JSONValue);
  }
  return formValueToString(value);
}

/** Keep input-box quotes visible (`qn="112"`) instead of `%22112%22`. */
function revealInputBoxQuotes(encoded: string): string {
  return encoded.replace(/=%22([^&]*)%22(?=&|$)/g, (_match, inner: string) => {
    return `="${decodeURIComponent(inner)}"`;
  });
}

function objectToUrlEncoded(
    obj: Record<string, unknown>,
    editor = false,
    keepLiteralMarkers = false,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    params.append(
        key,
        editor ? editorFormValue(value) : formValueToString(value, keepLiteralMarkers));
  }
  // Keep <<r:/c:>> readable in the editor (do not leave them percent-encoded).
  const encoded = restoreAngleRuntimeTokensInUrlEncoded(params.toString());
  return editor ? revealInputBoxQuotes(encoded) : encoded;
}

/**
 * Form text → YAML value, same rules as an input box.
 * `100` / `true` / `false` / `null` stay typed. `"112"` / `"true"` stay strings.
 * A JSON object or list stays the one form-field string.
 */
function urlEncodedScalarToYaml(text: string): unknown {
  const typed = inputBoxToYamlValue(text);
  if (typed !== null && typeof typed === 'object') {
    return text;
  }
  if (typeof typed === 'number' && String(typed) !== text) {
    return text;
  }
  return typed;
}

function coerceUrlEncodedRecord(
    record: Record<string, string>,
): Record<string, unknown> {
  return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        urlEncodedScalarToYaml(value),
      ]),
  );
}

function formatUrlEncodedBody(
    body: string|object, editor = false, keepLiteralMarkers = false): string {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) {
      return '';
    }
    try {
      const parsed = YAML.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return objectToUrlEncoded(
            parsed as Record<string, unknown>, editor, keepLiteralMarkers);
      }
    } catch {
      // Keep as raw string (already encoded or plain text)
    }
    return restoreAngleRuntimeTokensInUrlEncoded(trimmed);
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return objectToUrlEncoded(
        body as Record<string, unknown>, editor, keepLiteralMarkers);
  }
  return body == null ? '' : restoreAngleRuntimeTokensInUrlEncoded(String(body));
}

/** Urlencoded text for the tester editor (input-box scalar spelling). */
export function formatUrlEncodedEditorBody(body: string|object): string {
  return formatUrlEncodedBody(body, true);
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

/** Pair `<tag></tag>` in non-expanded XML means `""`. Self-closing stays `{}`. */
const XML_EMPTY_TEXT = '__MMT_EMPTY_TEXT__';

function markXmlPairEmpty(xml: string): string {
  return xml.replace(
      /<([A-Za-z_:][\w:.-]*)([^>/]*)><\/\1>/g,
      `<$1$2>${XML_EMPTY_TEXT}</$1>`,
  );
}

function restoreEmptyTextMarker(value: unknown): unknown {
  if (value === XML_EMPTY_TEXT) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => restoreEmptyTextMarker(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [
          key,
          restoreEmptyTextMarker(child),
        ]),
    );
  }
  return value;
}

/**
 * XML element text → YAML value, same rules as an input box.
 * Live tokens and quoted token literals are left for the revive that already
 * ran. `100` / `true` / `null` / `omit` are typed. `"112"` stays a string.
 */
function coerceXmlScalars(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isLiteralTokenValue(value) || isTokenLikeScalar(value)) {
      return value;
    }
    const typed = inputBoxToYamlValue(value);
    if (typed !== null && typeof typed === 'object') {
      return value;
    }
    if (typeof typed === 'string' && !isTokenLikeScalar(typed)) {
      return reviveEditorBodyValue(typed);
    }
    return typed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceXmlScalars(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [
          key,
          key === XML_ATTRIBUTES_KEY ? coerceXmlAttributes(child) : coerceXmlScalars(child),
        ]),
    );
  }
  return value;
}

/** Attribute values are always text on the wire, so `1.0` must stay `"1.0"`. */
function coerceXmlAttributes(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return coerceXmlScalars(value);
  }
  return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => {
        const typed = coerceXmlScalars(child);
        const keepText = typeof child === 'string' &&
            (typed === null || typeof typed === 'number' || typeof typed === 'boolean');
        return [key, keepText ? child : typed];
      }),
  );
}

/** Drop `omit` fields, including nested ones. Quoted `"omit"` is not a sentinel. */
function dropOmittedXmlFields(value: unknown): unknown {
  if (isOmitSentinel(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const item of value) {
      const next = dropOmittedXmlFields(item);
      if (next !== undefined) {
        items.push(next);
      }
    }
    return items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = dropOmittedXmlFields(child);
      if (next !== undefined) {
        out[key] = next;
      }
    }
    return out;
  }
  return value;
}

function packXmlValue(value: unknown): unknown {
  return dropOmittedXmlFields(coerceXmlScalars(restoreEmptyTextMarker(value)));
}

function xmlEditorLeaf(value: JSONValue, expanded: boolean): string {
  if (value === '') {
    // xmle writes every empty element as `<tag></tag>`, which means `{}`.
    // A blank string uses the input-box quotes so the two stay distinct.
    return expanded ? '""' : XML_EMPTY_TEXT;
  }
  if (typeof value !== 'string') {
    return yamlValueToInputBox(value);
  }
  if (isLiteralTokenValue(value)) {
    return unwrapLiteralToken(value);
  }
  // Element text is always a string on the wire. Quotes are a JSON-only spelling.
  return peerStringToDisplay(value);
}

const XML_ATTRIBUTES_KEY = '_attributes';

/** Attribute text is shown as written. Input-box quotes would be escaped to &quot;. */
function xmlAttributeForEditor(value: unknown): unknown {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string' && value !== '' && !isLiteralTokenValue(value) &&
      !isTokenLikeScalar(value)) {
    return value;
  }
  if (value === '') {
    return '';
  }
  return xmlEditorLeaf(value as JSONValue, false);
}

function xmlValueForEditor(value: unknown, expanded: boolean): unknown {
  if (isOmitSentinel(value)) {
    return undefined;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean' ||
      typeof value === 'string') {
    return xmlEditorLeaf(value as JSONValue, expanded);
  }
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const item of value) {
      const next = xmlValueForEditor(item, expanded);
      if (next !== undefined) {
        items.push(next);
      }
    }
    return items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === XML_ATTRIBUTES_KEY && child && typeof child === 'object' &&
          !Array.isArray(child)) {
        out[key] = Object.fromEntries(
            Object.entries(child as Record<string, unknown>)
                .map(([name, attr]) => [name, xmlAttributeForEditor(attr)]));
        continue;
      }
      const next = xmlValueForEditor(child, expanded);
      if (next !== undefined) {
        out[key] = next;
      }
    }
    return out;
  }
  return value;
}

function hideEmptyTextMarker(xml: string): string {
  return xml.split(`>${XML_EMPTY_TEXT}<`).join('><');
}

/** XML text for the tester editor (input-box scalar spelling, omit removed). */
export function formatXmlEditorBody(body: unknown, expanded: boolean): string {
  if (body == null || isOmitSentinel(body)) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const prepared = xmlValueForEditor(body, expanded);
  const xml = js2xml(prepared as object, {
    compact: true,
    spaces: 2,
    fullTagEmptyElement: expanded,
  });
  return expanded ? xml : hideEmptyTextMarker(xml);
}

function formatXmlBody(
    body: string|object, pretty: boolean, expanded: boolean,
    keepLiteralMarkers = false): string {
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
      (keepLiteralMarkers ? coerced : restoreLiteralTokens(coerced));
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
    keepLiteralMarkers = false,
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
      return stringifyJsonWithRuntimeTokens(
          obj, pretty, valueContext, undefined, undefined, keepLiteralMarkers);
    }
    if (isXmlFormat(format)) {
      return formatXmlBody(body, pretty, format === 'xmle', keepLiteralMarkers);
    }
    if (format === 'urlencoded') {
      return formatUrlEncodedBody(body, false, keepLiteralMarkers);
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
 * `xml-js` needs one root. A flat body emits sibling elements
 * (`<n>100</n><name>ada</name>`). Wrap those, then unwrap the synthetic root
 * so the pack is the original object.
 */
function parseXmlEditorObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    const parsed = flattenXmlObj(xml2js(
        `<mmt-root>${trimmed}</mmt-root>`,
        {compact: true},
    ));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>)['mmt-root'];
    }
  } catch {
    // A declaration or other single document can fail inside the wrapper.
  }
  return flattenXmlObj(xml2js(trimmed, {compact: true}));
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
      const marked = format === 'xml' ? markXmlPairEmpty(text) : text;
      return packXmlValue(parseXmlTextWithRuntimeTokens(
          marked,
          parseXmlEditorObject,
      ));
    }
    if (format === 'text' || format === 'html' || format === 'none') {
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return parseJsonWithRuntimeTokens(text);
      }
      return null;
    }
    if (format === 'urlencoded') {
      return reviveEditorBodyValue(
          coerceUrlEncodedRecord(parseUrlEncodedBody(text)));
    }
    if (format === 'binary') {
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
          rewriteAllLeavesToDisplayText(parseJsonWithRuntimeTokens(normalized)),
          true,
          valueContext,
          undefined,
          forceBarePlains);
    }
    if (isXmlFormat(format)) {
      const marked = format === 'xml' ? markXmlPairEmpty(value) : value;
      const parsed = parseXmlTextWithRuntimeTokens(
          marked,
          parseXmlEditorObject,
      );
      return formatXmlEditorBody(packXmlValue(parsed), format === 'xmle');
    }
    if (format === 'urlencoded') {
      const parsed = reviveEditorBodyValue(
          coerceUrlEncodedRecord(parseUrlEncodedBody(value)));
      return objectToUrlEncoded(
          rewriteRuntimeLeavesToDisplayText(parsed) as Record<string, unknown>,
          true);
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