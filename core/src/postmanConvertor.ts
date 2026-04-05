import { APIData, AuthConfig } from './APIData';

// Map Postman dynamic random variables to Multimeter random token names
// Only include those we support in RANDOM_TOKEN_MAP.
const POSTMAN_RANDOM_MAP: Record<string, string> = {
  '$guid': 'uuid',
  'timestamp': 'epoch',
  '$randomUUID': 'uuid',
  '$randomInt': 'int',
  '$randomBoolean': 'bool',
  '$randomColor': 'color',
  '$randomEmail': 'email',
  '$randomIP': 'ip',
  '$randomIPv6': 'ipv6',
  '$randomPhoneNumber': 'phone',
  '$randomFirstName': 'first_name',
  '$randomLastName': 'last_name',
  '$randomFullName': 'full_name',
  '$randomCountry': 'country'
};

function replacePostmanVars(str: string): string {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner) => {
    const name = String(inner).trim();
    if (POSTMAN_RANDOM_MAP[name]) {
      return `r:${POSTMAN_RANDOM_MAP[name]}`;
    }
    return `<<e:${name}>>`;
  });
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
function extractKeyValue(arr: any[] = []): Record<string, string> {
  const obj: Record<string, string> = {};
  if (Array.isArray(arr)) {
    arr.forEach((item) => {
      if (item && item.key && typeof item.value !== 'undefined') {
        obj[item.key] = String(item.value);
      }
    });
  }
  return obj;
}

function flattenItems(items: any[]): any[] {
  return items.flatMap((item) => (item && item.item ? flattenItems(item.item) : [item]));
}

