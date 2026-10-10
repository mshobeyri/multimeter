export type Type = "env" | "api" | "test" | "suite" | "loadtest" | "doc" | "csv" | "server" | "report" | "judge" | null;

export type Protocol = "http" | "ws" | "graphql" | "grpc";
export type Format = "none" | "json" | "xml" | "xmle" | "text" | "html" | "urlencoded" | "binary" | "multipart";
/** Request/response format when set to `auto` (see formatResolve.ts). */
export type RequestFormat = Format | "auto";
/** Response display/parsing format; `auto` detects from Content-Type, then request format. */
export type ResponseFormat = Exclude<Format, "none"> | "auto";
/** Split request vs response body formats. */
export interface FormatConfig {
  request?: RequestFormat;
  response?: ResponseFormat;
}
/**
 * Body format: a scalar pins the request format; response defaults to `auto`
 * unless `{ request, response }` sets response explicitly.
 */
/** Scalar request format, shorthand `auto`, or split `{ request, response }`. */
export type FormatSpec = Format | "auto" | FormatConfig;
export type Method = "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
export type GrpcStream = "server" | "client" | "bidi";

export const FORMAT_VALUES: Format[] = ["none", "json", "xml", "xmle", "text", "html", "urlencoded", "binary", "multipart"];
export const REQUEST_FORMAT_VALUES: RequestFormat[] = [...FORMAT_VALUES, "auto"];
const RESPONSE_BODY_FORMATS: Exclude<Format, "none">[] = [
  "json", "xml", "xmle", "text", "html", "urlencoded", "binary", "multipart",
];
export const RESPONSE_FORMAT_VALUES: ResponseFormat[] = [...RESPONSE_BODY_FORMATS, "auto"];

export function toResponseFormat(format: Format): ResponseFormat {
  return format === "none" ? "auto" : format;
}

function isFormatValue(value: unknown): value is Format {
  return typeof value === "string" && (FORMAT_VALUES as string[]).includes(value);
}

function isRequestFormatValue(value: unknown): value is RequestFormat {
  return typeof value === "string" &&
      (value === "auto" || (FORMAT_VALUES as string[]).includes(value));
}

function isResponseFormatValue(value: unknown): value is ResponseFormat {
  return typeof value === "string" &&
      (RESPONSE_FORMAT_VALUES as string[]).includes(value);
}

function coerceResponseFormat(rawResponse: unknown, request: RequestFormat): ResponseFormat {
  if (rawResponse === undefined || rawResponse === null || rawResponse === "none") {
    return "auto";
  }
  if (isResponseFormatValue(rawResponse)) {
    return rawResponse;
  }
  if (request !== "none" && request !== "auto" && isResponseFormatValue(request)) {
    return request;
  }
  return "auto";
}

/**
 * Normalize format from YAML/UI.
 * Accepts `response` or legacy alias `respond`.
 */
export function normalizeFormat(format?: FormatSpec | null | Record<string, unknown>): {
  request: RequestFormat;
  response: ResponseFormat;
} {
  if (format == null) {
    return { request: "auto", response: "auto" };
  }
  if (typeof format === "string") {
    if (format === "auto") {
      return { request: "auto", response: "auto" };
    }
    if (format === "none") {
      return { request: "none", response: "auto" };
    }
    const value = isFormatValue(format) ? format : "json";
    return { request: value, response: "auto" };
  }
  if (typeof format === "object" && !Array.isArray(format)) {
    const rawRequest = (format as any).request;
    const rawResponse = (format as any).response ?? (format as any).respond;
    const request = isRequestFormatValue(rawRequest)
      ? rawRequest
      : (isFormatValue(rawResponse) ? rawResponse : "auto");
    const response = coerceResponseFormat(rawResponse, request);
    return { request, response };
  }
  return { request: "auto", response: "auto" };
}

export function requestFormat(format?: FormatSpec | null | Record<string, unknown>): RequestFormat {
  return normalizeFormat(format).request;
}

export function responseFormat(format?: FormatSpec | null | Record<string, unknown>): ResponseFormat {
  return normalizeFormat(format).response;
}

/** Compact for YAML write-back.
 * Scalar when response is auto (response defaults to detect). Explicit matching
 * request/response stay as an object so Save keeps the user's response choice. */
export function packFormatSpec(format?: FormatSpec | null): FormatSpec | undefined {
  if (format == null) {
    return undefined;
  }
  const { request, response } = normalizeFormat(format);
  if (request === "none" && response === "auto") {
    return "none";
  }
  if (response === "auto" && request !== "auto") {
    return request;
  }
  if (request === "auto" && response === "auto") {
    return "auto";
  }
  return { request, response };
}

export const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

/** Gallery / new-file type picker — labels and values from shared {@link MMT_FILE_TYPES}. */
export {MMT_FILE_TYPE_OPTIONS as typeOptions} from './mmtFileType';

export interface MMTFile {
  type: Type;
  import?: Record<string, string>;
};

export type JSONValue =  string | number | boolean | object | null;
export type Parameter = { [key: string]: JSONValue };
export type JSONRecord = Record<string, JSONValue>;

export type LogLevel = 'trace' | 'debug' | 'error' | 'warn' | 'info' | 'log';
/** How check/assert/debug steps write to the console. CLI `--quiet` sets `none`. */
export type CheckLogMode = 'default' | 'failures-only' | 'none';
/** Shared export/report formats for CLI, extension, and webview. */
export type ReportFormat = 'junit' | 'mmt' | 'html' | 'md' | 'md-detailed';

export function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) {
    return '0ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    const s = Math.floor(ms / 1000);
    const rem = Math.round(ms % 1000);
    return rem > 0 ? `${s}s ${rem}ms` : `${s}s`;
  }
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.round((ms % 86_400_000) / 3_600_000);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
