import {JSONRecord} from '../data/CommonData';
import {packYaml, parseYaml} from '../parse/markupConvertor';
import {replaceAllRefs} from './variableReplacer';

export type ResolveYamlTextOptions = {
  yamlText: string;
  /** UI / example inputs overlay (merged over file `inputs:` defaults). */
  inputs?: JSONRecord;
  /** Current workspace env map (selected / active environment). */
  env?: JSONRecord;
  /**
   * When false (default), leave `r:` / `c:` tokens unresolved so the copy is
   * deterministic. `i:` and `e:` always resolve.
   */
  resolveRuntimeTokens?: boolean;
  /**
   * When true (default), keep only fields that affect the outgoing request
   * (drops title/description/inputs/outputs/examples/tags/import/setenv/…).
   */
  requestOnly?: boolean;
};

/** Root keys that shape the HTTP/WS/GraphQL/gRPC call itself (api files). */
const API_REQUEST_ONLY_KEYS = new Set([
  'type',
  'url',
  'query',
  'protocol',
  'method',
  'format',
  'timeout',
  'headers',
  'cookies',
  'body',
  'auth',
  'graphql',
  'grpc',
]);

/** Meta keys dropped from non-api "pure" copies. */
const META_KEYS = new Set([
  'title',
  'description',
  'inputs',
  'outputs',
  'examples',
  'tags',
]);

function isPlainRecord(value: unknown): value is JSONRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickRequestOnly(resolved: JSONRecord): JSONRecord {
  const out: JSONRecord = {};
  const isApi = resolved.type === 'api';
  for (const key of Object.keys(resolved)) {
    if (resolved[key] === undefined) {
      continue;
    }
    if (isApi) {
      if (API_REQUEST_ONLY_KEYS.has(key)) {
        out[key] = resolved[key];
      }
      continue;
    }
    if (!META_KEYS.has(key)) {
      out[key] = resolved[key];
    }
  }
  return out;
}

/**
 * Return YAML text with `i:` and `e:` tokens substituted from the given inputs
 * and env map. Comments and key order are preserved via AST merge (`packYaml`).
 *
 * By default the copy is request-only (no title/description/inputs/outputs/
 * examples). Unresolved tokens (missing env/input, deferred env values, or
 * runtime tokens when `resolveRuntimeTokens` is false) are left as authored.
 */
export function resolveYamlText(options: ResolveYamlTextOptions): string {
  const yamlText = typeof options.yamlText === 'string' ? options.yamlText : '';
  const inputs = isPlainRecord(options.inputs) ? options.inputs : {};
  const env = isPlainRecord(options.env) ? options.env : {};
  const resolveRuntimeTokens = options.resolveRuntimeTokens === true;
  const requestOnly = options.requestOnly !== false;

  const parsed = parseYaml(yamlText);
  if (parsed === null || parsed === undefined) {
    throw new Error('Document is not a valid YAML.');
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Document is not a valid YAML object.');
  }

  const defaults = isPlainRecord(parsed.inputs) ? parsed.inputs : {};

  let resolved = replaceAllRefs(
      parsed,
      defaults,
      inputs,
      env,
      new Set(),
      {resolveRuntimeTokens},
  );

  if (requestOnly) {
    resolved = pickRequestOnly(resolved);
  }

  const packed = packYaml(resolved, yamlText);
  if (!packed) {
    throw new Error('Unable to serialize resolved YAML.');
  }
  return packed;
}
