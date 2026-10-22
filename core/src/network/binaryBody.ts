/** Structured binary payload for HTTP responses (JSON-safe across webview/logs). */
export interface BinaryBodyPayload {
  __mmtBinary: true;
  base64: string;
  byteLength: number;
  contentType?: string;
  /** Set when the UI can render a visual preview (e.g. image/png). */
  previewMime?: string;
}

export function isBinaryBodyPayload(body: unknown): body is BinaryBodyPayload {
  return typeof body === "object" && body !== null &&
      (body as BinaryBodyPayload).__mmtBinary === true &&
      typeof (body as BinaryBodyPayload).base64 === "string" &&
      typeof (body as BinaryBodyPayload).byteLength === "number";
}

const BASE64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += BASE64_CHARS[(triplet >> 18) & 63];
    output += BASE64_CHARS[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_CHARS[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? BASE64_CHARS[triplet & 63] : "=";
  }
  return output;
}

export function toByteArray(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array(0);
}

export function primaryContentType(contentType: string | undefined): string {
  return (contentType || "").split(";")[0].trim().toLowerCase();
}

export function isBinaryContentType(contentType: string | undefined): boolean {
  const ct = primaryContentType(contentType);
  if (!ct) {
    return false;
  }
  if (ct.startsWith("image/")) {
    return true;
  }
  if (ct === "application/octet-stream") {
    return true;
  }
  if (ct === "application/pdf") {
    return true;
  }
  return false;
}

export function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 256));
  let text = "";
  try {
    text = new TextDecoder().decode(sample).trimStart();
  } catch {
    return undefined;
  }
  if (text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"))) {
    return "image/svg+xml";
  }
  return undefined;
}

export function resolveBinaryPreviewMime(
    contentType: string | undefined,
    bytes: Uint8Array,
): string | undefined {
  const ct = primaryContentType(contentType);
  if (ct.startsWith("image/")) {
    return ct;
  }
  return sniffImageMime(bytes);
}

export function encodeBinaryBody(
    bytes: Uint8Array,
    contentType?: string,
): BinaryBodyPayload {
  const previewMime = resolveBinaryPreviewMime(contentType, bytes);
  return {
    __mmtBinary: true,
    base64: bytesToBase64(bytes),
    byteLength: bytes.length,
    contentType: primaryContentType(contentType) || undefined,
    previewMime,
  };
}

export function decodeBinaryBody(payload: BinaryBodyPayload): Uint8Array {
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function binaryBodyRawText(payload: BinaryBodyPayload): string {
  return payload.base64;
}

export function binaryBodyDataUrl(payload: BinaryBodyPayload): string | undefined {
  const mime = payload.previewMime || payload.contentType;
  if (!mime || !mime.startsWith("image/")) {
    return undefined;
  }
  return `data:${mime};base64,${payload.base64}`;
}

export function binaryBodyLogLabel(payload: BinaryBodyPayload): string {
  return `<binary ${payload.byteLength} bytes>`;
}

/** Normalize HTTP response bytes to a text body or structured binary payload. */
export function normalizeHttpResponseBody(
    data: unknown,
    headers: Record<string, string>,
): string | BinaryBodyPayload {
  const bytes = toByteArray(data);
  const contentType = headerContentType(headers);
  if (isBinaryContentType(contentType)) {
    return encodeBinaryBody(bytes, contentType);
  }
  return new TextDecoder("utf-8").decode(bytes);
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