export function postmanToAPI(postmanJson: any): APIData[] {
  if (!postmanJson || !postmanJson.item) {
    return [];
  }

  const requests = flattenItems(postmanJson.item);

  return requests.map((req: any) => {
    const request = req.request || {};
    const rawUrl = typeof request.url === 'string' ? request.url : request.url?.raw || '';
    const url = replacePostmanVars(rawUrl);

    // Convert Postman headers array to object
  const headers = transformRecordValues(extractKeyValue(request.header));

    // Convert Postman query array to object
  const query = transformRecordValues(extractKeyValue(request.url?.query));

    let body: string | object | undefined = undefined;
    if (request.body?.mode === 'raw') {
      body = typeof request.body.raw === 'string' ? replacePostmanVars(request.body.raw) : request.body.raw;
    } else if (request.body?.mode === 'urlencoded') {
      body = transformRecordValues(extractKeyValue(request.body.urlencoded));
    } else if (request.body?.mode === 'formdata') {
      body = transformRecordValues(extractKeyValue(request.body.formdata));
    }

    // Determine format from content-type header
    let format: 'json' | 'xml' | 'text' = 'json';
  const contentType = (headers?.['content-type'] ?? headers?.['Content-Type']) as string | undefined;
    if (typeof contentType === 'string') {
      const lc = contentType.toLowerCase();
      if (lc.includes('xml')) {
        format = 'xml';
      } else if (lc.includes('text')) {
        format = 'text';
      }
    }

    // Determine protocol - only set explicitly for ws, http is the default
    // and can be inferred from URL
    let protocol: 'http'|'ws'|undefined = undefined;
    if (typeof url === 'string' && url.toLowerCase().startsWith('ws')) {
      protocol = 'ws';
    }

    // Convert Postman auth to mmt auth field
    const auth = convertPostmanAuth(request.auth);

    const apiData: APIData = {
      type: 'api',
      title: req.name || request.url?.raw || '',
      description: req.description || undefined,
      protocol,
      format,
      url,
      method: request.method?.toLowerCase() as APIData['method'],
      headers,
      query,
      body,
      auth,
    } as APIData;

    // Remove undefined/empty fields to keep the YAML clean
    if (!apiData.description) {
      delete (apiData as any).description;
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

    // If Postman item has one or more saved examples with originalRequest,
    // expose url, headers, and body as inputs and create example overrides.
    try {
      const pmResponses: any[] = Array.isArray(req.response) ? req.response : [];
      const exampleRequests = pmResponses
          .map(r => r && (r.originalRequest || r.request))
          .filter(rq => rq && (rq.url || rq.body || rq.header));

      if (exampleRequests.length > 0) {
        // Helper: normalize names to safe input keys
        const norm = (s: string) => String(s)
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/__+/g, '_');

        const inputs: Record<string, any> = {};

        // URL as input
        inputs['url'] = url || '';
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
          const defVal = (baseHeaders as any)[hk] ?? '';
          inputs[inputKey] = typeof defVal === 'string' ? replacePostmanVars(defVal) : String(defVal ?? '');
          rebuiltHeaders[hk] = `<<i:${inputKey}>>`;
        }
        if (Object.keys(rebuiltHeaders).length > 0) {
          apiData.headers = rebuiltHeaders;
        }

        // Body as input(s)
        if (typeof body === 'string' || body === undefined) {
          // Treat raw/undefined body as a single string input
          inputs['body'] = typeof body === 'string' ? body : '';
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
              const defVal = baseBody[bk] ?? '';
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
          const or = resp && (resp.originalRequest || resp.request);
          const example: any = {
            name: resp?.name || `example_${idx + 1}`,
            description: resp?.description || undefined,
            inputs: {} as Record<string, any>,
          };
          if (!or) {
            return example;
          }

          // URL override
          const exRawUrl = typeof or.url === 'string' ? or.url : or.url?.raw || '';
          const exUrl = replacePostmanVars(exRawUrl);
          if (typeof exUrl === 'string' && exUrl !== inputs['url']) {
            example.inputs!['url'] = exUrl;
          }

          // Header overrides
          const exHeaders = transformRecordValues(extractKeyValue(or.header));
          for (const hk of Array.from(headerKeys)) {
            const inputKey = `hdr_${norm(hk)}`;
            const exVal = (exHeaders as any)?.[hk] ?? '';
            const normExVal = typeof exVal === 'string' ? exVal : String(exVal ?? '');
            if (normExVal !== inputs[inputKey]) {
              example.inputs![inputKey] = normExVal;
            }
          }

          // Body overrides
          const mode = or.body?.mode;
          if (apiData.body === '<<i:body>>') {
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
              const exVal = exBodyObj[bk] ?? '';
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
          return example;
        });

        // Keep only examples that have a name or inputs/description
        apiData.examples = examples.filter(ex => ex && (ex.name || ex.inputs || ex.description));
      }
      // Fallback: responses exist but no originalRequest/request examples captured
      if (!apiData.examples && pmResponses.length > 0) {
        apiData.examples = pmResponses
            .map((resp, idx) => ({ name: resp?.name || `example_${idx + 1}` }))
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
  const getField = (arr: any[] | undefined, key: string): string =>
      (Array.isArray(arr) ? arr.find((e: any) => e?.key === key)?.value : undefined) ?? '';

  switch (pmAuth.type) {
    case 'bearer': {
      const token = getField(pmAuth.bearer, 'token');
      return token ? {type: 'bearer', token: replacePostmanVars(token)} : undefined;
    }
    case 'basic': {
      const username = getField(pmAuth.basic, 'username');
      const password = getField(pmAuth.basic, 'password');
      return (username || password)
          ? {type: 'basic', username: replacePostmanVars(username), password: replacePostmanVars(password)}
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
        return {type: 'api-key', query: key, value: replacePostmanVars(value)};
      }
      return {type: 'api-key', header: key, value: replacePostmanVars(value)};
    }
    case 'oauth2': {
      const opts = pmAuth.oauth2;
      if (!Array.isArray(opts)) {
        return undefined;
      }
      const grant = getField(opts, 'grant_type');
      if (grant !== 'client_credentials') {
        return undefined;
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
