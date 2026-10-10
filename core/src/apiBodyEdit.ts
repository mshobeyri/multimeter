import {Format} from './CommonData';
import {AuthConfig} from './APIData';
import {Request} from './NetworkData';
import {applyAuthToRequest} from './apiParsePack';
import {
  projectBodyKeepingRuntimeTokens,
  rewriteAllLeavesToDisplayText,
  rewriteRuntimeLeavesToDisplayText,
  stringifyJsonWithRuntimeTokens,
  displayRuntimeTokensToResolvableText,
  displayTokensToResolvableDeep,
  displayRuntimeStringRecord,
  displayRuntimeString,
  sourceToDisplayTokenTemplate,
  valueForYamlSave,
  type RuntimeTokenValueContext,
} from './bodyRuntimeTokens';
import {
  formatBody,
  formatUrlEncodedEditorBody,
  formatXmlEditorBody,
  packBodyForYamlCompare,
} from './markupConvertor';
import {normalizeNewlines} from './textLines';
import {isIncompleteJsonLiteral} from './yamlValueConvert';

export {
  displayRuntimeString,
  displayRuntimeStringRecord,
  enterEditStringBuffer,
  enterEditStringRecord,
  findDisplayTokenCharRanges,
  peerRecordToDisplay,
  peerRecordToYaml,
  peerStringToDisplay,
  peerStringToYaml,
  projectTokenFieldPreview,
  sourceToDisplayTokenTemplate,
  stringContainsFieldToken,
  wrapTypedTokenAtCursor,
  valueForYamlSave,
} from './bodyRuntimeTokens';
export type {
  RuntimeTokenValueContext,
  TokenFieldSpan,
  TokenFieldSpanKind,
  BodyTokenHoverRange,
} from './bodyRuntimeTokens';

export type DisplayRequestBodyOptions = {
  /**
   * YAML body with r:/c: markers. When set, those tokens are shown as
   * `{{r:…}}` / `{{c:…}}` instead of resolved preview values.
   */
  tokenSource?: unknown;
  /**
   * Active inputs / env used to quote `{{i:}}` / `{{e:}}` in JSON
   * (number/bool → unquoted).
   */
  valueContext?: RuntimeTokenValueContext;
};

function isXmlLikeFormat(format: Format): boolean {
  return format === 'xml' || format === 'xmle';
}

/**
 * Body text shown in the API tester editor.
 * Structured YAML bodies are pretty-projected once; after the user edits,
 * `body` is kept as a free-form string and returned as-is.
 */
export function displayRequestBody(
    body: unknown,
    format: Format,
    options?: DisplayRequestBodyOptions,
): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const projected = options && options.tokenSource !== undefined ?
    projectBodyKeepingRuntimeTokens(options.tokenSource, body) :
    body;
  if (format === 'json' || format === 'multipart') {
    return stringifyJsonWithRuntimeTokens(
        projected, true, options?.valueContext);
  }
  if (format === 'urlencoded') {
    const shown = options && options.tokenSource !== undefined ?
      rewriteRuntimeLeavesToDisplayText(projected) :
      projected;
    return formatUrlEncodedEditorBody(shown as string|object);
  }
  if (isXmlLikeFormat(format)) {
    return formatXmlEditorBody(projected, format === 'xmle');
  }
  if (options && options.tokenSource !== undefined &&
      (format === 'text' || format === 'html' || format === 'none')) {
    const display = rewriteRuntimeLeavesToDisplayText(projected);
    return formatBody(format, display as string|object);
  }
  return formatBody(format, projected as string|object);
}

/**
 * Edit-buffer body text: every YAML i:/e:/r:/c: leaf as `{{prefix:…}}`.
 * JSON quoting for i:/e: prefers `resolvedHint` leaf types, then valueContext.
 */
export function bodyEditTokenTemplate(
    tokenSource: unknown,
    format: Format,
    valueContext?: RuntimeTokenValueContext,
    resolvedHint?: unknown,
): string {
  if (tokenSource == null) {
    return '';
  }
  if (typeof tokenSource === 'string') {
    return sourceToDisplayTokenTemplate(tokenSource);
  }
  const projected = rewriteAllLeavesToDisplayText(tokenSource);
  if (format === 'json' || format === 'multipart') {
    return stringifyJsonWithRuntimeTokens(
        projected, true, valueContext, resolvedHint);
  }
  if (format === 'urlencoded') {
    return formatUrlEncodedEditorBody(projected as string|object);
  }
  if (format === 'xml' || format === 'xmle') {
    return formatXmlEditorBody(tokenSource, format === 'xmle');
  }
  return formatBody(format, projected as string|object);
}

