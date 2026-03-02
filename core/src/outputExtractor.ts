import {xml2js} from 'xml-js';

import {JSONRecord} from './CommonData';
import {flattenXmlObj} from './markupConvertor';

export interface ResponseData {
  type: 'xml'|'json'|'text'|'auto';
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

export type PathSegment = string|number;

function toOffset(content: string, line: number, column: number): number {
  const lines = content.split(/\n/);
  const l = Math.max(1, Math.min(line, lines.length));
  const c = Math.max(1, column);
  let offset = 0;
  for (let i = 0; i < l - 1; i++) {
    // +1 for the \n separator
    offset += lines[i].length + 1;
  }
  offset += (c - 1);
  return offset;
}

// --- JSON path at position ---
function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) {
    i++;
  }
  return i;
}

function parseJSONString(s: string, i: number): {end: number; value: string} {
  // s[i] === '"'
  let j = i + 1;
  let val = '';
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') {
      const next = s[j + 1];
      // naive escape handling
      val += ch + next;
      j += 2;
      continue;
    }
    if (ch === '"') {
      return {end: j, value: JSON.parse(s.slice(i, j + 1))};
    }
    j++;
  }
  return {end: j, value: ''};
}

function parseJSONNumber(s: string, i: number): {end: number} {
  let j = i;
  while (j < s.length && /[0-9eE+\-.]/.test(s[j])) {
    j++;
  }
  return {end: j - 1};
}

function matchLiteral(s: string, i: number, lit: string): boolean {
  return s.slice(i, i + lit.length) === lit;
}

function findJSONPathAtOffset(s: string, offset: number): PathSegment[]|null {
  // Recursive descent with location tracking
  function parseValue(i: number, path: PathSegment[]):
      {end: number; found: PathSegment[] | null} {
    i = skipWs(s, i);
    const ch = s[i];
    if (ch === '"') {
      const {end} = parseJSONString(s, i);
      // If offset lies within this primitive value range, return current path
      if (offset >= i && offset <= end) {
        return {end, found: path};
      }
      return {end, found: null};
    }
    if (ch === '{') {
      let j = i + 1;
      j = skipWs(s, j);
      if (s[j] === '}') {
        // empty object
        if (offset >= i && offset <= j) {
          return {end: j, found: path};
        }
        return {end: j, found: null};
      }
      while (j < s.length) {
        j = skipWs(s, j);
        if (s[j] !== '"') {
          break;
        }  // invalid
        const keyStart = j;
        const {end: keyEnd, value: keyVal} = parseJSONString(s, j);
        j = skipWs(s, keyEnd + 1);
        if (s[j] !== ':') {
          break;
        }
        j = skipWs(s, j + 1);
        const valStart = j;
        const res = parseValue(j, path.concat(keyVal));
        j = res.end + 1;
        if (offset >= keyStart && offset <= res.end) {
          return {end: j - 1, found: res.found ?? path.concat(keyVal)};
        }
        j = skipWs(s, j);
        if (s[j] === ',') {
          j++;
          continue;
        }
        if (s[j] === '}') {
          const endObj = j;
          if (offset >= i && offset <= endObj) {
            return {end: endObj, found: res.found};
          }
          return {end: endObj, found: res.found};
        }
      }
      return {end: j, found: null};
    }
    if (ch === '[') {
      let j = i + 1;
      j = skipWs(s, j);
      if (s[j] === ']') {
        if (offset >= i && offset <= j) {
          return {end: j, found: path};
        }
        return {end: j, found: null};
      }
      let idx = 0;
      while (j < s.length) {
        j = skipWs(s, j);
        const valStart = j;
        const res = parseValue(j, path.concat(idx));
        j = res.end + 1;
        if (offset >= valStart && offset <= res.end) {
          return {end: j - 1, found: res.found ?? path.concat(idx)};
        }
        j = skipWs(s, j);
        if (s[j] === ',') {
          idx++;
          j++;
          continue;
        }
        if (s[j] === ']') {
          const endArr = j;
          if (offset >= i && offset <= endArr) {
            return {end: endArr, found: res.found};
          }
          return {end: endArr, found: res.found};
        }
      }
      return {end: j, found: null};
    }
    // number, true, false, null
    if (/[0-9-]/.test(ch)) {
      const {end} = parseJSONNumber(s, i);
      if (offset >= i && offset <= end) {
        return {end, found: path};
      }
      return {end, found: null};
    }
    if (matchLiteral(s, i, 'true')) {
      const end = i + 3;
      if (offset >= i && offset <= end) {
        return {end, found: path};
      }
      return {end, found: null};
    }
    if (matchLiteral(s, i, 'false')) {
      const end = i + 4;
      if (offset >= i && offset <= end) {
        return {end, found: path};
      }
      return {end, found: null};
    }
    if (matchLiteral(s, i, 'null')) {
      const end = i + 3;
      if (offset >= i && offset <= end) {
        return {end, found: path};
      }
      return {end, found: null};
    }
    return {end: i, found: null};
  }

  const res = parseValue(skipWs(s, 0), []);
  return res.found ?? null;
}

