jest.mock('./networkCoreNode', () => {
  const connections: Record<string, any> = {};
  return {
    connections,
    sendHttpRequest: jest.fn(),
    createWebSocket: jest.fn(),
    addWsConnection: jest.fn((wsId: string, ws: any) => {
      connections[wsId] = ws;
    }),
    deleteWsConnection: jest.fn((wsId: string) => {
      delete connections[wsId];
    }),
    wsConnections: jest.fn((wsId: string) => connections[wsId]),
  };
});

jest.mock('./grpcCore', () => ({
  sendGrpcRequest: jest.fn(),
}));

jest.mock('ws', () => {
  const WebSocket: any = function MockWebSocket() {};
  WebSocket.OPEN = 1;
  WebSocket.CONNECTING = 0;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;
  return WebSocket;
});

import {connectionTracker} from './connectionTracker';
import {sendGrpcRequest} from './grpcCore';
import {handleNetworkMessage, getCertificateStatusForUrl} from './network';
import {DEFAULT_NETWORK_CONFIG, NetworkConfig} from './NetworkData';
import {
  addWsConnection,
  createWebSocket,
  deleteWsConnection,
  sendHttpRequest,
  wsConnections,
} from './networkCoreNode';

function createFakeWs(readyState = 1) {
  const handlers: Record<string, Function[]> = {};
  const ws = {
    readyState,
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event: string, handler: Function) => {
      (handlers[event] ||= []).push(handler);
    }),
    emit(event: string, ...args: any[]) {
      for (const handler of handlers[event] || []) {
        handler(...args);
      }
    },
  };
  return {ws, handlers};
}

