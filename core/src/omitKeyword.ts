import * as YAML from 'yaml';

export const OMIT_KEYWORD = 'omit';
export const OMIT_SENTINEL = '__MMT_OMIT_KEYWORD__';

export function isOmitSentinel(value: unknown): boolean {
  return value === OMIT_SENTINEL;
}

function walkYamlNode(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'PLAIN' && node.value === OMIT_KEYWORD) {
    node.value = OMIT_SENTINEL;
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        walkYamlNode(item.key);
        walkYamlNode(item.value);
      } else {
        walkYamlNode(item);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    walkYamlNode(node.key);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    walkYamlNode(node.value);
  }
}

export function parseYamlWithOmitKeyword(
    yamlString: string,
    strict: boolean,
): any {
  const doc = YAML.parseDocument(yamlString);
  if (strict && doc.errors.length > 0) {
    throw doc.errors[0];
  }
  walkYamlNode(doc.contents);
  return doc.toJS();
}

export function normalizeOmitToNull(value: any): any {
  if (isOmitSentinel(value)) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(v => normalizeOmitToNull(v));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, normalizeOmitToNull(v)]));
  }
  return value;
}

export function restoreOmitKeyword(value: any): any {
  if (isOmitSentinel(value)) {
    return OMIT_KEYWORD;
  }
  if (Array.isArray(value)) {
    return value.map(v => restoreOmitKeyword(v));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, restoreOmitKeyword(v)]));
  }
  return value;
}

export function stripOmitFromRequest(value: any): any {
  if (isOmitSentinel(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(v => {
      const next = stripOmitFromRequest(v);
      return next === undefined ? null : next;
    });
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = stripOmitFromRequest(v);
      if (next !== undefined) {
        out[k] = next;
      }
    }
    return out;
  }
  return value;
}
