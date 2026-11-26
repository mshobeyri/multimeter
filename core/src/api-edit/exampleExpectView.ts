/**
 * View/edit helpers for example soft-expect as a response snapshot:
 * status + headers + body (not field/operator check rows).
 */

import type {ExpectMap, ExpectValue} from '../data/TestData';
import type {JSONRecord, JSONValue} from '../data/CommonData';

const STATUS_KEYS = ['status', 'status_code', 'statusCode'] as const;
const META_KEYS = new Set<string>([...STATUS_KEYS, 'headers', 'body']);

export type ExampleExpectView = {
  status?: number | string;
  headers?: JSONRecord;
  body?: JSONValue;
  /** Keys other than status/headers/body (operators, flattened Postman fields, …). */
  other: ExpectMap;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function pickStatus(expect: ExpectMap): number | string | undefined {
  for (const key of STATUS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(expect, key)) {
      continue;
    }
    const raw = expect[key];
    if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') {
      return raw as number | string;
    }
  }
  return undefined;
}

/**
 * True when expect looks like an imported example response snapshot
 * (OpenAPI / Postman / Bruno saved response), not soft check rows alone.
 */
export function hasExampleResponseSnapshot(
    expect: ExpectMap | null | undefined,
    ): boolean {
  if (!expect || typeof expect !== 'object' || Array.isArray(expect)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(expect, 'body') ||
      Object.prototype.hasOwnProperty.call(expect, 'headers');
}

/**
 * Split an example expect map into status / headers / body for the Example
 * response tab. Only structured `body` / `headers` count as a snapshot; soft
 * check keys stay in `other` (do not invent a flattened body from them).
 */
export function parseExampleExpectView(
    expect: ExpectMap | null | undefined,
    ): ExampleExpectView {
  if (!expect || typeof expect !== 'object' || Array.isArray(expect)) {
    return {other: {}};
  }
  const status = pickStatus(expect);
  const headers = isPlainObject(expect.headers) ?
      {...(expect.headers as JSONRecord)} :
      undefined;

  const body = Object.prototype.hasOwnProperty.call(expect, 'body') ?
      expect.body as JSONValue :
      undefined;
  const other: ExpectMap = {};
  for (const [key, value] of Object.entries(expect)) {
    if (META_KEYS.has(key)) {
      continue;
    }
    other[key] = value;
  }

  return {status, headers, body, other};
}

function normalizeStatus(status: number | string | undefined): number | string | undefined {
  if (status === undefined || status === null || status === '') {
    return undefined;
  }
  if (typeof status === 'number' && Number.isFinite(status)) {
    return status;
  }
  const text = String(status).trim();
  if (!text) {
    return undefined;
  }
  if (/^-?\d+$/.test(text)) {
    return Number(text);
  }
  return text;
}

/**
 * Rebuild an expect map from the Expect-tab view. Writes `status` / `headers` /
 * `body` and preserves unrelated keys from `other`.
 */
export function buildExampleExpect(view: ExampleExpectView): ExpectMap | undefined {
  const next: ExpectMap = {...(view.other || {})};
  for (const key of STATUS_KEYS) {
    delete next[key];
  }
  delete next.headers;
  delete next.body;

  const status = normalizeStatus(view.status);
  if (status !== undefined) {
    next.status = status;
  }

  if (view.headers && typeof view.headers === 'object' && !Array.isArray(view.headers)) {
    const cleaned: JSONRecord = {};
    for (const [key, value] of Object.entries(view.headers)) {
      if (!key) {
        continue;
      }
      cleaned[key] = value as JSONValue;
    }
    if (Object.keys(cleaned).length > 0) {
      next.headers = cleaned as ExpectValue;
    }
  }

  if (view.body !== undefined) {
    next.body = view.body as ExpectValue;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

/** Serialize expect body for a text editor. */
export function exampleExpectBodyToText(body: JSONValue | undefined): string {
  if (body === undefined || body === null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

/** Parse editor text back into an expect body value. */
export function textToExampleExpectBody(text: string): JSONValue | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as JSONValue;
  } catch {
    return text;
  }
}

export type ResponseExpectSnapshot = {
  status?: number;
  headers?: JSONRecord;
  body?: JSONValue;
};

/** Snapshot a live response into `{ status, headers?, body? }` for a new example. */
export function snapshotResponseExpect(
    response: ResponseExpectSnapshot | null | undefined,
    ): ExpectMap | undefined {
  if (!response) {
    return undefined;
  }
  return buildExampleExpect({
    status: response.status,
    headers: response.headers,
    body: response.body,
    other: {},
  });
}
