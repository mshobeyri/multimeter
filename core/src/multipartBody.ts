import {OMIT_SENTINEL, isOmitSentinel} from './omitKeyword';

export interface MultipartPartSpec {
  name: string;
  value?: string;
  file?: string;
  contentType?: string;
  filename?: string;
}

export interface ResolvedMultipartPart {
  name: string;
  content: string | Uint8Array;
  contentType?: string;
  filename?: string;
}

export interface MultipartBodyResult {
  body: Uint8Array;
  contentType: string;
}

function hasBuffer(): boolean {
  return typeof Buffer !== 'undefined';
}

function toBytes(value: string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (hasBuffer()) {
    return Buffer.from(value, 'utf8');
  }
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (hasBuffer()) {
    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function escapeDispositionValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function basename(path: string): string {
  const normalized = String(path || '').replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function generateBoundary(): string {
  const cryptoObj = typeof globalThis !== 'undefined'
      ? (globalThis as {crypto?: {getRandomValues?: (arr: Uint8Array) => void}}).crypto
      : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  return `mmt${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** Accept a parts array, or the JSON string the body editor shows for multipart. */
export function coerceMultipartPartsInput(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trim();
  if (!trimmed.startsWith('[')) {
    return body;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}

export function normalizeMultipartParts(body: unknown): MultipartPartSpec[] {
  const input = coerceMultipartPartsInput(body);
  if (!Array.isArray(input)) {
    throw new Error('Invalid multipart body: expected an array of parts');
  }
  const parts: MultipartPartSpec[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid multipart body: each part must be an object');
    }
    const name = (raw as MultipartPartSpec).name;
    if (name == null || String(name).trim() === '') {
      throw new Error('Invalid multipart body: each part requires a non-empty "name"');
    }
    const value = (raw as MultipartPartSpec).value;
    const file = (raw as MultipartPartSpec).file;
    const hasValue = value != null && String(value) !== '' && !isOmitSentinel(value);
    const hasFile = file != null && String(file).trim() !== '' && !isOmitSentinel(file);
    if (hasValue && hasFile) {
      throw new Error(`Invalid multipart body: part "${name}" cannot have both "value" and "file"`);
    }
    if (!hasValue && !hasFile) {
      continue;
    }
    const part: MultipartPartSpec = {name: String(name)};
    if (hasValue) {
      part.value = String(value);
    }
    if (hasFile) {
      part.file = String(file).trim();
    }
    const contentType = (raw as MultipartPartSpec).contentType;
    if (contentType != null && String(contentType).trim() !== '') {
      part.contentType = String(contentType);
    }
    const filename = (raw as MultipartPartSpec).filename;
    if (filename != null && String(filename).trim() !== '') {
      part.filename = String(filename);
    } else if (part.file) {
      part.filename = basename(part.file);
    }
    parts.push(part);
  }
  if (parts.length === 0) {
    throw new Error('Invalid multipart body: at least one part is required');
  }
  return parts;
}

export function buildMultipartBuffer(
    parts: ResolvedMultipartPart[],
    boundary = generateBoundary()): MultipartBodyResult {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Invalid multipart body: at least one part is required');
  }
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    let disposition = `form-data; name="${escapeDispositionValue(part.name)}"`;
    if (part.filename) {
      disposition += `; filename="${escapeDispositionValue(part.filename)}"`;
    }
    let header = `--${boundary}\r\nContent-Disposition: ${disposition}\r\n`;
    if (part.contentType) {
      header += `Content-Type: ${part.contentType}\r\n`;
    }
    header += '\r\n';
    chunks.push(toBytes(header));
    chunks.push(toBytes(part.content));
    chunks.push(toBytes('\r\n'));
  }
  chunks.push(toBytes(`--${boundary}--\r\n`));
  return {
    body: concatBytes(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function buildMultipartBodyFromParts(
    partsInput: unknown,
    readBinaryFile?: (path: string) => Promise<Uint8Array | Buffer>,
): Promise<MultipartBodyResult> {
  const specs = Array.isArray(partsInput)
      ? partsInput as MultipartPartSpec[]
      : normalizeMultipartParts(partsInput);
  const resolved: ResolvedMultipartPart[] = [];
  for (const spec of specs) {
    if (spec.file) {
      if (typeof readBinaryFile !== 'function') {
        throw new Error('Binary file loader not available');
      }
      const content = await readBinaryFile(spec.file);
      resolved.push({
        name: spec.name,
        content,
        contentType: spec.contentType || 'application/octet-stream',
        filename: spec.filename || basename(spec.file),
      });
      continue;
    }
    resolved.push({
      name: spec.name,
      content: spec.value == null ? '' : String(spec.value),
      contentType: spec.contentType || 'text/plain; charset=utf-8',
    });
  }
  return buildMultipartBuffer(resolved);
}

export function stripOmitFromMultipartParts(parts: unknown): unknown {
  if (!Array.isArray(parts)) {
    return parts;
  }
  return parts.filter(part => {
    if (!part || typeof part !== 'object') {
      return false;
    }
    const value = (part as MultipartPartSpec).value;
    const file = (part as MultipartPartSpec).file;
    if (isOmitSentinel(value) || isOmitSentinel(file)) {
      return false;
    }
    const hasValue = value != null && String(value) !== '';
    const hasFile = file != null && String(file).trim() !== '';
    return hasValue || hasFile;
  }).map(part => {
    const next = {...(part as MultipartPartSpec)};
    if (isOmitSentinel(next.value)) {
      delete next.value;
    }
    if (isOmitSentinel(next.file)) {
      delete next.file;
    }
    return next;
  });
}
