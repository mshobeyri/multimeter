import {addHistoryFromApiNetworkReport} from './apiHistory';

describe('addHistoryFromApiNetworkReport', () => {
  it('records send then recv from network reporter events', () => {
    const added: any[] = [];
    const historyManager = {
      add: (item: any) => {
        added.push(item);
      },
    } as any;

    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'network-request',
      request: {
        url: 'https://example.com/echo',
        method: 'post',
        protocol: 'http',
        headers: { 'Content-Type': 'application/json' },
        body: { id: 'abc-123' },
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
        body: { ok: true },
        headers: { 'content-type': 'application/json' },
        duration: 12,
      },
    });

    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({
      type: 'send',
      method: 'POST',
      protocol: 'http',
      title: 'https://example.com/echo',
      content: JSON.stringify({ id: 'abc-123' }),
    });
    expect(added[1]).toMatchObject({
      type: 'recv',
      method: 'POST',
      status: 200,
      duration: 12,
      content: JSON.stringify({ ok: true }),
    });
  });

  it('ignores unrelated reporter scopes', () => {
    const added: any[] = [];
    const historyManager = { add: (item: any) => added.push(item) } as any;
    addHistoryFromApiNetworkReport(historyManager, {
      scope: 'test-step',
      title: 'assert',
    });
    expect(added).toHaveLength(0);
  });
});
