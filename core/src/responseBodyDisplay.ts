import {
  binaryBodyDataUrl,
  binaryBodyRawText,
  isBinaryBodyPayload,
} from './binaryBody';
import {Format, RequestFormat, ResponseFormat} from './CommonData';
import {
  headerContentType,
  resolveRequestFormat,
  resolveResponseFormat,
} from './formatResolve';
import {beautify, beautifyWithContentType} from './markupConvertor';
import type {Response} from './NetworkData';

export type ResponseTypeChoice = ResponseFormat;
export type ResponseViewMode = 'raw' | 'pretty' | 'preview';
export type ResponsePreviewKind = 'html' | 'image';

/** Formats that support the response-panel Pretty view. */
export const RESPONSE_PRETTY_FORMATS = new Set<Format>([
  'json', 'xml', 'xmle', 'urlencoded', 'html',
]);

export interface ResponseDisplayOptions {
  type: ResponseTypeChoice;
  view: ResponseViewMode;
  requestFormat?: RequestFormat;
  requestHeaders?: Record<string, string>;
}

export interface ResponseDisplayState {
  resolvedType: Format;
  prettyAvailable: boolean;
  previewAvailable: boolean;
  previewKind: ResponsePreviewKind | undefined;
  previewImageUrl: string | undefined;
  effectiveView: ResponseViewMode;
  displayText: string;
  previewHtml: string | undefined;
}

/** Serialize a response/request body for storage without pretty-printing. */
export function responseBodyToRawString(body: unknown): string {
  if (isBinaryBodyPayload(body)) {
    return binaryBodyRawText(body);
  }
  if (body === null || body === undefined) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return String(body);
}

export function detectResponseFormat(
    response: Response | undefined | null,
    resolvedRequestFormat?: Format,
): Format {
  return resolveResponseFormat('auto', {
    responseHeaders: response?.headers,
    requestFormat: resolvedRequestFormat,
    body: response?.body,
  });
}

export function resolveResponseViewType(
    type: ResponseTypeChoice,
    response: Response | undefined | null,
    requestFormatHint?: RequestFormat | Format,
    requestHeaders?: Record<string, string>,
): Format {
  const resolvedRequest = requestFormatHint === 'auto' ?
      resolveRequestFormat('auto', requestHeaders) :
      requestFormatHint;
  return resolveResponseFormat(type, {
    responseHeaders: response?.headers,
    requestFormat: resolvedRequest,
    body: response?.body,
  });
}

export function responseTypeSupportsPretty(
    type: ResponseTypeChoice,
    resolved: Format,
): boolean {
  const format = type === 'auto' ? resolved : type;
  return RESPONSE_PRETTY_FORMATS.has(format);
}

export function responseTypeSupportsPreview(
    type: ResponseTypeChoice,
    resolved: Format,
    body?: unknown,
): boolean {
  return resolveResponsePreviewKind(type, resolved, body) !== undefined;
}

export function resolveResponsePreviewKind(
    type: ResponseTypeChoice,
    resolved: Format,
    body?: unknown,
): ResponsePreviewKind | undefined {
  if (type === 'html' || (type === 'auto' && resolved === 'html')) {
    return 'html';
  }
  if (isBinaryBodyPayload(body) && body.previewMime?.startsWith('image/')) {
    if (type === 'binary' || (type === 'auto' && resolved === 'binary')) {
      return 'image';
    }
  }
  return undefined;
}

export function resolveResponsePreviewImageUrl(body: unknown): string | undefined {
  if (!isBinaryBodyPayload(body)) {
    return undefined;
  }
  return binaryBodyDataUrl(body);
}

export function coerceResponseView(
    view: ResponseViewMode,
    prettyAvailable: boolean,
    previewAvailable: boolean,
): ResponseViewMode {
  if (view === 'preview' && !previewAvailable) {
    return 'raw';
  }
  if (view === 'pretty' && !prettyAvailable) {
    return 'raw';
  }
  return view;
}

export function displayResponseBody(
    response: Response | undefined | null,
    options: ResponseDisplayOptions,
): string {
  if (!response) {
    return '';
  }
  const raw = responseBodyToRawString(response.body);
  const resolvedType = resolveResponseViewType(
      options.type,
      response,
      options.requestFormat,
      options.requestHeaders,
  );
  if (!raw || options.view !== 'pretty' ||
      !responseTypeSupportsPretty(options.type, resolvedType)) {
    return raw;
  }
  if (options.type === 'auto') {
    const ct = headerContentType(response.headers);
    if (ct) {
      return beautifyWithContentType(ct, raw);
    }
    const resolvedRequest = options.requestFormat === 'auto' ?
        resolveRequestFormat('auto', options.requestHeaders) :
        options.requestFormat;
    if (resolvedRequest && resolvedRequest !== 'none' &&
        RESPONSE_PRETTY_FORMATS.has(resolvedRequest)) {
      return beautify(resolvedRequest, raw);
    }
    return beautifyWithContentType('', raw);
  }
  return beautify(options.type, raw);
}

/** Resolve format, view availability, and display strings for the response panel. */
export function resolveResponseDisplayState(
    response: Response | undefined | null,
    options: ResponseDisplayOptions,
): ResponseDisplayState {
  const resolvedType = resolveResponseViewType(
      options.type,
      response,
      options.requestFormat,
      options.requestHeaders,
  );
  const prettyAvailable = responseTypeSupportsPretty(options.type, resolvedType);
  const previewKind = resolveResponsePreviewKind(
      options.type,
      resolvedType,
      response?.body,
  );
  const previewAvailable = previewKind !== undefined;
  const previewImageUrl = previewKind === 'image' ?
      resolveResponsePreviewImageUrl(response?.body) :
      undefined;
  const effectiveView = coerceResponseView(
      options.view,
      prettyAvailable,
      previewAvailable,
  );
  const displayText = displayResponseBody(response, {
    ...options,
    view: effectiveView,
  });
  const previewHtml = previewKind === 'html' ?
      displayResponseBody(response, {...options, view: 'preview'}) :
      undefined;
  return {
    resolvedType,
    prettyAvailable,
    previewAvailable,
    previewKind,
    previewImageUrl,
    effectiveView,
    displayText,
    previewHtml,
  };
}
