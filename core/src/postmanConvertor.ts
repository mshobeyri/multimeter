import { APIData, AuthConfig } from './APIData';
import {Format, packFormatSpec, requestFormat} from './CommonData';
import {OMIT_SENTINEL} from './omitKeyword';
import {RANDOM_TOKEN_MAP} from './Random';

// Map Postman dynamic random variables to Multimeter random token names
// Only include those we support in RANDOM_TOKEN_MAP.
const POSTMAN_RANDOM_MAP: Record<string, string> = {
  '$guid': 'uuid',
  'timestamp': 'epoch',
  '$timestamp': 'epoch',
  '$randomUUID': 'uuid',
  '$randomInt': 'int',
  '$randomFloat': 'float',
  '$randomBoolean': 'bool',
  '$randomAlphaNumeric': 'alphanumeric',
  '$randomColor': 'color',
  '$randomHexColor': 'hex_color',
  '$randomEmail': 'email',
  '$randomUserName': 'username',
  '$randomPassword': 'password',
  '$randomDomainName': 'domain',
  '$randomUrl': 'url',
  '$randomIP': 'ip',
  '$randomIPv6': 'ipv6',
  '$randomMACAddress': 'mac',
  '$randomUserAgent': 'user_agent',
  '$randomPhoneNumber': 'phone',
  '$randomFirstName': 'first_name',
  '$randomLastName': 'last_name',
  '$randomFullName': 'full_name',
  '$randomCompanyName': 'company',
  '$randomJobTitle': 'job_title',
  '$randomZipCode': 'postal_code',
  '$randomStreetAddress': 'street_address',
  '$randomCity': 'city',
  '$randomCountry': 'country',
  '$randomLatitude': 'latitude',
  '$randomLongitude': 'longitude',
  '$randomWeekday': 'weekday',
  '$randomMonth': 'month',
  '$randomDateFuture': 'date_future',
  '$randomDatePast': 'date_past',
  '$randomLoremWord': 'word',
  '$randomLoremSentence': 'sentence',
  '$randomLoremParagraph': 'paragraph',
  '$randomPrice': 'float',
  '$randomFileName': 'string',
};

const POSTMAN_RANDOM_TOKEN_NAMES = new Set(Object.values(POSTMAN_RANDOM_MAP));

/** Translate Postman `{{name}}` placeholders to MMT `r:` or `<<e:>>` tokens. */
export function translatePostmanTemplate(str: string): string {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner) => {
    const name = String(inner).trim();
    if (POSTMAN_RANDOM_MAP[name]) {
      return `r:${POSTMAN_RANDOM_MAP[name]}`;
    }
    return `<<e:${name}>>`;
  });
}

function replacePostmanVars(str: string): string {
  return translatePostmanTemplate(str);
}

