import { APIData } from "mmt-core/APIData";
import { Request } from "mmt-core/NetworkData";

/**
 * Scoped refresh for the API tester (right panel).
 *
 * Callers declare which parts of the UI should be rewritten instead of always
 * replacing the entire request. Later refinements (e.g. URL-line-only YAML
 * edits) can emit narrower scopes without changing the apply path.
 *
 * - `all`      – full request rebuild (initial load, reset, example switch)
 * - `env`      – re-resolve env tokens into request fields; keep user edits
 * - `url`      – url + query
 * - `body`     – body, format, graphql, grpc
 * - `headers`  – headers, cookies (incl. auth-derived)
 * - `meta`     – method, protocol, timeout
 * - `inputs`   – inputs / examples drive a broader refresh
 * - `doc`      – description / title / tags only (no requestData write)
 */
export type ApiUiRefreshScope =
  | "all"
  | "env"
  | "url"
  | "body"
  | "headers"
  | "meta"
  | "inputs"
  | "doc";

type RequestField = keyof Request;

const SCOPE_FIELDS: Record<Exclude<ApiUiRefreshScope, "all" | "doc" | "inputs">, readonly RequestField[]> = {
  env: ["url", "query", "body", "format", "headers", "cookies", "graphql", "grpc"],
  url: ["url", "query"],
  body: ["body", "format", "graphql", "grpc"],
  headers: ["headers", "cookies"],
  meta: ["method", "protocol", "timeout"],
};

/** Expand scopes into the Request keys that should be patched. `all` / `inputs` → full replace. */
export function requestFieldsForScopes(scopes: ApiUiRefreshScope[]): RequestField[] | "all" {
  if (scopes.includes("all") || scopes.includes("inputs")) {
    return "all";
  }

  if (scopes.length === 0) {
    return [];
  }

  const fields = new Set<RequestField>();
  for (const scope of scopes) {
    if (scope === "doc") {
      continue;
    }
    const scoped = SCOPE_FIELDS[scope as keyof typeof SCOPE_FIELDS];
    if (scoped) {
      for (const field of scoped) {
        fields.add(field);
      }
    }
  }

  return Array.from(fields);
}

/** True when scopes only affect doc chrome and should not rebuild requestData. */
export function isDocOnlyRefresh(scopes: ApiUiRefreshScope[]): boolean {
  return scopes.length > 0 && scopes.every((scope) => scope === "doc");
}

/**
 * Diff two API models into refresh scopes.
 * Used when YAML/`api` changes so unrelated tabs are not rewritten.
 */
export function diffApiRefreshScopes(prev: APIData | undefined, next: APIData): ApiUiRefreshScope[] {
  if (!prev) {
    return ["all"];
  }

  const scopes = new Set<ApiUiRefreshScope>();

  if (!stableEqual(prev.url, next.url) || !stableEqual(prev.query, next.query)) {
    scopes.add("url");
  }
  if (
    !stableEqual(prev.body, next.body) ||
    !stableEqual(prev.format, next.format) ||
    !stableEqual(prev.graphql, next.graphql) ||
    !stableEqual(prev.grpc, next.grpc)
  ) {
    scopes.add("body");
  }
  if (
    !stableEqual(prev.headers, next.headers) ||
    !stableEqual(prev.cookies, next.cookies) ||
    !stableEqual(prev.auth, next.auth)
  ) {
    scopes.add("headers");
  }
  if (
    !stableEqual(prev.method, next.method) ||
    !stableEqual(prev.protocol, next.protocol) ||
    !stableEqual(prev.timeout, next.timeout)
  ) {
    scopes.add("meta");
  }
  if (
    !stableEqual(prev.inputs, next.inputs) ||
    !stableEqual(prev.outputs, next.outputs) ||
    !stableEqual(prev.setenv, next.setenv) ||
    !stableEqual(prev.examples, next.examples)
  ) {
    scopes.add("inputs");
  }
  if (
    !stableEqual(prev.description, next.description) ||
    !stableEqual(prev.title, next.title) ||
    !stableEqual(prev.tags, next.tags)
  ) {
    scopes.add("doc");
  }

  if (scopes.size === 0) {
    return [];
  }

  // Inputs/examples change the whole resolved request; treat as full rebuild.
  if (scopes.has("inputs")) {
    return ["all"];
  }

  return Array.from(scopes);
}

/**
 * Patch `generated` into `prev` for the given scopes, preserving touched fields.
 * When scopes resolve to `all`, behaves like a full merge (existing touched logic).
 */
export function applyScopedRequestData(
  prev: Request | undefined,
  generated: Request,
  scopes: ApiUiRefreshScope[],
  touchedFields: Set<RequestField>,
  respectTouched: boolean
): Request {
  const fields = requestFieldsForScopes(scopes);

  if (fields === "all") {
    return mergeTouched(prev, generated, touchedFields, respectTouched);
  }

  if (!prev || fields.length === 0) {
    return prev ?? generated;
  }

  const next: Request = { ...prev };
  let changed = false;
  for (const field of fields) {
    if (respectTouched && touchedFields.has(field)) {
      continue;
    }
    const nextValue = (generated as Record<string, unknown>)[field];
    if (stableEqual((prev as Record<string, unknown>)[field], nextValue)) {
      continue;
    }
    (next as Record<string, unknown>)[field] = nextValue;
    changed = true;
  }
  return changed ? next : prev;
}

function mergeTouched(
  prev: Request | undefined,
  generated: Request,
  touchedFields: Set<RequestField>,
  respectTouched: boolean
): Request {
  if (!respectTouched || !prev || touchedFields.size === 0) {
    return generated;
  }

  const merged = { ...generated } as Request;
  touchedFields.forEach((field) => {
    if (typeof prev[field] !== "undefined") {
      (merged as Record<string, unknown>)[field] = prev[field];
    }
  });
  return merged;
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return a === b;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