export type BodyTempBaseline = {
  /** Edit-buffer display string at first keystroke (exact match exits temp). */
  display: string;
  /** Original body value to restore on exact revert. */
  body: unknown;
};

export type BodyEditResult =
  | {kind: 'exitTemp'; body: unknown; baseline: null}
  | {kind: 'stayTemp'; body: string; baseline: BodyTempBaseline};

/**
 * Apply a tester body keystroke.
 * - First edit swaps to the YAML token template (`{{i:}}`/`{{e:}}`/`{{r:}}`/`{{c:}}`).
 * - Exact match of that template exits temp and restores the original body.
 * - Otherwise stays in temp with a free-form string (no live pack).
 */
export function applyRequestBodyEdit(args: {
  value: string;
  currentBody: unknown;
  format: Format;
  baseline: BodyTempBaseline|null;
  bodyAlreadyTouched: boolean;
  /** YAML body markers for edit-buffer / preview projection. */
  tokenSource?: unknown;
  /** Active inputs/env for JSON i:/e: quoting. */
  valueContext?: RuntimeTokenValueContext;
  /**
   * Parallel resolved body (before edit) — preferred source of leaf types
   * for JSON quoting of {{i:}}/{{e:}}.
   */
  resolvedHint?: unknown;
}): BodyEditResult {
  const normalized = normalizeNewlines(args.value);
  let baseline = args.baseline;
  const resolvedHint = args.resolvedHint !== undefined ?
    args.resolvedHint :
    (typeof args.currentBody === 'string' ? undefined : args.currentBody);
  if (!args.bodyAlreadyTouched || !baseline) {
    const preview = normalizeNewlines(displayRequestBody(args.currentBody, args.format, {
      tokenSource: args.tokenSource,
      valueContext: args.valueContext,
    }));
    const editTemplate = normalizeNewlines(bodyEditTokenTemplate(
        args.tokenSource ?? args.currentBody,
        args.format,
        args.valueContext,
        resolvedHint,
    ));
    baseline = {
      display: editTemplate,
      body: args.currentBody,
    };
    // First keystroke while previewing resolved i:/e:: enter edit on template.
    if (preview !== editTemplate) {
      const smallEdit = Math.abs(normalized.length - preview.length) <= 1;
      const body = smallEdit ? editTemplate : normalized;
      if (body === editTemplate) {
        return {kind: 'stayTemp', body: editTemplate, baseline};
      }
      return {kind: 'stayTemp', body, baseline};
    }
  }
  if (normalized === baseline.display) {
    return {kind: 'exitTemp', body: baseline.body, baseline: null};
  }
  return {kind: 'stayTemp', body: normalized, baseline};
}

/**
 * Body value placed on the wire for Send / Run.
 * Free-form strings go as-is; leftover structured objects (except multipart)
 * are compact-serialized for the format.
 */
export function bodyForSend(body: unknown, format: Format): unknown {
  if (body == null) {
    return body;
  }
  if (typeof body === 'string') {
    // Editor may show {{r:uuid}}; runner expects <<r:uuid>> / plain tokens.
    return displayRuntimeTokensToResolvableText(body);
  }
  if (format === 'multipart') {
    return body;
  }
  return formatBody(format, body, false);
}

/**
 * True when a packed value still contains display `{{` / `}}` braces.
 * Complete tokens revive to bare `r:city` / `i:x`; leftover braces mean the UI
 * text is mid-edit and must stay plain storage (not structured YAML).
 */
function packedHasStrayDisplayBraces(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes('{{') || value.includes('}}');
  }
  if (Array.isArray(value)) {
    return value.some(packedHasStrayDisplayBraces);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(
        packedHasStrayDisplayBraces);
  }
  return false;
}

/**
 * Body value written back into YAML on "Save to YAML".
 * Same rules as packBodyForYamlCompare (strict pack when YAML was encoded).
 */
export function bodyForYamlSave(
    yamlBody: unknown,
    uiBody: unknown,
    format: Format,
): unknown {
  return valueForYamlSave(packBodyForYamlCompare(yamlBody, uiBody, format));
}

/**
 * Save a body editor. A structured YAML body stays structured while the text
 * is still an unfinished JSON or XML edit.
 */
