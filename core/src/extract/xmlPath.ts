/**
 * XML helpers shared by output extraction and "path at cursor" support.
 *
 * Two responsibilities:
 * - {@link findXmlPathAtOffset}: map a cursor offset in raw XML text to a
 *   dotted output path (elements, repeated-element indices, attributes).
 * - {@link xmlBodyToExtractable}: normalize `xml-js` compact output into a
 *   shape those paths can navigate (arrays stay arrays, attributes become
 *   plain keys, text-only elements collapse to their text).
 */

export type XmlPathSegment = string|number;

interface XmlAttrSpan {
  name: string;
  nameStart: number;
  nameEnd: number;
  valueStart: number;
  valueEnd: number;
}

interface XmlNodeSpan {
  name: string;
  parent: XmlNodeSpan|null;
  children: XmlNodeSpan[];
  attrs: XmlAttrSpan[];
  /** Opening tag name range (inclusive). */
  nameStart: number;
  nameEnd: number;
  /** Closing tag name range (inclusive), when present. */
  closeNameStart: number;
  closeNameEnd: number;
  /** Inner content range (inclusive); empty when contentEnd < contentStart. */
  contentStart: number;
  contentEnd: number;
}

function isNameChar(ch: string): boolean {
  return /[A-Za-z0-9_:.\-]/.test(ch);
}

/** Index of the `>` closing a tag, skipping quoted attribute values. */
function findTagEnd(s: string, from: number): number {
  let quote = '';
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function parseAttrSpans(s: string, from: number, to: number): XmlAttrSpan[] {
  const attrs: XmlAttrSpan[] = [];
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(s[i])) {
      i++;
    }
    if (i >= to || !isNameChar(s[i])) {
      i++;
      continue;
    }
    const nameStart = i;
    while (i < to && isNameChar(s[i])) {
      i++;
    }
    const nameEnd = i - 1;
    const name = s.slice(nameStart, nameEnd + 1);
    let j = i;
    while (j < to && /\s/.test(s[j])) {
      j++;
    }
    if (s[j] !== '=') {
      // Valueless attribute; keep the name span so clicks still resolve.
      attrs.push({name, nameStart, nameEnd, valueStart: -1, valueEnd: -2});
      i = j;
      continue;
    }
    j++;
    while (j < to && /\s/.test(s[j])) {
      j++;
    }
    const quote = s[j];
    if (quote !== '"' && quote !== '\'') {
      attrs.push({name, nameStart, nameEnd, valueStart: -1, valueEnd: -2});
      i = j;
      continue;
    }
    const valueStart = j + 1;
    const close = s.indexOf(quote, valueStart);
    const valueEnd = close < 0 ? to - 1 : close - 1;
    attrs.push({name, nameStart, nameEnd, valueStart, valueEnd});
    i = close < 0 ? to : close + 1;
  }
  return attrs;
}

/**
 * Scan XML into a lightweight element tree with source offsets.
 * Prologs (`<?xml …?>`), doctypes, comments and CDATA are skipped so they
 * never become path segments.
 */
function parseXmlSpans(s: string): XmlNodeSpan {
  const root: XmlNodeSpan = {
    name: '',
    parent: null,
    children: [],
    attrs: [],
    nameStart: -1,
    nameEnd: -2,
    closeNameStart: -1,
    closeNameEnd: -2,
    contentStart: 0,
    contentEnd: s.length - 1,
  };
  let current = root;
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) {
      break;
    }
    if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt + 4);
      i = end < 0 ? s.length : end + 3;
      continue;
    }
    if (s.startsWith('<![CDATA[', lt)) {
      const end = s.indexOf(']]>', lt + 9);
      i = end < 0 ? s.length : end + 3;
      continue;
    }
    if (s.startsWith('<?', lt)) {
      const end = s.indexOf('?>', lt + 2);
      i = end < 0 ? s.length : end + 2;
      continue;
    }
    if (s.startsWith('<!', lt)) {
      const end = findTagEnd(s, lt + 2);
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    if (s[lt + 1] === '/') {
      let cn = lt + 2;
      while (cn < s.length && isNameChar(s[cn])) {
        cn++;
      }
      const name = s.slice(lt + 2, cn);
      const gt = findTagEnd(s, cn);
      let node: XmlNodeSpan|null = current;
      while (node && node !== root && node.name !== name) {
        node = node.parent;
      }
      if (node && node !== root) {
        node.closeNameStart = lt + 2;
        node.closeNameEnd = cn - 1;
        node.contentEnd = lt - 1;
        current = node.parent || root;
      }
      i = gt < 0 ? s.length : gt + 1;
      continue;
    }
    let j = lt + 1;
    const nameStart = j;
    while (j < s.length && isNameChar(s[j])) {
      j++;
    }
    if (j === nameStart) {
      i = lt + 1;
      continue;
    }
    const gt = findTagEnd(s, j);
    if (gt < 0) {
      break;
    }
    const selfClosing = s[gt - 1] === '/';
    const node: XmlNodeSpan = {
      name: s.slice(nameStart, j),
      parent: current,
      children: [],
      attrs: parseAttrSpans(s, j, selfClosing ? gt - 1 : gt),
      nameStart,
      nameEnd: j - 1,
      closeNameStart: -1,
      closeNameEnd: -2,
      contentStart: gt + 1,
      contentEnd: selfClosing ? gt : s.length - 1,
    };
    current.children.push(node);
    if (!selfClosing) {
      current = node;
    }
    i = gt + 1;
  }
  return root;
}

