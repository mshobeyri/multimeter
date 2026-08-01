import YAML, {isMap, isPair, isScalar, isSeq, Pair, YAMLMap} from 'yaml';
import {emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators} from './expectOperatorYaml';
import {
  CHECK_ASSERT_VALUE_ORDER,
  getTestFlowStepType,
  STAGE_KEY_ORDER,
  STEP_KEY_ORDER,
} from './testParsePack';

/** Canonical root key order per Multimeter document type (matches *ToYaml packs). */
export const ROOT_KEY_ORDER: Record<string, string[]> = {
  api: [
    'type', 'title', 'description', 'tags', 'import', 'inputs', 'outputs', 'setenv',
    'url', 'query', 'protocol', 'method', 'timeout', 'format', 'auth', 'headers',
    'cookies', 'body', 'graphql', 'grpc', 'examples',
  ],
  test: [
    'type', 'title', 'description', 'tags', 'import', 'inputs', 'outputs', 'cache',
    'steps', 'stages', 'flow',
  ],
  env: [
    'type', 'import', 'variables', 'presets', 'setting', 'certificates',
  ],
  suite: [
    'type', 'title', 'description', 'tags', 'import', 'environment', 'servers',
    'export', 'items', 'tests',
  ],
  doc: [
    'type', 'title', 'description', 'import', 'logo', 'sources', 'services', 'html',
    'env',
  ],
  server: [
    'type', 'title', 'description', 'tags', 'import', 'protocol', 'port',
    'connection', 'cors', 'delay', 'headers', 'proxy', 'endpoints', 'fallback',
  ],
  loadtest: [
    'type', 'title', 'description', 'tags', 'import', 'environment', 'threads',
    'repeat', 'rampup', 'export', 'test',
  ],
};

const GRAPHQL_KEY_ORDER = ['operation', 'variables', 'operationName'];
const GRPC_KEY_ORDER = ['proto', 'service', 'method', 'stream', 'message'];
const ENVIRONMENT_KEY_ORDER = ['file', 'preset', 'variables'];
const CONNECTION_KEY_ORDER = ['mode', 'cert', 'key', 'client_ca', 'request_cert'];
const ENDPOINT_KEY_ORDER = [
  'method', 'path', 'name', 'match', 'status', 'format', 'headers', 'body', 'delay',
  'reflect', 'messages',
];
const FALLBACK_KEY_ORDER = ['status', 'format', 'headers', 'body'];
const CERTIFICATES_KEY_ORDER = ['server_ca', 'clients'];
const CLIENT_CERT_KEY_ORDER = [
  'name', 'host', 'cert', 'key', 'pfx', 'passphrase_plain', 'passphrase_env',
];
const SETTING_KEY_ORDER = ['http'];
const SETTING_HTTP_KEY_ORDER = ['version', 'timeout'];
const HTML_KEY_ORDER = ['triable', 'cors_proxy'];
const SERVICE_KEY_ORDER = ['name', 'description', 'sources'];
const EXAMPLE_KEY_ORDER = ['name', 'description', 'inputs', 'outputs'];

type VisitKind =
  'root'|'step'|'steps'|'stage'|'stages'|'endpoint'|'endpoints'|'client'|
  'clients'|'generic';

function pairKey(pair: Pair): string|undefined {
  if (isScalar(pair.key)) {
    return String(pair.key.value);
  }
  return undefined;
}

/**
 * Reorder YAML map pairs by canonical key order. Unknown keys keep relative order
 * after the known ones. Comments stay attached to the pair nodes.
 */
export function reorderMapPairs(map: YAMLMap, order: string[]): void {
  if (!Array.isArray(map.items) || map.items.length < 2 || order.length === 0) {
    return;
  }
  const ordered: Pair[] = [];
  const used = new Set<Pair>();
  for (const key of order) {
    const pair = map.items.find(item => isPair(item) && pairKey(item) === key);
    if (pair && isPair(pair) && !used.has(pair)) {
      ordered.push(pair);
      used.add(pair);
    }
  }
  for (const item of map.items) {
    if (isPair(item) && !used.has(item)) {
      ordered.push(item);
    }
  }
  if (ordered.length === map.items.length) {
    map.items = ordered;
  }
}

