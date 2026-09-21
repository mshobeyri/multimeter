import {
  binaryBodyDataUrl,
  binaryBodyRawText,
  isBinaryBodyPayload,
} from "mmt-core/binaryBody";
import { Format, RequestFormat, ResponseFormat } from "mmt-core/CommonData";
import { resolveRequestFormat, resolveResponseFormat } from "mmt-core/formatResolve";
import { beautify, beautifyWithContentType } from "mmt-core/markupConvertor";
import type { Response } from "mmt-core/NetworkData";

export type ResponseTypeChoice = ResponseFormat;
export type ResponseViewMode = "raw" | "pretty" | "preview";
export type ResponsePreviewKind = "html" | "image";

const PRETTY_FORMATS = new Set<Format>(["json", "xml", "xmle", "urlencoded", "html"]);

/** Serialize a response/request body for storage without pretty-printing. */
export function responseBodyToRawString(body: unknown): string {
  if (isBinaryBodyPayload(body)) {
    return binaryBodyRawText(body);
  }
  if (body === null || body === undefined) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  if (typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return String(body);
}

function headerContentType(headers?: Record<string, string>): string {
  if (!headers) {
    return "";
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-type") {
      return value == null ? "" : String(value);
    }
  }
  return "";
}

export function detectResponseFormat(
  response: Response | undefined | null,
  resolvedRequestFormat?: Format,
): Format {
  return resolveResponseFormat("auto", {
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
  const resolvedRequest = requestFormatHint === "auto"
    ? resolveRequestFormat("auto", requestHeaders)
    : requestFormatHint;
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
  if (type === "auto") {
    return PRETTY_FORMATS.has(resolved);
  }
  return PRETTY_FORMATS.has(type);
}

export function responseTypeSupportsPreview(
  type: ResponseTypeChoice,
  resolved: Format,
  body?: unknown,
): boolean {
  if (type === "html" || (type === "auto" && resolved === "html")) {
    return true;
  }
  if (isBinaryBodyPayload(body) && body.previewMime?.startsWith("image/")) {
    return type === "binary" || (type === "auto" && resolved === "binary");
  }
  return false;
}

export function resolveResponsePreviewKind(
  type: ResponseTypeChoice,
  resolved: Format,
  body?: unknown,
): ResponsePreviewKind | undefined {
  if (!responseTypeSupportsPreview(type, resolved, body)) {
    return undefined;
  }
  if (type === "html" || (type === "auto" && resolved === "html")) {
    return "html";
  }
  if (isBinaryBodyPayload(body) && body.previewMime?.startsWith("image/")) {
    return "image";
  }
  return undefined;
}

export function resolveResponsePreviewImageUrl(body: unknown): string | undefined {
  if (!isBinaryBodyPayload(body)) {
    return undefined;
  }
  return binaryBodyDataUrl(body);
}

export function displayResponseBody(
  response: Response | undefined | null,
  options: { type: ResponseTypeChoice; view: ResponseViewMode; requestFormat?: RequestFormat; requestHeaders?: Record<string, string> },
): string {
  if (!response) {
    return "";
  }
  const raw = responseBodyToRawString(response.body);
  if (!raw || options.view !== "pretty" || !responseTypeSupportsPretty(options.type, resolveResponseViewType(
    options.type,
    response,
    options.requestFormat,
    options.requestHeaders,
  ))) {
    return raw;
  }
  if (options.type === "auto") {
    const ct = headerContentType(response.headers);
    if (ct) {
      return beautifyWithContentType(ct, raw);
    }
    const resolvedRequest = options.requestFormat === "auto"
      ? resolveRequestFormat("auto", options.requestHeaders)
      : options.requestFormat;
    if (resolvedRequest && resolvedRequest !== "none" && PRETTY_FORMATS.has(resolvedRequest)) {
      return beautify(resolvedRequest, raw);
    }
    return beautifyWithContentType("", raw);
  }
  return beautify(options.type, raw);
}
