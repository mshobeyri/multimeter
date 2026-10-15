import {addHistoryFromApiNetworkReport} from './apiHistory';

function collect() {
  const added: any[] = [];
  const historyManager = {
    add: (item: any) => {
      added.push(item);
    },
  } as any;
  return {added, historyManager};
}

describe('addHistoryFromApiNetworkReport', () => {
  it('records send then recv from network reporter events', () => {
    const {added, historyManager} = collect();

    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'https://example.com/echo',
        method: 'post',
        protocol: 'http',
        headers: {'Content-Type': 'application/json'},
        body: {id: 'abc-123'},
      },
    });
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-response',
      request: {
        url: 'https://example.com/echo',
        method: 'post',
        protocol: 'http',
      },
      response: {
        status: 200,
        statusText: 'OK',
        body: {ok: true},
        headers: {'content-type': 'application/json'},
        duration: 12,
      },
    });

    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({
      type: 'send',
      method: 'POST',
      protocol: 'http',
      title: 'https://example.com/echo',
      content: JSON.stringify({id: 'abc-123'}),
    });
    expect(added[1]).toMatchObject({
      type: 'recv',
      method: 'POST',
      status: 200,
      duration: 12,
      content: JSON.stringify({ok: true}),
    });
  });

  it('ignores unrelated reporter scopes', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'test-step',
      title: 'assert',
    });
    expect(added).toHaveLength(0);
  });

  it('no-ops when historyManager or message is missing', () => {
    expect(() => addHistoryFromApiNetworkReport(undefined, {
      scope: 'network-request',
      request: {url: 'https://x', method: 'get'},
    })).not.toThrow();
    expect(() => addHistoryFromApiNetworkReport(null, {
      scope: 'network-request',
      request: {url: 'https://x', method: 'get'},
    })).not.toThrow();
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, null);
    addHistoryFromApiNetworkReport(historyManager, undefined);
    expect(added).toHaveLength(0);
  });

  it('maps query, cookies, and headers onto the send entry', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'https://example.com/echo?x=1',
        method: 'post',
        protocol: 'http',
        headers: {
          Authorization: 'Bearer secret',
          'X-Trace': 't-1',
          'X-Num': 42,
        },
        query: {branch: 'main', n: 3},
        cookies: {session: 'abc', flag: true},
        body: 'hello',
      },
    });

    expect(added[0]).toMatchObject({
      type: 'send',
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'X-Trace': 't-1',
        'X-Num': '42',
      },
      query: {branch: 'main', n: '3'},
      cookies: {session: 'abc', flag: 'true'},
      content: 'hello',
    });
  });

  it('forces empty content for GET even when a body is present', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'https://example.com/items',
        method: 'GET',
        protocol: 'http',
        body: '{"should":"not-appear"}',
      },
    });
    expect(added[0]).toMatchObject({
      type: 'send',
      method: 'GET',
      content: '',
    });
  });

  it('stringifies non-string bodies and falls back for empty URL', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        method: 'put',
        protocol: 'http',
        body: [1, 2],
      },
    });
    expect(added[0]).toMatchObject({
      type: 'send',
      method: 'PUT',
      title: 'PUT',
      content: JSON.stringify([1, 2]),
    });
  });

  it('uses gRPC service/method as the History method and metadata as headers', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'localhost:50051',
        protocol: 'grpc',
        service: 'demo.Greeter',
        method: 'SayHello',
        metadata: {'x-api-key': 'k'},
        message: {name: 'world'},
      },
    });
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-response',
      request: {
        url: 'localhost:50051',
        protocol: 'grpc',
        service: 'demo.Greeter',
        method: 'SayHello',
      },
      response: {
        status: 0,
        statusText: 'OK',
        body: {reply: 'hi'},
        metadata: {'grpc-status': '0'},
        duration: 5,
      },
    });

    expect(added[0]).toMatchObject({
      type: 'send',
      protocol: 'grpc',
      method: 'demo.Greeter/SayHello',
      title: 'localhost:50051',
      headers: {'x-api-key': 'k'},
      content: JSON.stringify({name: 'world'}),
    });
    expect(added[1]).toMatchObject({
      type: 'recv',
      method: 'demo.Greeter/SayHello',
      headers: {'grpc-status': '0'},
      status: 0,
      content: JSON.stringify({reply: 'hi'}),
    });
  });

  it('records network-error and status < 0 responses as error entries', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-error',
      request: {url: 'https://down.example', method: 'post', protocol: 'http'},
      response: {
        status: -1,
        statusText: 'ECONNREFUSED',
        body: '',
        duration: 3,
      },
    });
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-response',
      request: {url: 'https://down.example', method: 'get', protocol: 'http'},
      response: {
        status: -1,
        errorMessage: 'socket hang up',
        duration: 1,
      },
    });

    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({
      type: 'error',
      method: 'POST',
      status: -1,
      content: 'ECONNREFUSED',
      statusText: 'ECONNREFUSED',
    });
    expect(added[1]).toMatchObject({
      type: 'error',
      method: 'GET',
      status: -1,
      content: 'socket hang up',
      statusText: 'socket hang up',
    });
  });

  it('prefers response body over statusText when both are present', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-response',
      request: {url: 'https://example.com', method: 'post', protocol: 'http'},
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        body: 'boom',
      },
    });
    expect(added[0]).toMatchObject({
      type: 'recv',
      status: 500,
      content: 'boom',
      statusText: 'Internal Server Error',
    });
  });

  it('defaults protocol/method and skips non-object header maps', () => {
    const {added, historyManager} = collect();
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'https://example.com',
        headers: 'not-a-map',
        query: null,
        cookies: ['x'],
        body: '',
      },
    });
    expect(added[0]).toMatchObject({
      type: 'send',
      protocol: 'http',
      method: 'GET',
      title: 'https://example.com',
      content: '',
    });
    expect(added[0].headers).toBeUndefined();
    expect(added[0].query).toBeUndefined();
    expect(added[0].cookies).toBeUndefined();
  });
});
