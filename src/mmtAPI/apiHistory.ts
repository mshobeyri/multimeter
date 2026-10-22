import type {HistoryItem, HistoryManager} from '../historyManager';

function bodyToHistoryContent(body: unknown): string {
  if (body === null || body === undefined || body === '') {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function stringMap(value: unknown): Record<string, string>|undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === 'string' ? v : String(v ?? '');
  }
  return out;
}

/** Map a direct-API `network-*` reporter event to History panel entries. */
export function addHistoryFromApiNetworkReport(
    historyManager: HistoryManager|undefined|null, msg: any): void {
  if (!historyManager || !msg || typeof msg !== 'object') {
    return;
  }
  const scope = msg.scope;
  if (scope !== 'network-request' && scope !== 'network-response' &&
      scope !== 'network-error') {
    return;
  }

  const req = msg.request && typeof msg.request === 'object' ? msg.request : {};
  const protocol = typeof req.protocol === 'string' && req.protocol ?
      req.protocol :
      'http';
  const methodRaw = typeof req.method === 'string' ? req.method : 'get';
  const method = methodRaw.trim() || 'get';
  const url = typeof req.url === 'string' ? req.url : '';
  const grpcService = req.service || req.grpc?.service;
  const grpcMethod = req.method && protocol === 'grpc' ? req.method :
      (req.grpc?.method);
  const historyMethod = protocol === 'grpc' && grpcService ?
      `${grpcService}/${grpcMethod || method}` :
      method.toUpperCase();

  if (scope === 'network-request') {
    const item: HistoryItem = {
      type: 'send',
      method: historyMethod,
      protocol,
      title: url || historyMethod,
      headers: stringMap(req.headers || req.metadata),
      query: stringMap(req.query),
      cookies: stringMap(req.cookies),
      content: method.toLowerCase() === 'get' ?
          '' :
          bodyToHistoryContent(
              req.body !== undefined ? req.body : req.message),
    };
    historyManager.add(item);
    return;
  }

  const res = msg.response && typeof msg.response === 'object' ? msg.response :
                                                                {};
  const status = typeof res.status === 'number' ? res.status : -1;
  const statusText = String(res.statusText || res.errorMessage || '').trim();
  const content = bodyToHistoryContent(res.body) || statusText;
  const item: HistoryItem = {
    type: scope === 'network-error' || status < 0 ? 'error' : 'recv',
    method: historyMethod,
    protocol,
    title: url || historyMethod,
    headers: stringMap(res.headers || res.metadata),
    cookies: stringMap(res.cookies),
    content,
    duration: typeof res.duration === 'number' ? res.duration : undefined,
    status,
    statusText: statusText || undefined,
  };
  historyManager.add(item);
}
