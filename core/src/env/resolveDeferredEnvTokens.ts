/**
 * Resolve leftover `e:` / `<<e:>>` / `{{e:}}` tokens after UI Send freezes
 * r:/c: into `__mmt_requestOverride`. Live `./….mmt` env values stay deferred
 * through sync `resolveApiRequest`, so the override must still await them via
 * the process-store reader (`mmtEnv_`) before the wire send.
 *
 * Wire bodies are often already serialized (JSON / XML / urlencoded / text).
 * JSON keeps `{{e:…}}`; XML may keep bare `e:…` or entity-escaped `<<e:…>>`;
 * urlencoded percent-encodes `e:` / `<<` / `>>`. All of those must resolve.
 */

const ACCESSOR = '(?:\\.[A-Za-z_][A-Za-z0-9_]*|\\[[^\\]]+\\])*';
const NAME = '([A-Za-z_][A-Za-z0-9_\\-]*)';
const FULL_PLAIN = new RegExp(`^e:${NAME}(${ACCESSOR})$`);
const FULL_ANGLE = new RegExp(`^<<\\s*e:${NAME}(${ACCESSOR})\\s*>>$`);
const FULL_CURLY = new RegExp(`^\\{\\{\\s*e:${NAME}(${ACCESSOR})\\s*\\}\\}$`, 'i');
/** Embedded `<<e:…>>` / `{{e:…}}` (JSON string bodies, text, …). */
const EMBEDDED_WRAPPED = new RegExp(
    `<<\\s*e:${NAME}(${ACCESSOR})\\s*>>|\\{\\{\\s*e:${NAME}(${ACCESSOR})\\s*\\}\\}`,
    'gi');
/** XML js2xml escapes `<<e:…>>` element text to entities. */
const EMBEDDED_XML_ENTITY_ANGLE = new RegExp(
    `&lt;&lt;\\s*e:${NAME}(${ACCESSOR})\\s*&gt;&gt;`,
    'gi');
/**
 * Bare `e:name` inside a longer string (XML element text, text body, …).
 * Not a whole-value match — those use FULL_PLAIN.
 */
const EMBEDDED_BARE = new RegExp(
    `(?<![A-Za-z0-9_])e:${NAME}(${ACCESSOR})(?![A-Za-z0-9_])`,
    'gi');

export type DeferredEnvReader =
    (name: string, accessor?: string, mode?: string) => any|Promise<any>;

async function readEnv(
    reader: DeferredEnvReader, name: string, accessor: string): Promise<any> {
  return await Promise.resolve(reader(name, accessor || undefined, 'lookup'));
}

function tokenToWireText(resolved: unknown, fallback: string): string {
  if (resolved === undefined || resolved === null) {
    return fallback;
  }
  return typeof resolved === 'string' ? resolved : String(resolved);
}

/** True when this bare `e:` sits inside `{{…}}`, `<<…>>`, or `&lt;&lt;…&gt;&gt;`. */
function bareInsideShield(text: string, offset: number): boolean {
  if (offset >= 2) {
    const prev2 = text.slice(offset - 2, offset);
    if (prev2 === '{{' || prev2 === '<<') {
      return true;
    }
  }
  if (offset >= 8 &&
      text.slice(offset - 8, offset).toLowerCase() === '&lt;&lt;') {
    return true;
  }
  return false;
}

type EmbedHit = {
  index: number;
  length: number;
  name: string;
  accessor: string;
};

function collectWrappedHits(value: string): EmbedHit[] {
  const hits: EmbedHit[] = [];
  const re = new RegExp(EMBEDDED_WRAPPED.source, 'gi');
  let match: RegExpExecArray|null;
  while ((match = re.exec(value)) !== null) {
    const name = match[1] || match[3];
    const accessor = match[2] || match[4] || '';
    if (!name || match.index === undefined) {
      continue;
    }
    hits.push({
      index: match.index,
      length: match[0].length,
      name,
      accessor,
    });
  }
  return hits;
}

function collectEntityAngleHits(value: string): EmbedHit[] {
  const hits: EmbedHit[] = [];
  const re = new RegExp(EMBEDDED_XML_ENTITY_ANGLE.source, 'gi');
  let match: RegExpExecArray|null;
  while ((match = re.exec(value)) !== null) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    hits.push({
      index: match.index,
      length: match[0].length,
      name: match[1],
      accessor: match[2] || '',
    });
  }
  return hits;
}

