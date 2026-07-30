import * as YAML from 'yaml';
import {preserveMultilineDescriptionScalars} from './multilineDescriptionYaml';

export const OMIT_KEYWORD = 'omit';
export const OMIT_SENTINEL = '__MMT_OMIT__';

export function isOmitSentinel(value: unknown): boolean {
  return value === OMIT_SENTINEL;
}

function walkYamlNode(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'PLAIN' && node.value === OMIT_KEYWORD) {
    node.value = OMIT_SENTINEL;
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        walkYamlNode(item.key);
        walkYamlNode(item.value);
      } else {
        walkYamlNode(item);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    walkYamlNode(node.key);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    walkYamlNode(node.value);
  }
}

export function parseYamlWithOmitKeyword(
    yamlString: string,
    strict: boolean,
): any {
  const doc = YAML.parseDocument(yamlString);
  if (strict && doc.errors.length > 0) {
    throw doc.errors[0];
  }
  preserveMultilineDescriptionScalars(doc.contents, yamlString);
  walkYamlNode(doc.contents);
  return doc.toJS();
}

export function normalizeOmitToNull(value: any): any {
  if (isOmitSentinel(value)) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(v => normalizeOmitToNull(v));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, normalizeOmitToNull(v)]));
  }
  return value;
}

export function restoreOmitKeyword(value: any): any {
  if (isOmitSentinel(value)) {
    return OMIT_KEYWORD;
  }
  if (Array.isArray(value)) {
    return value.map(v => restoreOmitKeyword(v));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, restoreOmitKeyword(v)]));
  }
  return value;
}

/** Replace sentinels inside an already-serialized string (log/report text). */
export function restoreOmitKeywordInText(text: string): string {
  return String(text ?? '').split(OMIT_SENTINEL).join(OMIT_KEYWORD);
}

export function stripOmitFromRequest(value: any): any {
  if (isOmitSentinel(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(v => {
      const next = stripOmitFromRequest(v);
      return next === undefined ? null : next;
    });
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = stripOmitFromRequest(v);
      if (next !== undefined) {
        out[k] = next;
      }
    }
    return out;
  }
  return value;
}

function dropOmittedEntries(record: any): any {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record;
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === 'string' && v.includes(OMIT_SENTINEL)) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

function dropOmittedPairs(queryString: string): string {
  return queryString.split('&')
      .filter(pair => pair && !pair.includes(OMIT_SENTINEL))
      .join('&');
}

function stripOmitFromUrl(url: string): string {
  if (!url.includes(OMIT_SENTINEL)) {
    return url;
  }
  const queryStart = url.indexOf('?');
  if (queryStart < 0) {
    return url.split(OMIT_SENTINEL).join('');
  }
  const base = url.slice(0, queryStart).split(OMIT_SENTINEL).join('');
  const query = dropOmittedPairs(url.slice(queryStart + 1));
  return query ? `${base}?${query}` : base;
}

function stripOmitFromXmlBody(body: string): string {
  const element =
      new RegExp(`[^\\S\\r\\n]*<([\\w:.\\-]+)([^>]*)>\\s*${OMIT_SENTINEL}\\s*<\\/\\1>\\s*\\n?`, 'g');
  const attribute = new RegExp(`\\s[\\w:.\\-]+="${OMIT_SENTINEL}"`, 'g');
  return body.replace(element, '')
      .replace(attribute, '')
      .split(OMIT_SENTINEL)
      .join('');
}

function isBinaryBody(body: any): boolean {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    return true;
  }
  return body instanceof Uint8Array || body instanceof ArrayBuffer;
}

function stripOmitFromJsonBody(body: string): string|null {
  try {
    const stripped = stripOmitFromRequest(JSON.parse(body));
    return JSON.stringify(stripped === undefined ? null : stripped, null, 2);
  } catch {
    return null;
  }
}

/**
 * Remove omit-marked values from a serialized request body.
 * `format` is the request format (`json`, `xml`, `urlencoded`, …); JSON is
 * assumed when it is missing, matching the `.mmt` default.
 */
export function stripOmitFromBody(body: any, format?: string): any {
  if (body === null || body === undefined || isBinaryBody(body)) {
    return body;
  }
  if (typeof body !== 'string') {
    return stripOmitFromRequest(body);
  }
  if (!body.includes(OMIT_SENTINEL)) {
    return body;
  }
  const kind = String(format || 'json').toLowerCase();
  if (kind === 'urlencoded') {
    return dropOmittedPairs(body);
  }
  if (kind === 'xml' || kind === 'xmle') {
    return stripOmitFromXmlBody(body);
  }
  if (kind === 'json' || kind === 'graphql') {
    const json = stripOmitFromJsonBody(body);
    if (json !== null) {
      return json;
    }
  }
  // Text and unparsable bodies have no field to remove, so the marker itself
  // is all that can be dropped.
  return body.trim() === OMIT_SENTINEL ? '' : body.split(OMIT_SENTINEL).join('');
}

/**
 * Runtime counterpart of `stripOmitFromRequest` for a built request.
 *
 * Call-time inputs (test `call` steps, CLI `-e`, examples) only reach the
 * request when the generated code runs, so the sentinel has to be dropped here
 * instead of during code generation. Mutates and returns `req`.
 */
export function applyOmitToOutgoingRequest(req: any, format?: string): any {
  if (!req || typeof req !== 'object') {
    return req;
  }
  if (typeof req.url === 'string') {
    req.url = stripOmitFromUrl(req.url);
  }
  for (const key of ['headers', 'query', 'cookies', 'metadata']) {
    if (req[key]) {
      req[key] = dropOmittedEntries(req[key]);
    }
  }
  if ('body' in req) {
    const next = stripOmitFromBody(req.body, format);
    if (next === undefined) {
      delete req.body;
    } else {
      req.body = next;
    }
  }
  if ('message' in req) {
    const next = stripOmitFromRequest(req.message);
    req.message = next === undefined ? {} : next;
  }
  return req;
}