async function flush() {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const mockedSendHttp = sendHttpRequest as jest.Mock;
const mockedCreateWebSocket = createWebSocket as jest.Mock;
const mockedSendGrpc = sendGrpcRequest as jest.Mock;
const connections = (require('./networkCoreNode') as any).connections as Record<string, any>;

function baseConfig(overrides: Partial<NetworkConfig> = {}): NetworkConfig {
  return {
    ...DEFAULT_NETWORK_CONFIG,
    autoFormat: true,
    ca: {enabled: true, certData: Buffer.from('abc')},
    clients: [
      {id: '1', name: 'c1', host: '*.example.com', enabled: true},
      {id: '2', name: 'any', host: '*', enabled: false},
    ] as any,
    ...overrides,
  };
}

describe('getCertificateStatusForUrl', () => {
  const cfg = baseConfig();

  it('returns matching info for https', () => {
    expect(getCertificateStatusForUrl('https://api.example.com/users', cfg)).toEqual({
      protocol: 'https:',
      hostname: 'api.example.com',
      sslValidation: true,
      hasCA: true,
      hasClientCert: true,
      isSecure: true,
    });
  });

  it('works for ws and no match', () => {
    expect(getCertificateStatusForUrl('ws://host.other/path', cfg)).toMatchObject({
      protocol: 'ws:',
      hostname: 'host.other',
      hasClientCert: false,
      isSecure: false,
    });
  });

  it('matches client certs using host-port patterns', () => {
    const portCfg = baseConfig({
      clients: [{id: '1', name: 'port-cert', host: '*:8085', enabled: true}] as any,
    });
    expect(getCertificateStatusForUrl('https://api.example.com:8085/users', portCfg))
        .toMatchObject({hasClientCert: true});
    expect(getCertificateStatusForUrl('https://api.example.com:8086/users', portCfg))
        .toMatchObject({hasClientCert: false});
  });

  it('returns null for invalid URL', () => {
    expect(getCertificateStatusForUrl('not a url', cfg)).toBeNull();
  });

  it('reports hasCA false and wss secure when CA is unused', () => {
    const noCa = baseConfig({
      ca: {enabled: false, certData: Buffer.from('abc')},
    });
    expect(getCertificateStatusForUrl('wss://secure.example.com/socket', noCa)).toMatchObject({
      protocol: 'wss:',
      hasCA: false,
      isSecure: true,
    });

    const missingData = baseConfig({ca: {enabled: true}});
    expect(getCertificateStatusForUrl('https://api.example.com', missingData)?.hasCA).toBe(false);
  });
});

describe('handleNetworkMessage', () => {
  beforeEach(() => {
    mockedSendHttp.mockReset();
    mockedCreateWebSocket.mockReset();
    mockedSendGrpc.mockReset();
    (addWsConnection as jest.Mock).mockClear();
    (deleteWsConnection as jest.Mock).mockClear();
    (wsConnections as jest.Mock).mockClear();
    for (const key of Object.keys(connections)) {
      delete connections[key];
    }
    connectionTracker.clear();
  });

  afterEach(() => {
    connectionTracker.clear();
  });

  it('posts http-response on successful send', async () => {
    mockedSendHttp.mockResolvedValueOnce({status: 200, body: 'ok'});
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'http-send',
      url: 'https://example.com',
      method: 'post',
      timeout: 10,
      headers: {a: 'b'},
      body: '{}',
      query: {q: '1'},
      cookies: {c: 'd'},
      requestId: 'r1',
    }, baseConfig(), postMessage);
    await flush();
    expect(mockedSendHttp).toHaveBeenCalledWith({
      url: 'https://example.com',
      method: 'post',
      timeout: 10,
      headers: {a: 'b'},
      body: '{}',
      query: {q: '1'},
      cookies: {c: 'd'},
    }, expect.any(Object));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'http-response',
      data: {status: 200, body: 'ok'},
      requestId: 'r1',
    });
  });

  it('posts http-error with code and message', async () => {
    mockedSendHttp.mockRejectedValueOnce(Object.assign(new Error('boom'), {code: 'ECONNRESET'}));
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'http-send',
      url: 'https://example.com',
      requestId: 'r2',
    }, baseConfig(), postMessage);
    await flush();
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'http-error',
      data: {
        body: null,
        headers: null,
        status: -1,
        message: 'boom',
        code: 'ECONNRESET',
        duration: null,
      },
      requestId: 'r2',
    });
  });

  it('posts http-error defaults when thrown value is not an Error', async () => {
    mockedSendHttp.mockRejectedValueOnce('offline');
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'http-send',
      url: 'https://example.com',
      requestId: 'r3',
    }, baseConfig(), postMessage);
    await flush();
    expect(postMessage.mock.calls[0][0].data).toMatchObject({
      message: 'offline',
      code: 'NETWORK_ERROR',
    });
  });

  it('ignores cancel because it is not implemented in the handler', () => {
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'cancel',
      requestId: 'r-cancel',
    }, baseConfig(), postMessage);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('connects a websocket and forwards open/message/close/error', () => {
    const {ws} = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'ws1'});
    const postMessage = jest.fn();
    const cfg = baseConfig({autoFormat: false});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com:9000/socket',
      wsId: 'ws1',
    }, cfg, postMessage, {
      getConfig: () => baseConfig({autoFormat: true}),
    });

    const tracked = connectionTracker.getAll();
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toMatchObject({
      host: 'example.com:9000',
      protocol: 'ws',
      state: 'connecting',
    });

    ws.emit('open');
    expect(postMessage).toHaveBeenCalledWith({command: 'network', action: 'ws-open', wsId: 'ws1'});
    expect(connectionTracker.get(tracked[0].id)?.state).toBe('open');

    ws.emit('message', Buffer.from('hello'));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'ws-message',
      wsId: 'ws1',
      data: 'hello',
      autoformat: true,
    });
    expect(connectionTracker.get(tracked[0].id)?.requestCount).toBe(1);

    ws.emit('close', 1001, Buffer.from('going away'));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'ws-close',
      wsId: 'ws1',
      code: 1001,
      reason: 'going away',
      closedBy: 'server',
    });
    expect(deleteWsConnection).toHaveBeenCalledWith('ws1');
    expect(connectionTracker.get(tracked[0].id)).toBeUndefined();
  });

  it('uses default ports, treats 1000 as client close, and falls back without getConfig', () => {
    const {ws} = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'ws2'});
    const postMessage = jest.fn();
    const cfg = baseConfig({autoFormat: false});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'wss://secure.example.com/chat',
      wsId: 'ws2',
    }, cfg, postMessage);

    expect(connectionTracker.getAll()[0]).toMatchObject({
      host: 'secure.example.com:443',
      protocol: 'wss',
    });
    ws.emit('message', 'plain');
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ws-message',
      data: 'plain',
      autoformat: false,
    }));
    ws.emit('close', 1000);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ws-close',
      closedBy: 'client',
      reason: undefined,
    }));
  });

  it('uses the raw url when parsing fails', () => {
    const {ws} = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'bad'});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'not a url',
      wsId: 'bad',
    }, baseConfig(), jest.fn());
    expect(connectionTracker.getAll()[0].host).toBe('not a url');
  });

  it('replaces an existing websocket connection', () => {
    const first = createFakeWs();
    const second = createFakeWs();
    mockedCreateWebSocket
        .mockReturnValueOnce({ws: first.ws, wsId: 'ws1'})
        .mockReturnValueOnce({ws: second.ws, wsId: 'ws1'});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws1',
    }, baseConfig(), jest.fn());
    const firstId = connectionTracker.getAll()[0].id;

    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws1',
    }, baseConfig(), jest.fn());

    expect(first.ws.close).toHaveBeenCalled();
    expect(deleteWsConnection).toHaveBeenCalledWith('ws1');
    expect(connectionTracker.get(firstId)).toBeUndefined();
    expect(connectionTracker.getAll()).toHaveLength(1);
  });

  it('close handler closes the socket and swallows errors', () => {
    const ok = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws: ok.ws, wsId: 'ws-ok'});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws-ok',
    }, baseConfig(), jest.fn());
    const okId = connectionTracker.getAll()[0].id;
    connectionTracker.requestClose(okId);
    expect(ok.ws.close).toHaveBeenCalled();
    expect(deleteWsConnection).toHaveBeenCalledWith('ws-ok');

    const {ws} = createFakeWs();
    ws.close.mockImplementation(() => {
      throw new Error('already closed');
    });
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'ws1'});
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws1',
    }, baseConfig(), jest.fn());
    const throwingId = connectionTracker.getAll().find((c) => c.id !== okId)!.id;
    expect(() => {
      connectionTracker.requestClose(throwingId);
    }).not.toThrow();
    expect(ws.close).toHaveBeenCalled();
  });

  it('posts ws-error on socket error', () => {
    const {ws} = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'ws1'});
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws1',
    }, baseConfig(), postMessage);
    ws.emit('error', new Error('nope'));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'ws-error',
      wsId: 'ws1',
      error: 'nope',
      code: 'WS_ERROR',
    });
    ws.emit('error', 'string-error');
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      error: 'string-error',
    }));
  });

  it('sends on an open websocket and stringifies non-strings', () => {
    const {ws} = createFakeWs(1);
    connections.ws1 = ws;
    handleNetworkMessage({
      command: 'network',
      action: 'ws-send',
      wsId: 'ws1',
      data: 'ping',
    }, baseConfig(), jest.fn());
    expect(ws.send).toHaveBeenCalledWith('ping');

    handleNetworkMessage({
      command: 'network',
      action: 'ws-send',
      wsId: 'ws1',
      data: {ok: true} as any,
    }, baseConfig(), jest.fn());
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ok: true}));
  });

  it('posts WS_NOT_OPEN when the socket is missing or not open', () => {
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'ws-send',
      wsId: 'missing',
      data: 'x',
    }, baseConfig(), postMessage);
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'ws-error',
      wsId: 'missing',
      error: 'WebSocket not open',
      code: 'WS_NOT_OPEN',
    });

    const {ws} = createFakeWs(0);
    connections.closed = ws;
    handleNetworkMessage({
      command: 'network',
      action: 'ws-send',
      wsId: 'closed',
      data: 'x',
    }, baseConfig(), postMessage);
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('disconnects an open websocket as a client close', () => {
    const {ws} = createFakeWs();
    mockedCreateWebSocket.mockReturnValue({ws, wsId: 'ws1'});
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'ws-connect',
      url: 'ws://example.com',
      wsId: 'ws1',
    }, baseConfig(), postMessage);
    const id = connectionTracker.getAll()[0].id;
    handleNetworkMessage({
      command: 'network',
      action: 'ws-disconnect',
      wsId: 'ws1',
    }, baseConfig(), postMessage);
    expect(ws.close).toHaveBeenCalled();
    expect(deleteWsConnection).toHaveBeenCalledWith('ws1');
    expect(connectionTracker.get(id)).toBeUndefined();
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'ws-close',
      wsId: 'ws1',
      closedBy: 'client',
    });
  });

  it('does nothing when disconnecting a missing socket', () => {
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'ws-disconnect',
      wsId: 'none',
    }, baseConfig(), postMessage);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('posts grpc-response on success and defaults proto to reflect', async () => {
    mockedSendGrpc.mockImplementation(async (req, _cfg, fileLoader, basePath) => {
      expect(req).toMatchObject({
        url: 'grpc://svc',
        proto: 'reflect',
        service: 'S',
        method: 'M',
        stream: 'server',
      });
      expect(basePath).toBe('/tmp');
      expect(await fileLoader('proto')).toBe('file');
      return {status: 0, body: '{}'};
    });
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'grpc-send',
      url: 'grpc://svc',
      service: 'S',
      method: 'M',
      metadata: {k: 'v'},
      message: {a: 1},
      stream: 'server',
      requestId: 'g1',
    }, baseConfig(), postMessage, {
      fileLoader: async () => 'file',
      basePath: '/tmp',
    });
    await flush();
    expect(postMessage).toHaveBeenCalledWith({
      command: 'network',
      action: 'grpc-response',
      data: {status: 0, body: '{}'},
      requestId: 'g1',
    });
  });

  it('posts grpc-error and uses the default file loader when missing', async () => {
    mockedSendGrpc.mockImplementation(async (_req, _cfg, fileLoader) => {
      await fileLoader('x');
    });
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'grpc-send',
      url: 'grpc://svc',
      proto: 'svc.proto',
      service: 'S',
      method: 'M',
      requestId: 'g2',
    }, baseConfig(), postMessage);
    await flush();
    expect(postMessage.mock.calls[0][0]).toMatchObject({
      action: 'grpc-error',
      data: {
        message: 'File loader not available',
        code: 'GRPC_ERROR',
      },
      requestId: 'g2',
    });
  });

  it('posts grpc-error defaults for non-Error throws', async () => {
    mockedSendGrpc.mockRejectedValueOnce('nope');
    const postMessage = jest.fn();
    handleNetworkMessage({
      command: 'network',
      action: 'grpc-send',
      url: 'grpc://svc',
      proto: 'svc.proto',
      service: 'S',
      method: 'M',
      requestId: 'g3',
    }, baseConfig(), postMessage, {fileLoader: async () => ''});
    await flush();
    expect(postMessage.mock.calls[0][0].data).toMatchObject({
      message: 'nope',
      code: 'GRPC_ERROR',
    });
  });
});