function collectBareHits(value: string): EmbedHit[] {
  const hits: EmbedHit[] = [];
  const re = new RegExp(EMBEDDED_BARE.source, 'gi');
  let match: RegExpExecArray|null;
  while ((match = re.exec(value)) !== null) {
    if (!match[1] || match.index === undefined) {
      continue;
    }
    if (bareInsideShield(value, match.index)) {
      continue;
    }
    hits.push({
      index: match.index,
      length: match[0].length,
      name: match[1],
      accessor: match[2] || '',
    });
  }
  return hits;
}

async function applyHits(
    value: string, hits: EmbedHit[], reader: DeferredEnvReader): Promise<string> {
  if (hits.length === 0) {
    return value;
  }
  const ordered = [...hits].sort((a, b) => b.index - a.index);
  let out = value;
  for (const hit of ordered) {
    const resolved = await readEnv(reader, hit.name, hit.accessor);
    const text = tokenToWireText(resolved, out.slice(hit.index, hit.index + hit.length));
    out = out.slice(0, hit.index) + text + out.slice(hit.index + hit.length);
  }
  return out;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

/**
 * application/x-www-form-urlencoded freezes `e:` as `e%3A…` and `<<` as
 * `%3C%3C`. Decode each field, resolve, re-encode.
 */
function looksLikeUrlEncodedBody(value: string): boolean {
  if (!value || value.includes(' ') || value.includes('\n')) {
    return false;
  }
  if (!value.includes('=') && !value.includes('%')) {
    return false;
  }
  return /e%3A|%3C%3C|%7B%7B|e:/i.test(value);
}

async function resolveUrlEncodedBody(
    value: string, reader: DeferredEnvReader): Promise<string> {
  const parts = value.split('&');
  const out: string[] = [];
  for (const part of parts) {
    if (!part) {
      out.push(part);
      continue;
    }
    const eq = part.indexOf('=');
    if (eq < 0) {
      const decoded = safeDecodeURIComponent(part);
      const resolved = await resolvePlainString(decoded, reader);
      out.push(encodeURIComponent(
          resolved === undefined || resolved === null ?
            decoded :
            String(resolved)));
      continue;
    }
    const rawKey = part.slice(0, eq);
    const rawVal = part.slice(eq + 1);
    const decodedKey = safeDecodeURIComponent(rawKey);
    const decodedVal = safeDecodeURIComponent(rawVal);
    const resolvedKey = await resolvePlainString(decodedKey, reader);
    const resolvedVal = await resolvePlainString(decodedVal, reader);
    const keyText = resolvedKey === undefined || resolvedKey === null ?
      decodedKey :
      String(resolvedKey);
    const valText = resolvedVal === undefined || resolvedVal === null ?
      decodedVal :
      String(resolvedVal);
    out.push(`${encodeURIComponent(keyText)}=${encodeURIComponent(valText)}`);
  }
  return out.join('&');
}

/** Resolve e: tokens in an already-decoded string (no urlencoded splitting). */
async function resolvePlainString(
    value: string, reader: DeferredEnvReader): Promise<any> {
  const plain = FULL_PLAIN.exec(value);
  if (plain) {
    return readEnv(reader, plain[1], plain[2] || '');
  }
  const angle = FULL_ANGLE.exec(value);
  if (angle) {
    return readEnv(reader, angle[1], angle[2] || '');
  }
  const curly = FULL_CURLY.exec(value);
  if (curly) {
    return readEnv(reader, curly[1], curly[2] || '');
  }

  if (!value.includes('e:') && !value.includes('{{') && !value.includes('<<') &&
      !value.toLowerCase().includes('&lt;&lt;')) {
    return value;
  }

  let out = value;
  out = await applyHits(out, collectWrappedHits(out), reader);
  out = await applyHits(out, collectEntityAngleHits(out), reader);
  out = await applyHits(out, collectBareHits(out), reader);
  return out;
}

async function resolveString(
    value: string, reader: DeferredEnvReader): Promise<any> {
  if (looksLikeUrlEncodedBody(value)) {
    return resolveUrlEncodedBody(value, reader);
  }
  return resolvePlainString(value, reader);
}

/** Deep-walk a request (or any JSON-like value) and await deferred e: tokens. */
export async function resolveDeferredEnvTokens(
    value: any, reader: DeferredEnvReader): Promise<any> {
  if (typeof value === 'string') {
    return resolveString(value, reader);
  }
  if (Array.isArray(value)) {
    const out: any[] = [];
    for (const item of value) {
      out.push(await resolveDeferredEnvTokens(item, reader));
    }
    return out;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = await resolveDeferredEnvTokens(child, reader);
    }
    return out;
  }
  return value;
}