// --- XML path at position ---
function findXMLPathAtOffset(s: string, offset: number): PathSegment[]|null {
  const stack: {name: string; index: number}[] = [];
  const counts: Map<string, number>[] = [new Map()];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) {
        // skip comment
        const endC = s.indexOf('-->', i + 4);
        i = endC >= 0 ? endC + 3 : s.length;
        continue;
      }
      if (s[i + 1] === '/') {
        // closing tag – check if offset is on the closing tag name
        const closeNameStart = i + 2;
        let cn = closeNameStart;
        while (cn < s.length && /[A-Za-z0-9_:.-]/.test(s[cn])) {
          cn++;
        }
        const closeNameEnd = cn - 1;
        if (offset >= closeNameStart && offset <= closeNameEnd && stack.length > 0) {
          const path: PathSegment[] = [];
          for (const seg of stack) {
            path.push(seg.name);
            if (seg.index > 0) {
              path.push(seg.index);
            }
          }
          return path;
        }
        const end = s.indexOf('>', i + 2);
        if (end < 0) break;
        stack.pop();
        counts.pop();
        i = end + 1;
        continue;
      }
      // open or self-closing
      let j = i + 1;
      // read name
      let name = '';
      const nameStart = j;
      while (j < s.length && /[A-Za-z0-9_:.-]/.test(s[j])) {
        name += s[j++];
      }
      const nameEnd = j - 1;
      // advance to end of tag
      const endTag = s.indexOf('>', j);
      if (endTag < 0) break;
      const selfClosing = s[endTag - 1] === '/';
      // push stack
      const top = counts[counts.length - 1];
      const cur = (top.get(name) ?? 0);
      top.set(name, cur + 1);
      stack.push({name, index: cur});
      counts.push(new Map());

      // If offset is on the opening tag name, return the path to this element
      if (offset >= nameStart && offset <= nameEnd) {
        const path: PathSegment[] = [];
        for (const seg of stack) {
          path.push(seg.name);
          if (seg.index > 0) {
            path.push(seg.index);
          }
        }
        return path;
      }

      const textStart = endTag + 1;
      i = endTag + 1;
      if (selfClosing) {
        // no text, immediately close
        stack.pop();
        counts.pop();
        continue;
      }
      // find next '<'
      const nextLt = s.indexOf('<', i);
      const textEnd = nextLt >= 0 ? nextLt - 1 : s.length - 1;
      if (offset >= textStart && offset <= textEnd) {
        // Build path
        const path: PathSegment[] = [];
        for (const seg of stack) {
          path.push(seg.name);
          // include index only for repeated elements (index > 0)
          if (seg.index > 0) {
            path.push(seg.index);
          }
        }
        return path;
      }
      // continue; next loop will handle children or closing
      continue;
    }
    i++;
  }
  return null;
}

