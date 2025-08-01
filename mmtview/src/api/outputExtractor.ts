import { xml2js } from "xml-js";
import { flattenXmlObj } from "../markupConvertor";

export interface ResponseData {
  type: 'xml'|'json'|'text';
  body: any;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

function resolvePath(response: ResponseData, expr: string): any {
  const parts = expr.split('.');
  let val: any = response;
  for (let part of parts) {
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      val = val[arrayMatch[1]];
      if (Array.isArray(val)) {
        val = val[parseInt(arrayMatch[2], 10)];
      } else {
        return '';
      }
    } else if (part.match(/^\w+\['(.+)'\]$/)) {
      const keyMatch = part.match(/^\w+\['(.+)'\]$/);
      if (keyMatch) {
        val = val[keyMatch[1]];
      } else {
        return '';
      }
    } else {
      val = val[part];
    }
    if (val === undefined || val === null) {
      return '';
    }
  }
  return val ?? '';
}

export function extractOutputs(
  response: ResponseData,
  outputsDef: Record<string, string>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  // Keep original body as text for regex operations
  const bodyText = typeof response.body === 'string' 
    ? response.body 
    : JSON.stringify(response.body);

  // Convert XML body to JS object if needed for property path resolution
  let bodyObject = response.body;
  if (response.type === "xml" && typeof response.body === "string") {
    try {
      const jsObj = xml2js(response.body, { compact: true });
      bodyObject = flattenXmlObj(jsObj);
    } catch (e) {
      bodyObject = {};
    }
  }
  
  // Create response objects for different operations
  const textResponse = { ...response, body: bodyText };
  const objectResponse = { ...response, body: bodyObject };

  for (const [key, expr] of Object.entries(outputsDef)) {
    if (typeof expr !== 'string') {
      result[key] = '';
      continue;
    }
    
    if (expr.startsWith('regex ')) {
      // Use text body for regex operations
      const pattern = expr.slice(6);
      let value = '';
      try {
        const regex = new RegExp(pattern);
        const found = bodyText.match(regex);
        value = found && found[1] ? found[1] : '';
      } catch (e) {
        value = '';
      }
      result[key] = value;
    } else if (/^\w+\./.test(expr)) {
      // Use object body for property path resolution
      result[key] = resolvePath(objectResponse, expr);
    } else {
      result[key] = '';
    }
  }

  return result;
}