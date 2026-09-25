import {APIData} from './APIData';
import {JSONRecord, requestFormat} from './CommonData';
import {resolveRequestFormat} from './formatResolve';
import {Request} from './NetworkData';
import {applyAuthToRequest} from './apiParsePack';
import {formatBody} from './markupConvertor';
import {stripOmitFromRequest} from './omitKeyword';
import {replaceAllRefs} from './variableReplacer';

export interface ResolveApiRequestOptions {
  /** Clear r:/c: caches so each resolve gets fresh runtime values. */
  refreshRuntimeTokens?: boolean;
  /** Keep YAML/JSON object bodies structured for UI format switching (still resolves e:/i:/r:/c:). */
  preserveStructuredBody?: boolean;
}

/**
 * Resolve env/input/random/current tokens into a concrete API request.
 * Shared by the API tester UI, curl export, and other preview paths.
 */
export function resolveApiRequest(
    api: APIData,
    inputs: JSONRecord,
    envParameters: JSONRecord,
    options: ResolveApiRequestOptions = {},
): Request & {auth?: unknown} {
  let request = replaceAllRefs(
      api,
      api?.inputs ?? {},
      inputs,
      envParameters,
      new Set(),
      {
        refreshRuntimeTokens: options.refreshRuntimeTokens,
      }) as Request & {auth?: unknown};
  request = stripOmitFromRequest(request) as Request & {auth?: unknown};

  if (request.auth) {
    const applied = applyAuthToRequest(
        request.auth as Parameters<typeof applyAuthToRequest>[0],
        request.headers || {},
        request.query);
    request.headers = applied.headers;
    if (applied.query) {
      request.query = applied.query;
    }
    delete request.auth;
  }

  const reqFormat = resolveRequestFormat(
      requestFormat(request.format),
      request.headers,
      request.method,
  );
  // Multipart `body` is a parts array. The UI JSON-previews it, but Send must
  // keep the array so the runner can build multipart/form-data.
  if (!options.preserveStructuredBody &&
      request.body && typeof request.body !== 'string' && reqFormat !== 'multipart') {
    request.body = formatBody(reqFormat, request.body ?? '');
  }

  return request;
}
