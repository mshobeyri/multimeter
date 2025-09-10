import WebSocket from 'ws';

export function less(a: any, b: any) {
  return a < b;
}

export function greater(a: any, b: any) {
  return a > b;
}

export function lessOrEqual(a: any, b: any) {
  return a <= b;
}

export function greaterOrEqual(a: any, b: any) {
  return a >= b;
}

export function equals(a: any, b: any) {
  return a === b;
}

export function notEquals(a: any, b: any) {
  return a !== b;
}

export function isAt(a: any, b: any) {
  // Checks if a is in b (for strings or arrays)
  if (typeof b === 'string' || Array.isArray(b)) {
    return b.includes(a);
  }
  return false;
}

export function isNotAt(a: any, b: any) {
  if (typeof b === 'string' || Array.isArray(b)) {
    return !b.includes(a);
  }
  return true;
}

export function matches(a: any, b: any) {
  // b is a regex string, e.g. "^foo.*"
  try {
    const re = new RegExp(b);
    return re.test(a);
  } catch {
    return false;
  }
}

export function notMatches(a: any, b: any) {
  try {
    const re = new RegExp(b);
    return !re.test(a);
  } catch {
    return true;
  }
}

export function startsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.startsWith(b);
  }
  return false;
}

export function notStartsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.startsWith(b);
  }
  return true;
}

export function endsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.endsWith(b);
  }
  return false;
}

export function notEndsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.endsWith(b);
  }
  return true;
}
export async function send(params: any) {
  const {url} = params;
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return sendWebSocket(params);
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    return sendHttp(params);
  } else {
    throw new Error('Unsupported protocol in URL: ' + url);
  }
}

// --- HTTP ---

async function sendHttp({url, headers = {}, body, cookie}: any) {
  const fetchHeaders = {...headers};
  if (cookie) {
    fetchHeaders['Cookie'] = cookie;
  }

  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    data
  };
}

// --- WebSocket ---

const wsConnections: Map<string, WebSocket> = new Map();

async function sendWebSocket({url, message}: any) {
  let ws = wsConnections.get(url);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    ws = await createWebSocket(url);
    wsConnections.set(url, ws);
  }

  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      reject(new Error('WebSocket response timeout'));
    }, 10000);

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      resolve({data: event.data});
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };

    ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  });
}

function createWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
  });
}

// --- Optional: Close all connections (for cleanup) ---
export function closeAllConnections() {
  for (const ws of wsConnections.values()) {
    ws.close();
  }
  wsConnections.clear();
}