import { Format, ResponseFormat } from "mmt-core/CommonData";
import { beautify, beautifyWithContentType } from "mmt-core/markupConvertor";
import type { Response } from "mmt-core/NetworkData";

export type ResponseTypeChoice = ResponseFormat;
export type ResponseViewMode = "raw" | "pretty" | "preview";

const PRETTY_FORMATS = new Set<Format>(["json", "xml", "xmle", "urlencoded"]);

/** Serialize a response/request body for storage without pretty-printing. */
export function responseBodyToRawString(body: unknown): string {
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

function formatFromContentType(contentType: string): Format | undefined {
  const ct = contentType.toLowerCase();
  if (!ct) {
    return undefined;
  }
  if (ct.includes("json")) {
    return "json";
  }
  if (ct.includes("html")) {
    return "html";
  }
  if (ct.includes("xml")) {
    return "xml";
  }
  if (ct.includes("urlencoded") || ct.includes("x-www-form-urlencoded")) {
    return "urlencoded";
  }
  if (ct.includes("multipart")) {
    return "multipart";
  }
  if (ct.includes("octet-stream")) {
    return "binary";
  }
  if (ct.includes("text/plain")) {
    return "text";
  }
  return undefined;
}

function sniffFormatFromBody(raw: string): Format {
  const trimmed = raw.trimStart();
  if (!trimmed) {
    return "text";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(raw);
      return "json";
    } catch {
      // fall through
    }
  }
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return "html";
  }
  if (trimmed.startsWith("<")) {
    return "xml";
  }
  if (/^[^=&\s]+=/.test(trimmed) && trimmed.includes("=") && !trimmed.includes("\n")) {
    return "urlencoded";
  }
  return "text";
}

/**
 * Infer display format: response Content-Type, else request format, else body sniff.
 */
export function detectResponseFormat(
  response: Response | undefined | null,
  requestFormatHint?: Format,
): Format {
  if (!response) {
    return requestFormatHint && requestFormatHint !== "none" ? requestFormatHint : "text";
  }
  const fromHeader = formatFromContentType(headerContentType(response.headers));
  if (fromHeader) {
    return fromHeader;
  }
  if (requestFormatHint && requestFormatHint !== "none") {
    return requestFormatHint;
  }
  return sniffFormatFromBody(responseBodyToRawString(response.body));
}

export function resolveResponseViewType(
  type: ResponseTypeChoice,
  response: Response | undefined | null,
  requestFormatHint?: Format,
): Format {
  if (type !== "auto") {
    return type;
  }
  return detectResponseFormat(response, requestFormatHint);
}

export function responseTypeSupportsPretty(type: ResponseTypeChoice): boolean {
  return type === "auto" || PRETTY_FORMATS.has(type);
}

export function responseTypeSupportsPreview(
  type: ResponseTypeChoice,
  resolved: Format,
): boolean {
  return type === "html" || (type === "auto" && resolved === "html");
}

/**
 * Body text for the Response panel. Pretty beautifies structured types;
 * raw and preview return the stored string.
 */
export function displayResponseBody(
  response: Response | undefined | null,
  options: { type: ResponseTypeChoice; view: ResponseViewMode; requestFormat?: Format },
): string {
  if (!response) {
    return "";
  }
  const raw = responseBodyToRawString(response.body);
  if (!raw || options.view !== "pretty" || !responseTypeSupportsPretty(options.type)) {
    return raw;
  }
  if (options.type === "auto") {
    const ct = headerContentType(response.headers);
    if (ct) {
      return beautifyWithContentType(ct, raw);
    }
    const hinted = options.requestFormat;
    if (hinted && hinted !== "none" && PRETTY_FORMATS.has(hinted)) {
      return beautify(hinted, raw);
    }
    return beautifyWithContentType("", raw);
  }
  return beautify(options.type, raw);
}
