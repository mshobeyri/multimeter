import {APIData} from './APIData';
import {JSONRecord, requestFormat} from './CommonData';
import {Request} from './NetworkData';
import {applyAuthToRequest} from './apiParsePack';
import {formatBody} from './markupConvertor';
import {stripOmitFromRequest} from './omitKeyword';
import {replaceAllRefs} from './variableReplacer';

export interface ResolveApiRequestOptions {
  /** Clear r:/c: caches so each resolve gets fresh runtime values. */
  refreshRuntimeTokens?: boolean;
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
      {refreshRuntimeTokens: options.refreshRuntimeTokens}) as Request & {auth?: unknown};
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

  if (request.body && typeof request.body !== 'string') {
    request.body = formatBody(requestFormat(request.format), request.body ?? '');
  }

  return request;
}