export function extractPathAtPosition(
    content: string, contentType: 'json'|'xml', line: number,
    column: number): PathSegment[]|null {
  const offset = toOffset(content, line, column);
  if (contentType === 'json') {
    return findJSONPathAtOffset(content, offset);
  }
  if (contentType === 'xml') {
    return findXMLPathAtOffset(content, offset);
  }
  return null;
}

// Parse bracket notation like body[user][profile][name] or
// headers[Content-Type]
function parseBracketPath(path: string): {section: string; parts: string[]} {
  // Match the pattern: section[part1][part2][part3]...
  const match = path.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)((?:\[[^\]]+\])*)/);

  if (!match) {
    return {section: '', parts: []};
  }

  const section = match[1];
  const bracketsStr = match[2];

  // Extract all bracket contents
  const parts: string[] = [];
  const regex = /\[([^\]]+)\]/g;
  let bracketMatch;

  while ((bracketMatch = regex.exec(bracketsStr)) !== null) {
    parts.push(bracketMatch[1]);
  }

  return {section, parts};
}

// JSONPath resolver that handles $ syntax with bracket notation like
// $[body][user][id]
function resolveJSONPath(response: ResponseData, path: string): any {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // Handle root $
  if (path === '$') {
    return response.body;
  }

  // Remove leading $ and parse the path
  // Support both $[body]... and $body[...] syntaxes; normalize to section +
  // parts
  let normalizedPath = path.startsWith('$') ? path.slice(1) : path;
  const {section, parts} = parseBracketPath(normalizedPath);

  // For JSONPath, if no section specified, assume body
  let current = response.body;

  // If there's a section specified after $, use it
  if (section) {
    switch (section) {
      case 'body':
        current = response.body;
        break;
      case 'headers':
        current = response.headers;
        break;
      case 'cookies':
        current = response.cookies;
        break;
      default:
        // Unknown section, return empty
        return '';
    }
  }

  // Navigate through the parts
  for (let part of parts) {
    if (current === null || current === undefined) {
      return '';
    }

    // Check if it's a numeric index for arrays
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return '';
      }
    }
    // Property access
    else {
      current = current[part];
    }

    if (current === undefined || current === null) {
      return '';
    }
  }

  return current ?? '';
}

function resolvePath(response: ResponseData, expr: string): any {
  // Handle bracket notation starting with response parts
  if (expr.includes('[') && expr.includes(']')) {
    const {section, parts} = parseBracketPath(expr);

    if (!section) {
      return '';
    }

    // Get the initial value based on section
    let val: any;
    switch (section) {
      case 'body':
        val = response.body;
        break;
      case 'headers':
        val = response.headers;
        break;
      case 'cookies':
        val = response.cookies;
        break;
      default:
        return '';
    }

    // Process the bracket parts
    for (let part of parts) {
      if (val === undefined || val === null) {
        return '';
      }

      // Check if it's a numeric index
      if (/^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        if (Array.isArray(val)) {
          val = val[index];
        } else {
          return '';
        }
      }
      // Property access
      else {
        val = val[part];
      }
    }

    return val ?? '';
  }

  // If not bracket notation, try dot notation
  return '';
}

function resolveDotPath(response: ResponseData, expr: string): any {
  const parts = expr.split('.');
  if (parts.length < 2) {
    return '';
  }

  const section = parts[0];
  let val: any;
  switch (section) {
    case 'body':
      val = response.body;
      break;
    case 'headers':
      val = response.headers;
      break;
    case 'cookies':
      val = response.cookies;
      break;
    default:
      return '';
  }

  for (let i = 1; i < parts.length; i++) {
    if (val === undefined || val === null) {
      return '';
    }
    const part = parts[i];
    // Check if it's a numeric index for arrays
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (Array.isArray(val)) {
        val = val[index];
      } else {
        return '';
      }
    } else {
      val = val[part];
    }
  }

  return val ?? '';
}

