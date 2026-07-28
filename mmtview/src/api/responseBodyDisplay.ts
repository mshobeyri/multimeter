import { beautifyWithContentType } from "mmt-core/markupConvertor";
import type { Response } from "mmt-core/NetworkData";

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

/**
 * Body text for the Response panel: raw unless auto-format is on, in which case
 * JSON/XML is beautified from the stored raw string (toggleable after send).
 */
export function displayResponseBody(
  response: Response | undefined | null,
  autoFormat: boolean,
): string {
  if (!response) {
    return "";
  }
  const raw = responseBodyToRawString(response.body);
  if (!autoFormat || !raw) {
    return raw;
  }
  const headers = response.headers || {};
  const contentType =
    headers["Content-Type"] ||
    headers["content-type"] ||
    "";
  return beautifyWithContentType(contentType, raw);
}
