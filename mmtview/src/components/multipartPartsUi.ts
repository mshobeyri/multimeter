import {
  coerceMultipartPartsInput,
  type MultipartPartSpec,
} from "mmt-core/multipartBody";

export type MultipartPartKind = "text" | "file";

export interface MultipartPartRow {
  name: string;
  kind: MultipartPartKind;
  value: string;
  contentType?: string;
  filename?: string;
}

export function emptyMultipartPartRow(): MultipartPartRow {
  return { name: "", kind: "text", value: "" };
}

export function isEmptyMultipartPartRow(row: MultipartPartRow): boolean {
  return !String(row.name || "").trim()
    && !String(row.value || "").trim()
    && !row.contentType
    && !row.filename;
}

export function withTrailingEmptyMultipartRows(rows: MultipartPartRow[]): MultipartPartRow[] {
  if (rows.length === 0 || !isEmptyMultipartPartRow(rows[rows.length - 1])) {
    return [...rows, emptyMultipartPartRow()];
  }
  return rows;
}

function optionalString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text ? text : undefined;
}

function rowFromRaw(raw: unknown): MultipartPartRow | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const spec = raw as MultipartPartSpec;
  const hasFileField = Object.prototype.hasOwnProperty.call(raw, "file");
  const kind: MultipartPartKind = hasFileField ? "file" : "text";
  const value = kind === "file"
    ? String(spec.file ?? "").trim()
    : (spec.value == null ? "" : String(spec.value));
  const row: MultipartPartRow = {
    name: spec.name == null ? "" : String(spec.name),
    kind,
    value,
  };
  const contentType = optionalString(spec.contentType);
  if (contentType) {
    row.contentType = contentType;
  }
  const filename = optionalString(spec.filename);
  if (filename) {
    row.filename = filename;
  }
  return row;
}

export function bodyToMultipartRows(body: unknown, addEmpty = true): MultipartPartRow[] {
  const coerced = coerceMultipartPartsInput(body);
  const rows: MultipartPartRow[] = [];
  if (Array.isArray(coerced)) {
    for (const raw of coerced) {
      const row = rowFromRaw(raw);
      if (row) {
        rows.push(row);
      }
    }
  }
  return addEmpty ? withTrailingEmptyMultipartRows(rows) : rows;
}

function applyOptionalMeta(part: MultipartPartSpec, row: MultipartPartRow): MultipartPartSpec {
  if (row.contentType) {
    part.contentType = row.contentType;
  }
  if (row.filename) {
    part.filename = row.filename;
  }
  return part;
}

export function multipartRowsToBody(rows: MultipartPartRow[]): MultipartPartSpec[] | undefined {
  const parts: MultipartPartSpec[] = [];
  for (const row of rows) {
    const name = String(row.name || "").trim();
    if (!name) {
      continue;
    }
    if (row.kind === "file") {
      parts.push(applyOptionalMeta({
        name,
        file: String(row.value || "").trim(),
      }, row));
      continue;
    }
    parts.push(applyOptionalMeta({
      name,
      value: row.value == null ? "" : String(row.value),
    }, row));
  }
  return parts.length ? parts : undefined;
}

export function multipartPartsSignature(body: unknown): string {
  try {
    return JSON.stringify(multipartRowsToBody(bodyToMultipartRows(body, false)) ?? null);
  } catch {
    return "";
  }
}
