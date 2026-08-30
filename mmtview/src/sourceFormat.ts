export type SourceFormat = "mmt" | "http" | "bruno" | "openapi" | "postman" | "wsdl";

export const SPEC_SOURCE_FORMATS = ["openapi", "postman", "wsdl"] as const;

export function isSpecSourceFormat(format: string | undefined): format is typeof SPEC_SOURCE_FORMATS[number] {
  return !!format && (SPEC_SOURCE_FORMATS as readonly string[]).includes(format);
}

export function parseSourceFormat(value: unknown, fallback: SourceFormat = "mmt"): SourceFormat {
  if (value === "http" || value === "bruno" || value === "openapi" ||
      value === "postman" || value === "wsdl" || value === "mmt") {
    return value;
  }
  return fallback;
}

export function editorLanguageForSource(format: SourceFormat, filePath?: string): string {
  if (format === "http" || format === "bruno") {
    return "http";
  }
  if (format === "wsdl") {
    return "xml";
  }
  if (format === "postman") {
    return "json";
  }
  if (format === "openapi") {
    const lower = String(filePath || "").toLowerCase();
    if (lower.endsWith(".json")) {
      return "json";
    }
    return "yaml";
  }
  return "yaml";
}