function headerValue(
    headers: Record<string, any>|undefined, name: string): string|undefined {
  if (!headers) {
    return undefined;
  }
  const key = Object.keys(headers).find(
      (entry) => entry.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function formatFromMediaType(value: string|undefined): Format|undefined {
  if (!value) {
    return undefined;
  }
  const lc = value.toLowerCase();
  if (lc.includes('json')) {
    return 'json';
  }
  if (lc.includes('xml') && !lc.includes('html')) {
    return 'xml';
  }
  if (lc.includes('urlencoded')) {
    return 'urlencoded';
  }
  if (lc.includes('multipart')) {
    return 'multipart';
  }
  if (lc.includes('octet-stream') || lc.includes('protobuf') ||
      lc.includes('application/pdf') || lc.startsWith('image/') ||
      lc.startsWith('audio/') || lc.startsWith('video/')) {
    return 'binary';
  }
  if (lc.includes('text') || lc.includes('html') || lc.includes('javascript')) {
    return 'text';
  }
  return undefined;
}

function reviveUnquotedMmtTokens(value: any): any {
  if (typeof value === 'string') {
    const match = /^__MMT_UNQUOTED_(.+?)__$/.exec(value);
    if (match) {
      return `r:${match[1]}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(reviveUnquotedMmtTokens);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = reviveUnquotedMmtTokens(entry);
    }
    return out;
  }
  return value;
}

/** Parse Postman raw JSON bodies, including unquoted `{{$random*}}` placeholders. */
export function parsePostmanRawJsonBody(raw: string): string | object {
  const source = String(raw || '');
  if (!source.trim()) {
    return source;
  }
  const unquotedPattern =
      /:\s*(\{\{\s*\$([^}]+?)\s*\}\})(\s*[,}\]])/g;
  let prepared = source.replace(
      unquotedPattern,
      (_match, _token, inner, suffix) => {
        const key = `$${String(inner).trim()}`;
        const mapped = POSTMAN_RANDOM_MAP[key];
        if (mapped) {
          return `: "__MMT_UNQUOTED_${mapped}__"${suffix}`;
        }
        return `: ${translatePostmanTemplate(`{{${inner}}}`)}${suffix}`;
      });
  prepared = translatePostmanTemplate(prepared);
  try {
    return reviveUnquotedMmtTokens(JSON.parse(prepared));
  } catch {
    return translatePostmanTemplate(source);
  }
}

function convertPostmanRawBody(raw: string, headers: Record<string, string>): string | object {
  const contentType = Object.entries(headers || {}).find(
      ([key]) => key.toLowerCase() === 'content-type')?.[1] || '';
  if (contentType.includes('json') || looksLikeJsonBody(raw)) {
    return parsePostmanRawJsonBody(raw);
  }
  return translatePostmanTemplate(raw);
}

function looksLikeJsonBody(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export function listSupportedPostmanRandomTokens(): string[] {
  return Object.keys(POSTMAN_RANDOM_MAP).sort();
}

export function assertPostmanRandomMapIsSupported(): void {
  for (const tokenName of POSTMAN_RANDOM_TOKEN_NAMES) {
    if (!RANDOM_TOKEN_MAP[tokenName]) {
      throw new Error(`Postman random map points to unsupported token: ${tokenName}`);
    }
  }
}

function transformRecordValues(obj: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!obj) {
    return obj;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? replacePostmanVars(v) : String(v);
  }
  return out;
}

// Helper to extract key-value pairs from Postman format and convert to object
function extractKeyValue(arr: any[] | string | Record<string, any> = []): Record<string, string> {
  const obj: Record<string, string> = {};
  if (typeof arr === 'string') {
    for (const line of arr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
      const match = /^([^:\s][^:]*?)\s*:\s*(.*)$/.exec(line.trim());
      if (match && match[1]) {
        obj[match[1].trim()] = match[2] || '';
      }
    }
    return obj;
  }
  if (Array.isArray(arr)) {
    arr.forEach((item) => {
      if (item && !item.disabled && item.key && typeof item.value !== 'undefined') {
        obj[item.key] = String(item.value);
      }
    });
    return obj;
  }
  if (arr && typeof arr === 'object') {
    for (const [key, value] of Object.entries(arr)) {
      if (value !== undefined && value !== null && typeof value !== 'object') {
        obj[key] = String(value);
      }
    }
  }
  return obj;
}

function normalizePostmanRequest(request: any): any {
  if (typeof request === 'string') {
    return {method: 'GET', url: request};
  }
  return request || {};
}

function normalizeInputKey(value: string): string {
  return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/__+/g, '_') || 'value';
}

function postmanVariables(postmanJson: any): Record<string, any> {
  const variables: Record<string, any> = {};
  for (const variable of postmanJson?.variable || []) {
    if (variable?.key) {
      variables[String(variable.key)] = variable.value ?? '';
    }
  }
  return variables;
}

function urlVariableInputs(url: any): Record<string, any> {
  const inputs: Record<string, any> = {};
  for (const variable of url?.variable || []) {
    if (!variable?.disabled && variable?.key) {
      inputs[normalizeInputKey(variable.key)] =
          typeof variable.value === 'string'
          ? replacePostmanVars(variable.value)
          : String(variable.value ?? '');
    }
  }
  return inputs;
}

function replaceUrlPathVariables(value: string, url: any): string {
  let result = value;
  for (const variable of url?.variable || []) {
    if (variable?.disabled || !variable?.key) {
      continue;
    }
    const key = String(variable.key);
    const inputKey = normalizeInputKey(key);
    result = result.replace(
        new RegExp(`/:${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=/|\\?|#|$)`, 'g'),
        `/<<i:${inputKey}>>`);
  }
  return result;
}

function normalizePostmanUrl(
    url: any, collectionVariables: Record<string, any> = {}): string {
  if (typeof url === 'string') {
    return replacePostmanVars(url);
  }
  if (!url || typeof url !== 'object') {
    return '';
  }
  if (typeof url.raw === 'string' && url.raw.trim()) {
    const raw = Array.isArray(url.query) && url.query.length > 0
      ? url.raw.split(/[?#]/, 1)[0]
      : url.raw;
    return replacePostmanVars(replaceUrlPathVariables(raw, url));
  }
  const protocol = url.protocol || 'https';
  const host = Array.isArray(url.host) ? url.host.join('.') : String(url.host || '');
  const port = url.port ? `:${url.port}` : '';
  const rawPath = Array.isArray(url.path) ? url.path.join('/') : String(url.path || '').replace(/^\/+/, '');
  const normalizedPath = replaceUrlPathVariables(`/${rawPath}`, url).replace(/^\/+/, '');
  const hostVariable = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(host);
  const hostDefault = hostVariable ? collectionVariables[hostVariable[1].trim()] : undefined;
  const hostContainsFullUrl =
      typeof hostDefault === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(hostDefault.trim());
  const base = host
    ? (hostContainsFullUrl ? host.replace(/\/+$/, '') : `${protocol}://${host}${port}`)
    : '';
  const slash = base && normalizedPath ? '/' : '';
  return replacePostmanVars(`${base}${slash}${normalizedPath}`);
}

function materializeUrlInputs(
    url: string, inputs: Record<string, any>): string {
  let result = url;
  for (const [key, value] of Object.entries(inputs)) {
    result = result.replace(
        new RegExp(`<<i:${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>>`, 'g'),
        String(value ?? ''));
  }
  return result;
}

function normalizePostmanDescription(description: any): {description?: string; tags?: string[]} {
  if (!description) {
    return {};
  }
  if (typeof description === 'string') {
    return {description: blockFriendlyDescription(description)};
  }
  if (typeof description === 'object') {
    const tags: string[] = [];
    if (description.version) {
      tags.push(String(description.version));
    }
    return {
      description: typeof description.content === 'string' ? blockFriendlyDescription(description.content) : undefined,
      tags,
    };
  }
  return {description: blockFriendlyDescription(String(description))};
}

function blockFriendlyDescription(description: string): string {
  const normalized = String(description || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.includes('\n') || normalized.length <= 80) {
    return normalized;
  }
  const lines: string[] = [];
  let current = '';
  for (const word of normalized.split(/\s+/)) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > 80) {
      lines.push(current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.join('\n');
}

function responseToOutputs(response: any): {apiOutputs: Record<string, string>; exampleOutputs: Record<string, any>} {
  const apiOutputs: Record<string, string> = {};
  const exampleOutputs: Record<string, any> = {};
  if (typeof response?.code === 'number') {
    apiOutputs.status = 'status';
    apiOutputs.statusCode = 'status';
    exampleOutputs.status = response.code;
    exampleOutputs.statusCode = response.code;
  }
  if (typeof response?.body === 'string' && response.body.length > 0) {
    try {
      const parsed = JSON.parse(response.body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          apiOutputs[key] = `body.${key}`;
          exampleOutputs[key] = value;
        }
      } else {
        apiOutputs.body = 'body';
        exampleOutputs.body = parsed;
      }
    } catch {
      apiOutputs.body = 'body';
      exampleOutputs.body = response.body;
    }
  }
  return {apiOutputs, exampleOutputs};
}

function mergeOutputs(target: Record<string, string> | undefined, next: Record<string, string>): Record<string, string> | undefined {
  const merged = {...(target || {})};
  for (const [key, value] of Object.entries(next)) {
    merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

interface FlattenedPostmanItem {
  item: any;
  inheritedAuth?: any;
  inheritedEvents: any[];
}

function flattenItems(
    items: any[], inheritedAuth?: any,
    inheritedEvents: any[] = []): FlattenedPostmanItem[] {
  return items.flatMap((item) => {
    if (item && item.item) {
      return flattenItems(
          item.item,
          item.auth === undefined ? inheritedAuth : item.auth,
          [...inheritedEvents, ...(item.event || [])]);
    }
    return [{item, inheritedAuth, inheritedEvents}];
  });
}

function applyPreRequestHeaders(
    headers: Record<string, string>, events: any[]): void {
  for (const event of events) {
    if (event?.listen !== 'prerequest') {
      continue;
    }
    const exec = Array.isArray(event?.script?.exec)
      ? event.script.exec.join('\n')
      : String(event?.script?.exec || '');
    const matches = exec.matchAll(
        /pm\.request\.headers\.(?:upsert|add)\(\s*\{\s*key\s*:\s*(['"])(.*?)\1\s*,\s*value\s*:\s*pm\.(?:variables|environment|collectionVariables)\.get\(\s*(['"])(.*?)\3\s*\)\s*\}\s*\)/g);
    for (const match of matches) {
      headers[match[2]] = `<<e:${match[4]}>>`;
    }
  }
}

export function postmanToAPI(postmanJson: any): APIData[] {
  if (!postmanJson || !postmanJson.item) {
    return [];
  }

  const collectionVariables = postmanVariables(postmanJson);
  const requests = flattenItems(
      postmanJson.item, postmanJson.auth, postmanJson.event || [])
      .filter(({item}) => item && typeof item === 'object');

  return requests.map(({
    item: req,
    inheritedAuth,
    inheritedEvents,
  }: FlattenedPostmanItem) => {
    const request = normalizePostmanRequest(req.request);
    const url = normalizePostmanUrl(request.url, collectionVariables);
    const descriptionInfo = normalizePostmanDescription(req.description || request.description);

    // Convert Postman headers array to object
  const headers = transformRecordValues(extractKeyValue(request.header)) || {};
    applyPreRequestHeaders(
        headers, [...inheritedEvents, ...(req.event || [])]);

    // Convert Postman query array to object
  const query = transformRecordValues(extractKeyValue(request.url?.query));

    let body: string | object | undefined = undefined;
    let graphql: APIData['graphql'];
    if (request.body?.mode === 'raw') {
      body = typeof request.body.raw === 'string'
        ? convertPostmanRawBody(request.body.raw, headers)
        : request.body.raw;
    } else if (request.body?.mode === 'urlencoded') {
      body = transformRecordValues(extractKeyValue(request.body.urlencoded));
    } else if (request.body?.mode === 'formdata') {
      body = transformRecordValues(extractKeyValue(request.body.formdata));
    } else if (request.body?.mode === 'graphql') {
      const operation = request.body.graphql?.query;
      if (typeof operation === 'string' && operation.trim()) {
        let variables = request.body.graphql?.variables;
        if (typeof variables === 'string') {
          try {
            variables = JSON.parse(replacePostmanVars(variables));
          } catch {
            variables = undefined;
          }
        }
        graphql = {
          operation: replacePostmanVars(operation),
          ...(variables && typeof variables === 'object' ? {variables} : {}),
        };
      }
    } else if (
      request.body?.mode === 'file' &&
      typeof request.body.file?.src === 'string' &&
      request.body.file.src.trim()
    ) {
      body = replacePostmanVars(request.body.file.src);
    }

    // Determine format from body mode, Content-Type, and Accept
    let format: APIData['format'] = 'json';
    if (request.body?.mode === 'urlencoded') {
      format = 'urlencoded';
    } else if (request.body?.mode === 'file') {
      format = {request: 'binary', response: 'json'};
    } else {
      const contentType = headerValue(headers, 'content-type');
      const fromContentType = formatFromMediaType(contentType);
      if (fromContentType) {
        format = fromContentType;
      }
    }
    const acceptFormat = formatFromMediaType(headerValue(headers, 'accept'));
    if (acceptFormat) {
      if (!request.body) {
        // `format: binary` means "load the request body from a file".
        // Accept-only GETs must not become request-binary.
        format = acceptFormat === 'binary' || acceptFormat === 'multipart' ?
            packFormatSpec({request: 'json', response: acceptFormat}) ||
                acceptFormat :
            acceptFormat;
      } else {
        format = packFormatSpec({
          request: requestFormat(format),
          response: acceptFormat,
        }) || acceptFormat;
      }
    }

    // Determine protocol - only set explicitly for ws, http is the default
    // and can be inferred from URL
    let protocol: 'http'|'ws'|'graphql'|undefined = undefined;
    if (graphql) {
      protocol = 'graphql';
    } else if (typeof url === 'string' && url.toLowerCase().startsWith('ws')) {
      protocol = 'ws';
    }

    // Convert Postman auth to mmt auth field
    const effectiveAuth =
        request.auth === undefined ? inheritedAuth : request.auth;
    const auth = convertPostmanAuth(effectiveAuth);
    const pathInputs = urlVariableInputs(request.url);

    const apiData: APIData = {
      type: 'api',
      title: req.name || request.url?.raw || '',
      description: descriptionInfo.description,
      tags: descriptionInfo.tags,
      protocol,
      format,
      url,
      method: graphql
        ? undefined
        : (request.method || (url ? 'GET' : undefined))?.toLowerCase() as APIData['method'],
      headers,
      query,
      body,
      auth,
      graphql,
      ...(Object.keys(pathInputs).length > 0 ? {inputs: pathInputs} : {}),
    } as APIData;

    // Remove undefined/empty fields to keep the YAML clean
    if (!apiData.description) {
      delete (apiData as any).description;
    }
    if (!apiData.tags || apiData.tags.length === 0) {
      delete (apiData as any).tags;
    }
    if (!apiData.protocol) {
      delete (apiData as any).protocol;
    }
    if (!apiData.headers || Object.keys(apiData.headers).length === 0) {
      delete (apiData as any).headers;
    }
    if (!apiData.cookies || Object.keys(apiData.cookies || {}).length === 0) {
      delete (apiData as any).cookies;
    }
    if (!apiData.body) {
      delete (apiData as any).body;
    }
    if (!apiData.auth) {
      delete (apiData as any).auth;
    }
    if (!apiData.graphql) {
      delete (apiData as any).graphql;
    }
    if (!apiData.method) {
      delete (apiData as any).method;
    }

    // If Postman item has one or more saved examples with originalRequest,
    // expose url, headers, and body as inputs and create example overrides.
    try {
      const pmResponses: any[] = Array.isArray(req.response) ? req.response : [];
      for (const response of pmResponses) {
        const responseOutputs = responseToOutputs(response);
        apiData.outputs = mergeOutputs(apiData.outputs, responseOutputs.apiOutputs);
      }
      const exampleRequests = pmResponses
          .map(r => r && (r.originalRequest || r.request))
          .map(normalizePostmanRequest)
          .filter(rq => rq && (rq.url || rq.body || rq.header));

      if (exampleRequests.length > 0) {
        // Helper: normalize names to safe input keys
        const norm = normalizeInputKey;

        const inputs: Record<string, any> = {};

        // URL as input
        inputs['url'] = materializeUrlInputs(url || '', pathInputs);
        apiData.url = '<<i:url>>';

        // Union header keys across base and all examples
        const baseHeaders = headers || {};
        const headerKeys = new Set<string>(Object.keys(baseHeaders));
        for (const er of exampleRequests) {
          const exHeaders = extractKeyValue(er.header || []);
          for (const k of Object.keys(exHeaders)) {
            headerKeys.add(k);
          }
        }

        // Rebuild headers with input placeholders and defaults
        const rebuiltHeaders: Record<string, string> = {};
        for (const hk of Array.from(headerKeys)) {
          const inputKey = `hdr_${norm(hk)}`;
          const defVal = Object.prototype.hasOwnProperty.call(baseHeaders, hk)
            ? (baseHeaders as any)[hk]
            : OMIT_SENTINEL;
          inputs[inputKey] = typeof defVal === 'string' ? replacePostmanVars(defVal) : String(defVal ?? '');
          rebuiltHeaders[hk] = `<<i:${inputKey}>>`;
        }
        if (Object.keys(rebuiltHeaders).length > 0) {
          apiData.headers = rebuiltHeaders;
        }

        // Body as input(s)
        if (typeof body === 'string') {
          // Treat raw body as a single string input
          inputs['body'] = body;
          apiData.body = '<<i:body>>';
        } else if (body && typeof body === 'object') {
          // urlencoded/formdata style: parameterize each field; union keys across examples
          const baseBody: Record<string, any> = body as any;
          const bodyKeys = new Set<string>(Object.keys(baseBody));
          for (const er of exampleRequests) {
            const mode = er.body?.mode;
            if (mode === 'urlencoded') {
              const bb = extractKeyValue(er.body?.urlencoded || []);
              Object.keys(bb).forEach(k => bodyKeys.add(k));
            } else if (mode === 'formdata') {
              const bb = extractKeyValue(er.body?.formdata || []);
              Object.keys(bb).forEach(k => bodyKeys.add(k));
            } else if (mode === 'raw') {
              // Raw string example body present, fallback to single body input approach
              inputs['body'] = typeof baseBody === 'string' ? (baseBody as any) : JSON.stringify(baseBody);
              apiData.body = '<<i:body>>';
              // Clear per-field plan and stop collecting keys
              bodyKeys.clear();
              break;
            }
          }
          if (bodyKeys.size > 0) {
            const rebuiltBody: Record<string, any> = {};
            for (const bk of Array.from(bodyKeys)) {
              const inputKey = `body_${norm(bk)}`;
              const defVal = Object.prototype.hasOwnProperty.call(
                  baseBody, bk)
                ? baseBody[bk]
                : OMIT_SENTINEL;
              inputs[inputKey] = typeof defVal === 'string' ? defVal : String(defVal ?? '');
              rebuiltBody[bk] = `<<i:${inputKey}>>`;
            }
            apiData.body = rebuiltBody;
          }
        }

        // Attach inputs defaults
        apiData.inputs = inputs as any;

        // Build examples overriding only changed inputs
        const examples = pmResponses.map((resp, idx) => {
          const or = normalizePostmanRequest(resp && (resp.originalRequest || resp.request));
          const example: any = {
            name: resp?.name || `example_${idx + 1}`,
            description: resp?.description || undefined,
            inputs: {} as Record<string, any>,
          };
          if (!or) {
            return example;
          }

          // URL override
          const exUrl = materializeUrlInputs(
              normalizePostmanUrl(or.url, collectionVariables),
              urlVariableInputs(or.url));
          if (typeof exUrl === 'string' && exUrl !== inputs['url']) {
            example.inputs!['url'] = exUrl;
          }

          // Header overrides
          if (Object.prototype.hasOwnProperty.call(or, 'header')) {
            const exHeaders = transformRecordValues(extractKeyValue(or.header));
            for (const hk of Array.from(headerKeys)) {
              const inputKey = `hdr_${norm(hk)}`;
              const exVal = Object.prototype.hasOwnProperty.call(
                  exHeaders || {}, hk)
                ? (exHeaders as any)[hk]
                : OMIT_SENTINEL;
              const normExVal = typeof exVal === 'string' ? exVal : String(exVal ?? '');
              if (normExVal !== inputs[inputKey]) {
                example.inputs![inputKey] = normExVal;
              }
            }
          }

          // Body overrides
          const mode = or.body?.mode;
          if (!Object.prototype.hasOwnProperty.call(or, 'body')) {
            // Saved examples may only carry an originalRequest URL. In that case,
            // keep the base request body instead of overriding it to empty values.
          } else if (apiData.body === '<<i:body>>') {
            // single body input
            const exBodyVal = mode === 'raw' ? (typeof or.body?.raw === 'string' ? replacePostmanVars(or.body?.raw) : or.body?.raw) : '';
            const normExBody = typeof exBodyVal === 'string' ? exBodyVal : String(exBodyVal ?? '');
            if (normExBody !== inputs['body']) {
              example.inputs!['body'] = normExBody;
            }
          } else if (apiData.body && typeof apiData.body === 'object') {
            // per-field inputs
            let exBodyObj: Record<string, any> = {};
            if (mode === 'urlencoded') {
              exBodyObj = transformRecordValues(extractKeyValue(or.body?.urlencoded)) || {};
            } else if (mode === 'formdata') {
              exBodyObj = transformRecordValues(extractKeyValue(or.body?.formdata)) || {};
            }
            for (const bk of Object.keys(apiData.body as any)) {
              const inputKey = `body_${norm(bk)}`;
              const exVal = Object.prototype.hasOwnProperty.call(
                  exBodyObj, bk)
                ? exBodyObj[bk]
                : OMIT_SENTINEL;
              const normExVal = typeof exVal === 'string' ? exVal : String(exVal ?? '');
              if (normExVal !== inputs[inputKey]) {
                example.inputs![inputKey] = normExVal;
              }
            }
          }

          // Clean empty inputs if none changed
          if (Object.keys(example.inputs).length === 0) {
            delete example.inputs;
          }
          if (!example.description) {
            delete example.description;
          }
          const responseOutputs = responseToOutputs(resp);
          if (Object.keys(responseOutputs.exampleOutputs).length > 0) {
            example.outputs = responseOutputs.exampleOutputs;
          }
          return example;
        });

        // Keep only examples that have a name or inputs/description
        apiData.examples = examples.filter(ex => ex && (ex.name || ex.inputs || ex.description));
      }
      // Fallback: responses exist but no originalRequest/request examples captured
      if (!apiData.examples && pmResponses.length > 0) {
        apiData.examples = pmResponses
            .map((resp, idx) => {
              const responseOutputs = responseToOutputs(resp);
              return {
                name: resp?.name || `example_${idx + 1}`,
                ...(Object.keys(responseOutputs.exampleOutputs).length > 0 ? {outputs: responseOutputs.exampleOutputs} : {}),
              };
            })
            .filter(ex => ex.name);
      }
    } catch (e) {
      // Non-fatal: if examples parsing fails, return base apiData
  console.warn('postmanToAPI: Failed to parse examples for item', req?.name || request?.url?.raw || '', e);
    }

    return apiData;
  });
}

function convertPostmanAuth(pmAuth: any): AuthConfig | undefined {
  if (!pmAuth || !pmAuth.type) {
    return undefined;
  }
  const getField = (arr: any[] | Record<string, any> | undefined, key: string): string => {
    if (Array.isArray(arr)) {
      return arr.find((e: any) => e?.key === key)?.value ?? '';
    }
    if (arr && typeof arr === 'object') {
      const value = (arr as any)[key];
      return value === undefined || value === null ? '' : String(value);
    }
    return '';
  };
  const credential = (value: string, fallbackName: string): string => {
    if (/^<[^<>]+>$/.test(value.trim())) {
      return `<<e:${fallbackName}>>`;
    }
    return replacePostmanVars(value);
  };

  switch (pmAuth.type) {
    case 'noauth':
      return 'none';
    case 'bearer': {
      const token = getField(pmAuth.bearer, 'token');
      return token
        ? {type: 'bearer', token: credential(token, 'bearer_token')}
        : undefined;
    }
    case 'basic': {
      const username = getField(pmAuth.basic, 'username');
      const password = getField(pmAuth.basic, 'password');
      return (username || password)
          ? {
            type: 'basic',
            username: credential(username, 'username'),
            password: credential(password, 'password'),
          }
          : undefined;
    }
    case 'apikey': {
      const value = getField(pmAuth.apikey, 'value');
      const key = getField(pmAuth.apikey, 'key') || 'X-API-Key';
      const inField = getField(pmAuth.apikey, 'in');
      if (!value) {
        return undefined;
      }
      if (inField === 'query') {
        return {
          type: 'api-key',
          query: key,
          value: credential(value, 'api_key'),
        };
      }
      return {
        type: 'api-key',
        header: key,
        value: credential(value, 'api_key'),
      };
    }
    case 'oauth2': {
      const opts = pmAuth.oauth2;
      if (!Array.isArray(opts)) {
        return undefined;
      }
      const grant = getField(opts, 'grant_type');
      if (grant !== 'client_credentials') {
        const accessToken =
            getField(opts, 'accessToken') || getField(opts, 'token');
        return {
          type: 'bearer',
          token: accessToken
            ? replacePostmanVars(accessToken)
            : '<<e:access_token>>',
        };
      }
      const tokenUrl = getField(opts, 'accessTokenUrl');
      const clientId = getField(opts, 'clientId');
      const clientSecret = getField(opts, 'clientSecret');
      const scope = getField(opts, 'scope');
      if (!tokenUrl || !clientId || !clientSecret) {
        return undefined;
      }
      return {
        type: 'oauth2',
        grant: 'client_credentials',
        token_url: replacePostmanVars(tokenUrl),
        client_id: replacePostmanVars(clientId),
        client_secret: replacePostmanVars(clientSecret),
        ...(scope ? {scope: replacePostmanVars(scope)} : {}),
      };
    }
    default:
      return undefined;
  }
}