function visit(node: unknown, kind: VisitKind, rootOrder?: string[]): void {
  if (isMap(node)) {
    if (kind === 'root' && rootOrder) {
      reorderMapPairs(node, rootOrder);
    } else if (kind === 'step') {
      const stepType = getTestFlowStepType(node.toJSON() as any);
      const order = STEP_KEY_ORDER[stepType];
      if (order) {
        reorderMapPairs(node, order);
      }
    } else if (kind === 'stage') {
      reorderMapPairs(node, STAGE_KEY_ORDER);
    } else if (kind === 'endpoint') {
      reorderMapPairs(node, ENDPOINT_KEY_ORDER);
    } else if (kind === 'client') {
      reorderMapPairs(node, CLIENT_CERT_KEY_ORDER);
    }

    for (const item of node.items) {
      if (!isPair(item)) {
        continue;
      }
      const key = pairKey(item);
      if (!key) {
        continue;
      }
      const value = item.value;
      if (key === 'steps' || key === 'flow' || key === 'else') {
        visit(value, 'steps');
      } else if (key === 'stages') {
        visit(value, 'stages');
      } else if (key === 'endpoints') {
        visit(value, 'endpoints');
      } else if (key === 'clients') {
        visit(value, 'clients');
      } else if ((key === 'check' || key === 'assert') && isMap(value)) {
        reorderMapPairs(value, CHECK_ASSERT_VALUE_ORDER);
        visit(value, 'generic');
      } else if (key === 'graphql' && isMap(value)) {
        reorderMapPairs(value, GRAPHQL_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'grpc' && isMap(value)) {
        reorderMapPairs(value, GRPC_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'environment' && isMap(value)) {
        reorderMapPairs(value, ENVIRONMENT_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'connection' && isMap(value)) {
        reorderMapPairs(value, CONNECTION_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'fallback' && isMap(value)) {
        reorderMapPairs(value, FALLBACK_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'certificates' && isMap(value)) {
        reorderMapPairs(value, CERTIFICATES_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'setting' && isMap(value)) {
        reorderMapPairs(value, SETTING_KEY_ORDER);
        for (const settingPair of value.items) {
          if (isPair(settingPair) && pairKey(settingPair) === 'http' &&
              isMap(settingPair.value)) {
            reorderMapPairs(settingPair.value, SETTING_HTTP_KEY_ORDER);
          }
        }
        visit(value, 'generic');
      } else if (key === 'html' && isMap(value)) {
        reorderMapPairs(value, HTML_KEY_ORDER);
        visit(value, 'generic');
      } else if (key === 'services' && isSeq(value)) {
        for (const service of value.items) {
          if (isMap(service)) {
            reorderMapPairs(service, SERVICE_KEY_ORDER);
            visit(service, 'generic');
          }
        }
      } else if (key === 'examples' && isSeq(value)) {
        for (const example of value.items) {
          if (isMap(example)) {
            reorderMapPairs(example, EXAMPLE_KEY_ORDER);
            visit(example, 'generic');
          }
        }
      } else {
        visit(value, 'generic');
      }
    }
    return;
  }

  if (isSeq(node)) {
    for (const item of node.items) {
      if (kind === 'steps') {
        visit(item, 'step');
      } else if (kind === 'stages') {
        visit(item, 'stage');
      } else if (kind === 'endpoints') {
        visit(item, 'endpoint');
      } else if (kind === 'clients') {
        visit(item, 'client');
      } else {
        visit(item, 'generic');
      }
    }
  }
}

/**
 * Format Multimeter YAML via the document AST so `#` comments are preserved.
 * Reorders known keys to match the typed packers; does not drop empty fields
 * or rewrite structure (unlike yamlToX → xToYaml).
 */
export function formatMmtYamlAst(content: string, docType: string): string {
  const prepared = quoteExpectOperators(content || '');
  const doc = YAML.parseDocument(prepared);
  if (doc.errors?.length) {
    doc.errors = filterOperatorYamlErrors(content, doc.errors);
  }
  if (doc.errors?.length) {
    const first = doc.errors[0];
    throw new Error(first?.message || 'Invalid YAML');
  }

  const rootOrder = ROOT_KEY_ORDER[docType];
  if (doc.contents) {
    visit(doc.contents, 'root', rootOrder);
  }

  const formatted = doc.toString({
    aliasDuplicateObjects: false,
    blockQuote: 'literal',
    lineWidth: 0,
  } as any);
  return emitUnquotedOperators(formatted);
}
