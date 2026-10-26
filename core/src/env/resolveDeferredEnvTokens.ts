/**
 * Resolve leftover `e:` / `<<e:>>` / `{{e:}}` tokens after UI Send freezes
 * r:/c: into `__mmt_requestOverride`. Live `./….mmt` env values stay deferred
 * through sync `resolveApiRequest`, so the override must still await them via
 * the process-store reader (`mmtEnv_`) before the wire send.
 */

const ACCESSOR = '(?:\\.[A-Za-z_][A-Za-z0-9_]*|\\[[^\\]]+\\])*';
const NAME = '([A-Za-z_][A-Za-z0-9_\\-]*)';
const FULL_PLAIN = new RegExp(`^e:${NAME}(${ACCESSOR})$`);
const FULL_ANGLE = new RegExp(`^<<\\s*e:${NAME}(${ACCESSOR})\\s*>>$`);
const FULL_CURLY = new RegExp(`^\\{\\{\\s*e:${NAME}(${ACCESSOR})\\s*\\}\\}$`, 'i');
const EMBEDDED = new RegExp(
    `<<\\s*e:${NAME}(${ACCESSOR})\\s*>>|\\{\\{\\s*e:${NAME}(${ACCESSOR})\\s*\\}\\}`,
    'gi');

export type DeferredEnvReader =
    (name: string, accessor?: string, mode?: string) => any|Promise<any>;

async function readEnv(
    reader: DeferredEnvReader, name: string, accessor: string): Promise<any> {
  return await Promise.resolve(reader(name, accessor || undefined, 'lookup'));
}

async function resolveString(
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

  if (!value.includes('e:') && !value.includes('{{') && !value.includes('<<')) {
    return value;
  }

  const matches = [...value.matchAll(EMBEDDED)];
  if (matches.length === 0) {
    return value;
  }

  let out = value;
  // Replace from the end so earlier offsets stay valid.
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const name = match[1] || match[3];
    const accessor = match[2] || match[4] || '';
    if (!name || match.index === undefined) {
      continue;
    }
    const resolved = await readEnv(reader, name, accessor);
    const text = resolved === undefined || resolved === null ?
        match[0] :
        (typeof resolved === 'string' ? resolved : String(resolved));
    out = out.slice(0, match.index) + text + out.slice(match.index + match[0].length);
  }
  return out;
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
