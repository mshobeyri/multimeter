import { APIData } from "mmt-core/APIData";
import { JSONRecord, requestFormat } from "mmt-core/CommonData";
import { Request } from "mmt-core/NetworkData";
import { applyAuthToRequest } from "mmt-core/apiParsePack";
import { formatBody } from "mmt-core/markupConvertor";
import {
  replaceAllRefs,
  resetCurrentTokenCache,
  resetRandomTokenCache,
} from "mmt-core/variableReplacer";
import { stripOmitFromRequest } from "mmt-core/omitKeyword";

export interface ResolveApiTesterRequestOptions {
  /** Clear r:/c: caches so each send gets fresh runtime values. */
  refreshRuntimeTokens?: boolean;
}

/**
 * Resolve env/input/random/current tokens into a concrete API tester request.
 * Used for initial panel load and again before each send when runtime tokens
 * must be regenerated.
 */
export function resolveApiTesterRequest(
  api: APIData,
  inputs: JSONRecord,
  envParameters: JSONRecord,
  options: ResolveApiTesterRequestOptions = {}
): Request & { auth?: unknown } {
  if (options.refreshRuntimeTokens) {
    resetRandomTokenCache();
    resetCurrentTokenCache();
  }

  let request = replaceAllRefs(
    api,
    api?.inputs ?? {},
    inputs,
    envParameters
  ) as Request & { auth?: unknown };
  request = stripOmitFromRequest(request) as Request & { auth?: unknown };

  if (request.auth) {
    const applied = applyAuthToRequest(
      request.auth as Parameters<typeof applyAuthToRequest>[0],
      request.headers || {},
      request.query
    );
    request.headers = applied.headers;
    if (applied.query) {
      request.query = applied.query;
    }
    delete request.auth;
  }

  if (request.body && typeof request.body !== "string") {
    request.body = formatBody(requestFormat(request.format), request.body ?? "");
  }

  return request;
}
