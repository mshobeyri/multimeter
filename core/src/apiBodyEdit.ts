import {Format} from './CommonData';
import {AuthConfig} from './APIData';
import {Request} from './NetworkData';
import {applyAuthToRequest} from './apiParsePack';
import {
  projectBodyKeepingRuntimeTokens,
  rewriteRuntimeLeavesToDisplayText,
  stringifyJsonWithRuntimeTokens,
  displayRuntimeTokensToResolvableText,
  displayTokensToResolvableDeep,
  displayRuntimeStringRecord,
  displayRuntimeString,
} from './bodyRuntimeTokens';
import {formatBody, packBodyForYamlCompare} from './markupConvertor';
import {normalizeNewlines} from './textLines';

export {displayRuntimeString, displayRuntimeStringRecord} from './bodyRuntimeTokens';

export type DisplayRequestBodyOptions = {
  /**
   * YAML body with r:/c: markers. When set, those tokens are shown as
   * `{{random …}}` / `{{current …}}` instead of resolved preview values.
   */
  tokenSource?: unknown;
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
    return stringifyJsonWithRuntimeTokens(projected, true);
  }
  if (options && options.tokenSource !== undefined &&
      (isXmlLikeFormat(format) || format === 'urlencoded' || format === 'text' ||
       format === 'html' || format === 'none')) {
    const display = rewriteRuntimeLeavesToDisplayText(projected);
    return formatBody(format, display as string|object);
  }
  return formatBody(format, projected as string|object);
}

export type BodyTempBaseline = {
  /** Resolved display string at first keystroke (exact match exits temp). */
  display: string;
  /** Original body value to restore on exact revert. */
  body: unknown;
};

export type BodyEditResult =
  | {kind: 'exitTemp'; body: unknown; baseline: null}
  | {kind: 'stayTemp'; body: string; baseline: BodyTempBaseline};

/**
 * Apply a tester body keystroke.
 * - First edit snapshots the pre-edit display + original body.
 * - Exact match of that display exits temp and restores the original body.
 * - Otherwise stays in temp with a free-form string (no live pack).
 */
export function applyRequestBodyEdit(args: {
  value: string;
  currentBody: unknown;
  format: Format;
  baseline: BodyTempBaseline|null;
  bodyAlreadyTouched: boolean;
  /** YAML body markers for r:/c: display projection (baseline snapshot). */
  tokenSource?: unknown;
}): BodyEditResult {
  const normalized = normalizeNewlines(args.value);
  let baseline = args.baseline;
  if (!args.bodyAlreadyTouched || !baseline) {
    const display = displayRequestBody(args.currentBody, args.format, {
      tokenSource: args.tokenSource,
    });
    baseline = {
      display: normalizeNewlines(display),
      body: args.currentBody,
    };
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
    // Editor may show {{random uuid}}; runner expects <<r:uuid>> / plain tokens.
    return displayRuntimeTokensToResolvableText(body);
  }
  if (format === 'multipart') {
    return body;
  }
  return formatBody(format, body, false);
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
  return packBodyForYamlCompare(yamlBody, uiBody, format);
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