export function saveEditorBody(
    yamlBody: unknown,
    uiBody: string,
    format: Format,
): unknown {
  const saved = bodyForYamlSave(yamlBody, uiBody, format);
  if (yamlBody == null || typeof yamlBody !== 'object') {
    return saved;
  }
  if (saved !== null && typeof saved === 'object') {
    return saved;
  }
  const text = String(uiBody ?? '');
  if (isIncompleteJsonLiteral(text)) {
    return yamlBody;
  }
  if ((format === 'xml' || format === 'xmle') && text.trim().startsWith('<')) {
    return yamlBody;
  }
  return saved;
}

/**
 * Peer: tokens editor text → YAML body.
 * Prefer structured (encoded) when the text fully packs; otherwise plain string
 * with `<<…>>` forms. Never takes resolved values — only token/display text.
 */
export function tokensTextToYamlBody(
    uiBody: string,
    format: Format,
    preferEncoded: boolean = true,
): unknown {
  const normalized = normalizeNewlines(uiBody);
  if (preferEncoded) {
    const packed = packBodyAsYamlEncoded(normalized, format);
    if (packed != null) {
      return packed;
    }
  }
  return valueForYamlSave(normalized);
}

/**
 * Peer: YAML body → tokens editor text (`{{i:}}` / `{{r:}}` / …).
 * Inverse of tokensTextToYamlBody for the display buffer.
 */
export function yamlBodyToTokensText(
    yamlBody: unknown,
    format: Format,
    valueContext?: RuntimeTokenValueContext,
    resolvedHint?: unknown,
): string {
  return bodyEditTokenTemplate(yamlBody, format, valueContext, resolvedHint);
}

/**
 * Try to pack UI / plain-storage body text into a structured YAML object.
 * Independent of whether the file currently stores plain or encoded.
 * Returns null when the text is not valid for `format`, or when any leaf still
 * contains incomplete `{{…}}` display braces (mid-edit — keep as plain text).
 */
export function packBodyAsYamlEncoded(
    uiBody: string,
    format: Format,
): unknown|null {
  // Fake structured anchor so packBodyForYamlCompare attempts a strict pack
  // even when the current YAML body is still a plain string.
  const packed = bodyForYamlSave({_: true}, uiBody, format);
  if (packed == null || typeof packed !== 'object') {
    return null;
  }
  // Incomplete `{{r:city}` would otherwise land in YAML as a quoted string leaf
  // and break the tokens↔YAML peer round-trip when braces are restored.
  if (packedHasStrayDisplayBraces(packed)) {
    return null;
  }
  return packed;
}

/**
 * Non-body field value written back into YAML on Save.
 * Converts display `{{…}}` tokens to YAML `<<…>>` / bare forms.
 */
export function fieldForYamlSave(uiValue: unknown): unknown {
  return valueForYamlSave(uiValue);
}

function asStringRecord(
    map?: Record<string, unknown>|null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!map || typeof map !== 'object') {
    return out;
  }
  for (const [key, value] of Object.entries(map)) {
    out[key] = typeof value === 'string' ? value : String(value ?? '');
  }
  return out;
}

/**
 * Headers map including auth-applied fields, with r:/c: markers still in place
 * (for tester `{{…}}` projection).
 */
export function headersTokenSource(api: {
  headers?: Record<string, unknown>|null;
  auth?: AuthConfig;
}): Record<string, unknown> {
  const applied = applyAuthToRequest(
      api.auth,
      asStringRecord(api.headers),
      undefined,
  );
  return applied.headers;
}

/** Query map including auth api-key query, with r:/c: markers still in place. */
export function queryTokenSource(api: {
  query?: Record<string, unknown>|null;
  auth?: AuthConfig;
}): Record<string, unknown> {
  const applied = applyAuthToRequest(
      api.auth,
      {},
      asStringRecord(api.query),
  );
  return applied.query || {};
}

/**
 * Convert tester-display `{{…}}` tokens across the request to resolvable
 * `<<r:/c:…>>` before Send / Run (body still goes through bodyForSend).
 */
export function requestForSend(request: Request, format: Format): Request {
  const converted = displayTokensToResolvableDeep(request) as Request;
  return {
    ...converted,
    body: bodyForSend(converted.body, format),
  };
}

/** Project a resolved KSV map using YAML token source (untouched fields). */
export function displayRequestStringRecord(
    resolved?: Record<string, unknown>|null,
    source?: Record<string, unknown>|null,
    opts?: {touched?: boolean},
): Record<string, string> {
  if (opts?.touched) {
    return displayRuntimeStringRecord(resolved, undefined);
  }
  return displayRuntimeStringRecord(resolved, source);
}
