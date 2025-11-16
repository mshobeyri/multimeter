import { APIData } from './APIData';

// Map Postman dynamic random variables to Multimeter random token names
// Only include those we support in RANDOM_TOKEN_MAP.
const POSTMAN_RANDOM_MAP: Record<string, string> = {
  '$guid': 'uuid',
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

    // Determine protocol
    let protocol: 'http' | 'ws' = 'http';
    if (typeof url === 'string' && url.toLowerCase().startsWith('ws')) {
      protocol = 'ws';
    }

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
    } as APIData;

    // Remove undefined/empty fields to keep the YAML clean
    if (!apiData.description) {
      delete (apiData as any).description;
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

    return apiData;
  });
}