function inRange(offset: number, start: number, end: number): boolean {
  return start >= 0 && end >= start && offset >= start && offset <= end;
}

interface XmlHit {
  node: XmlNodeSpan;
  attr?: string;
}

function findHit(node: XmlNodeSpan, offset: number): XmlHit|null {
  for (const child of node.children) {
    if (inRange(offset, child.nameStart, child.nameEnd) ||
        inRange(offset, child.closeNameStart, child.closeNameEnd)) {
      return {node: child};
    }
    for (const attr of child.attrs) {
      if (inRange(offset, attr.nameStart, attr.nameEnd) ||
          inRange(offset, attr.valueStart, attr.valueEnd)) {
        return {node: child, attr: attr.name};
      }
    }
    if (inRange(offset, child.contentStart, child.contentEnd)) {
      return findHit(child, offset) ?? {node: child};
    }
  }
  return null;
}

function buildPath(hit: XmlHit): XmlPathSegment[] {
  const chain: XmlNodeSpan[] = [];
  let node: XmlNodeSpan|null = hit.node;
  while (node && node.parent) {
    chain.unshift(node);
    node = node.parent;
  }
  const path: XmlPathSegment[] = [];
  for (const element of chain) {
    path.push(element.name);
    const siblings =
        (element.parent?.children || []).filter(c => c.name === element.name);
    if (siblings.length > 1) {
      path.push(siblings.indexOf(element));
    }
  }
  if (hit.attr) {
    path.push(hit.attr);
  }
  return path;
}

/** Dotted path segments for the XML node/attribute at a raw text offset. */
export function findXmlPathAtOffset(s: string, offset: number): XmlPathSegment[]|
    null {
  const root = parseXmlSpans(s);
  const hit = findHit(root, offset);
  if (!hit) {
    return null;
  }
  const path = buildPath(hit);
  return path.length > 0 ? path : null;
}

const XML_META_KEYS = new Set([
  '_declaration',
  '_instruction',
  '_doctype',
  '_comment',
  '_parent',
]);

function xmlTextOf(node: Record<string, any>): string|undefined {
  const raw = node._text !== undefined ? node._text : node._cdata;
  if (raw === undefined) {
    return undefined;
  }
  return Array.isArray(raw) ? raw.map(part => String(part)).join('') :
                              String(raw);
}

/**
 * Normalize one `xml-js` compact node into an extraction-friendly value:
 * - repeated elements stay arrays (so `.0` / `.2` indices work)
 * - attributes become plain keys (plus `_attributes` for compatibility)
 * - text-only elements collapse to their text, empty elements to `''`
 */
function xmlNodeToValue(node: any): any {
  if (Array.isArray(node)) {
    return node.map(xmlNodeToValue);
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  const text = xmlTextOf(node);
  const attributes = node._attributes && typeof node._attributes === 'object' ?
      node._attributes as Record<string, any> :
      null;
  const childKeys = Object.keys(node).filter(
      key => key !== '_attributes' && key !== '_text' && key !== '_cdata' &&
          !XML_META_KEYS.has(key));
  if (!attributes && childKeys.length === 0) {
    return text ?? '';
  }
  const result: Record<string, any> = {};
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = value;
    }
    result._attributes = {...attributes};
  }
  for (const key of childKeys) {
    result[key] = xmlNodeToValue(node[key]);
  }
  if (text !== undefined) {
    result._text = text;
  }
  return result;
}

/** Normalize a parsed compact XML document for path-based extraction. */
export function xmlBodyToExtractable(compact: any): any {
  if (compact === null || typeof compact !== 'object') {
    return compact;
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(compact)) {
    if (XML_META_KEYS.has(key)) {
      continue;
    }
    result[key] = xmlNodeToValue(compact[key]);
  }
  return result;
}
