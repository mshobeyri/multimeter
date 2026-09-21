import { Format } from "mmt-core/CommonData";
import { beautify, beautifyWithContentType } from "mmt-core/markupConvertor";
import type { Response } from "mmt-core/NetworkData";

export type ResponseTypeChoice = "auto" | Format;
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

/** Infer a display Format from Content-Type and/or body text. */
export function detectResponseFormat(response: Response | undefined | null): Format {
  if (!response) {
    return "text";
  }
  const ct = headerContentType(response.headers).toLowerCase();
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

  const raw = responseBodyToRawString(response.body);
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

export function resolveResponseViewType(
  type: ResponseTypeChoice,
  response: Response | undefined | null,
): Format {
  if (type !== "auto") {
    return type;
  }
  return detectResponseFormat(response);
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
  options: { type: ResponseTypeChoice; view: ResponseViewMode },
): string {
  if (!response) {
    return "";
  }
  const raw = responseBodyToRawString(response.body);
  if (!raw || options.view !== "pretty" || !responseTypeSupportsPretty(options.type)) {
    return raw;
  }
  if (options.type === "auto") {
    return beautifyWithContentType(headerContentType(response.headers), raw);
  }
  return beautify(options.type, raw);
}
