import {xml2js} from 'xml-js';

import {JSONRecord} from './CommonData';
import {flattenXmlObj} from './markupConvertor';

export interface ResponseData {
  type: 'xml'|'json'|'text'|'auto';
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
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

  // If not bracket notation, return empty (dot notation not supported)
  return '';
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
    response.type = response.headers['Content-Type'] ||
            response.headers['content-type']?.includes('xml') ||
            (response.body && response.body.startsWith &&
             response.body.startsWith('<')) ?
        'xml' :
        'json';
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
      // Check if it contains regex pattern indicators (parentheses for capture
      // groups)
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
      // Not bracket notation or regex: return empty
      else {
        extractedValue = '';
      }

    } catch (error) {
      console.warn(
          `Failed to extract output "${key}" with expression "${expr}":`,
          error);
      extractedValue = '';
    }

    // Convert result to string
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      result[key] = JSON.stringify(extractedValue);
    } else if (extractedValue !== null && extractedValue !== undefined) {
      result[key] = String(extractedValue);
    } else {
      result[key] = '';
    }
  }

  return result;
}