export type Type = "env" | "api" | "test" | "suite" | "doc" | "csv" | "server" | "report" | null;

export type Protocol = "http" | "ws" | "graphql" | "grpc";
export type Format = "json" | "xml" | "text";
export type Method = "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
export type GrpcStream = "server" | "client" | "bidi";

export const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

export const typeOptions = [
  { value: "api", label: "API" },
  { value: "env", label: "Environment" },
  { value: "test", label: "Test" },
  { value: "suite", label: "Suite" },
  { value: "doc", label: "Documentation" },
  { value: "server", label: "Mock Server" },
  { value: "report", label: "Report" }
];

export interface MMTFile {
  type: Type;
};

export type JSONValue =  string | number | boolean | object | null;
export type Parameter = { [key: string]: JSONValue };
export type JSONRecord = Record<string, JSONValue>;

export type LogLevel = 'trace' | 'debug' | 'error' | 'warn' | 'info' | 'log';

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
