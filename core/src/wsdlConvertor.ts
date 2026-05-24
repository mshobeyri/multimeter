import {APIData} from './APIData';

interface WsdlOperationInfo {
  name: string;
  soapAction?: string;
  inputElement?: string;
}

const XSD_TYPE_DEFAULTS: Record<string, string | number | boolean> = {
  string: 'string',
  normalizedString: 'string',
  token: 'string',
  int: 0,
  integer: 0,
  long: 0,
  short: 0,
  decimal: 0,
  float: 0,
  double: 0,
  boolean: false,
  date: '2026-01-01',
  dateTime: '2026-01-01T00:00:00Z',
};

export function wsdlToAPI(wsdl: string): APIData[] {
  const source = String(wsdl || '');
  const targetNamespace = attr(source, 'targetNamespace') || 'urn:service';
  const endpoint = firstMatch(source, /<\s*(?:\w+:)?address\b[^>]*\blocation=["']([^"']+)["'][^>]*>/i) || '<<e:soap_url>>';
  const soap12 = /<\s*(?:\w+:)?binding\b[^>]*transport=["'][^"']*soap\/http[^"']*["'][^>]*>/i.test(source) &&
    /schemas\.xmlsoap\.org\/wsdl\/soap12|www\.w3\.org\/2003\/05\/soap-envelope/i.test(source);
  const operations = collectOperations(source);
  const seen = new Set<string>();

  return operations
      .filter(operation => {
        if (seen.has(operation.name)) {
          return false;
        }
        seen.add(operation.name);
        return true;
      })
      .map(operation => operationToApi(operation, source, targetNamespace, endpoint, soap12));
}

function collectOperations(source: string): WsdlOperationInfo[] {
  const operations: WsdlOperationInfo[] = [];
  const bindingOperationPattern = /<\s*(?:\w+:)?operation\b[^>]*\bname=["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/\s*(?:\w+:)?operation\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = bindingOperationPattern.exec(source)) !== null) {
    const name = match[1];
    if (!name) {
      continue;
    }
    operations.push({
      name,
      soapAction: firstMatch(match[2] || '', /<\s*(?:\w+:)?operation\b[^>]*\bsoapAction=["']([^"']*)["'][^>]*>/i),
      inputElement: findInputElementName(source, name),
    });
  }

  if (operations.length > 0) {
    return operations;
  }

  const portTypePattern = /<\s*(?:\w+:)?operation\b[^>]*\bname=["']([^"']+)["'][^>]*>/gi;
  while ((match = portTypePattern.exec(source)) !== null) {
    if (match[1]) {
      operations.push({name: match[1], inputElement: findInputElementName(source, match[1])});
    }
  }
  return operations;
}

function operationToApi(
    operation: WsdlOperationInfo, source: string, targetNamespace: string, endpoint: string, soap12: boolean): APIData {
  const rootElement = operation.inputElement || operation.name;
  const soapAction = operation.soapAction ?? findSoapAction(source, operation.name);
  const fields = collectElementFields(source, rootElement);
  const inputs: Record<string, any> = {};
  for (const field of fields) {
    inputs[field.name] = field.defaultValue;
  }

  const envelopeNamespace = soap12 ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/';
  const bodyFields = fields.length > 0 ? fields.map(field => `        <tns:${field.name}><<i:${field.name}>></tns:${field.name}>`).join('\n') : '';
  const body = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<soapenv:Envelope xmlns:soapenv="${envelopeNamespace}" xmlns:tns="${targetNamespace}">`,
    '  <soapenv:Header/>',
    '  <soapenv:Body>',
    `    <tns:${rootElement}>`,
    bodyFields,
    `    </tns:${rootElement}>`,
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].filter(line => line !== '').join('\n');

  const headers: Record<string, string> = soap12 ?
    {'Content-Type': soapAction ? `application/soap+xml; charset=utf-8; action="${soapAction}"` : 'application/soap+xml; charset=utf-8'} :
    {'Content-Type': 'text/xml; charset=utf-8'};
  if (!soap12 && soapAction !== undefined) {
    headers.SOAPAction = soapAction;
  }

  const api: APIData = {
    type: 'api',
    title: operation.name,
    protocol: 'http',
    format: 'xml',
    url: endpoint,
    method: 'post',
    headers,
    body,
  };
  if (Object.keys(inputs).length > 0) {
    api.inputs = inputs;
  }
  return api;
}

function findSoapAction(source: string, operationName: string): string | undefined {
  const operationBlocks = source.matchAll(new RegExp(`<\\s*(?:\\w+:)?operation\\b[^>]*\\bname=["']${escapeRegExp(operationName)}["'][^>]*>([\\s\\S]*?)<\\s*\/\\s*(?:\\w+:)?operation\\s*>`, 'gi'));
  for (const match of operationBlocks) {
    const soapAction = firstMatch(match[1] || '', /<\s*(?:\w+:)?operation\b[^>]*\bsoapAction=["']([^"']*)["'][^>]*>/i);
    if (soapAction !== undefined) {
      return soapAction;
    }
  }
  return undefined;
}

function findInputElementName(source: string, operationName: string): string | undefined {
  const operationBlock = firstMatch(source, new RegExp(`<\\s*(?:\\w+:)?operation\\b[^>]*\\bname=["']${escapeRegExp(operationName)}["'][^>]*>([\\s\\S]*?)<\\s*\/\\s*(?:\\w+:)?operation\\s*>`, 'i'));
  const inputMessage = operationBlock ? firstMatch(operationBlock, /<\s*(?:\w+:)?input\b[^>]*\bmessage=["'](?:\w+:)?([^"']+)["'][^>]*>/i) : undefined;
  if (!inputMessage) {
    return operationName;
  }
  const messageBlock = firstMatch(source, new RegExp(`<\\s*(?:\\w+:)?message\\b[^>]*\\bname=["']${escapeRegExp(inputMessage)}["'][^>]*>([\\s\\S]*?)<\\s*\/\\s*(?:\\w+:)?message\\s*>`, 'i'));
  return messageBlock ? firstMatch(messageBlock, /<\s*(?:\w+:)?part\b[^>]*\belement=["'](?:\w+:)?([^"']+)["'][^>]*>/i) || operationName : operationName;
}

function collectElementFields(source: string, elementName: string): Array<{name: string; defaultValue: string | number | boolean}> {
  const elementBlock = firstMatch(source, new RegExp(`<\\s*(?:\\w+:)?element\\b[^>]*\\bname=["']${escapeRegExp(elementName)}["'][^>]*>([\\s\\S]*?)<\\s*\/\\s*(?:\\w+:)?element\\s*>`, 'i'));
  if (!elementBlock) {
    return [];
  }
  const fields: Array<{name: string; defaultValue: string | number | boolean}> = [];
  const childPattern = /<\s*(?:\w+:)?element\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = childPattern.exec(elementBlock)) !== null) {
    const rawAttrs = match[1] || '';
    const name = attr(rawAttrs, 'name');
    if (!name) {
      continue;
    }
    const typeName = (attr(rawAttrs, 'type') || 'string').replace(/^\w+:/, '');
    fields.push({name, defaultValue: XSD_TYPE_DEFAULTS[typeName] ?? 'string'});
  }
  return fields;
}

function attr(source: string, name: string): string | undefined {
  return firstMatch(source, new RegExp(`\\b${escapeRegExp(name)}=["']([^"']*)["']`, 'i'));
}

function firstMatch(source: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(source);
  return match && match[1] !== undefined ? match[1] : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