export function buildBodyExprFromPath(path: PathSegment[]): string {
  if (!path || path.length === 0) {
    return '';
  }
  return 'body.' + path.map(seg => String(seg)).join('.');
}

export function extractOutputs(
    response: ResponseData, outputsDef: Record<string, string>): JSONRecord {
  const result: JSONRecord = {};

  // Keep original body as text for regex operations
  const bodyText = typeof response.body === 'string' ?
      response.body :
      JSON.stringify(response.body);

  // Parse body as object for path operations
  let bodyObject = response.body;

  if (response.type === 'auto') {
    // Normalize header names once
    const headersLower =
        Object.fromEntries(Object.entries(response.headers || {})
                               .map(([k, v]) => [k.toLowerCase(), v]));
    const ct = headersLower['content-type'];
    if (typeof ct === 'string') {
      response.type = ct.includes('xml') ? 'xml' : 'json';
    } else {
      response.type = (response.body && response.body.startsWith &&
                       response.body.startsWith('<')) ?
          'xml' :
          'json';
    }
  }

  if (response.type === 'xml' && typeof response.body === 'string') {
    try {
      const jsObj = xml2js(response.body, {compact: true});
      bodyObject = flattenXmlObj(jsObj);
    } catch (e) {
      console.warn('Failed to parse XML:', e);
      bodyObject = {};
    }
  } else if (response.type === 'json' && typeof response.body === 'string') {
    try {
      bodyObject = JSON.parse(response.body);
    } catch (e) {
      console.warn('Failed to parse JSON:', e);
      bodyObject = {};
    }
  }


  // Create response objects for different operations
  const objectResponse = {...response, body: bodyObject};

  for (const [key, expr] of Object.entries(outputsDef)) {
    if (typeof expr !== 'string') {
      result[key] = '';
      continue;
    }

    let extractedValue = '';

    try {
      // Check if it starts with "regex " prefix (maintain backward
      // compatibility)
      if (expr.startsWith('regex ')) {
        const pattern = expr.slice(6);
        const regex = new RegExp(pattern);
        const found = bodyText.match(regex);
        extractedValue = found && found[1] ? found[1] : '';
      }
      // Check if it contains regex pattern indicators (legacy fallback):
      else if (
          expr.includes('(') && expr.includes(')') && !expr.includes('[')) {
        const regex = new RegExp(expr);
        const found = bodyText.match(regex);
        extractedValue = found && found[1] ? found[1] : '';
      }
      // Check if it's a JSONPath (starts with $)
      else if (expr.startsWith('$')) {
        extractedValue = resolveJSONPath(objectResponse, expr);
      }
      // Check if it's bracket notation path
      else if (expr.includes('[') && expr.includes(']')) {
        extractedValue = resolvePath(objectResponse, expr);
      }
      // Check if it's dot notation path (e.g. body.user.id)
      else if (expr.includes('.')) {
        extractedValue = resolveDotPath(objectResponse, expr);
      }
      // No recognized pattern: return empty
      else {
        extractedValue = '';
      }

    } catch (error) {
      console.warn(
          `Failed to extract output "${key}" with expression "${expr}":`,
          error);
      extractedValue = '';
    }

    // Preserve type for bracket notation, JSONPath, and dot notation extractions
    if ((expr.startsWith('$') || (expr.includes('[') && expr.includes(']')) || expr.includes('.')) &&
        extractedValue !== null && extractedValue !== undefined) {
      // Preserve the native type (object, array, number, boolean, string)
      result[key] = extractedValue;
    } else if (extractedValue !== null && extractedValue !== undefined) {
      // Regex and legacy: always string
      result[key] = String(extractedValue);
    } else {
      result[key] = '';
    }
  }

  return result;
}