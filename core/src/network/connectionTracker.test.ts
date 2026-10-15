import {connectionTracker} from './connectionTracker';

describe('connectionTracker', () => {
  let unsubscribers: Array<() => void>;

  beforeEach(() => {
    unsubscribers = [];
    connectionTracker.clear();
  });

  afterEach(() => {
    for (const unsub of unsubscribers) {
      unsub();
    }
    connectionTracker.clear();
  });

  function subscribe(listener: Parameters<typeof connectionTracker.subscribe>[0]) {
    const unsub = connectionTracker.subscribe(listener);
    unsubscribers.push(unsub);
    return unsub;
  }

  it('generateId returns unique ids', () => {
    const a = connectionTracker.generateId();
    const b = connectionTracker.generateId();
    expect(a).toMatch(/^conn-\d+-\d+$/);
    expect(a).not.toBe(b);
  });

  it('open registers a connecting connection and emits open', () => {
    const events: any[] = [];
    subscribe((event) => {
      events.push(event);
    });

    const conn = connectionTracker.open({
      id: 'c1',
      host: 'example.com:80',
      protocol: 'http',
    });

    expect(conn.state).toBe('connecting');
    expect(conn.requestCount).toBe(0);
    expect(connectionTracker.get('c1')).toBe(conn);
    expect(connectionTracker.getAll()).toEqual([conn]);
    expect(events).toEqual([{type: 'open', connection: conn}]);
  });

  it('connected/idle/closing update state and emit update', () => {
    const events: any[] = [];
    subscribe((event) => {
      events.push(event.type);
    });
    connectionTracker.open({id: 'c1', host: 'h', protocol: 'https'});

    connectionTracker.connected('c1');
    expect(connectionTracker.get('c1')?.state).toBe('open');

    connectionTracker.idle('c1');
    expect(connectionTracker.get('c1')?.state).toBe('idle');

    connectionTracker.closing('c1');
    expect(connectionTracker.get('c1')?.state).toBe('closing');

    expect(events).toEqual(['open', 'update', 'update', 'update']);
  });

  it('connected/idle/closing/activity are no-ops for unknown ids', () => {
    const events: any[] = [];
    subscribe((event) => {
      events.push(event);
    });

    connectionTracker.connected('missing');
    connectionTracker.idle('missing');
    connectionTracker.closing('missing');
    connectionTracker.activity('missing', {incrementRequests: true, bytesReceived: 1, bytesSent: 1});

    expect(events).toEqual([]);
  });

  it('activity increments requests and bytes', () => {
    connectionTracker.open({id: 'c1', host: 'h', protocol: 'ws'});
    connectionTracker.activity('c1');
    expect(connectionTracker.get('c1')).toMatchObject({
      state: 'open',
      requestCount: 0,
    });

    connectionTracker.activity('c1', {
      incrementRequests: true,
      bytesReceived: 4,
      bytesSent: 8,
    });
    connectionTracker.activity('c1', {
      incrementRequests: true,
      bytesReceived: 1,
      bytesSent: 2,
    });

    expect(connectionTracker.get('c1')).toMatchObject({
      requestCount: 2,
      bytesReceived: 5,
      bytesSent: 10,
    });
  });

  it('requestClose invokes handler and close without handler removes tracking', () => {
    const handler = jest.fn();
    connectionTracker.open({id: 'with-handler', host: 'h', protocol: 'wss'});
    connectionTracker.setCloseHandler('with-handler', handler);
    connectionTracker.requestClose('with-handler');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(connectionTracker.get('with-handler')).toBeDefined();

    connectionTracker.open({id: 'no-handler', host: 'h', protocol: 'http'});
    const closes: any[] = [];
    subscribe((event) => {
      if (event.type === 'close') {
        closes.push(event);
      }
    });
    connectionTracker.requestClose('no-handler');
    expect(connectionTracker.get('no-handler')).toBeUndefined();
    expect(closes).toEqual([{type: 'close', id: 'no-handler', closedBy: 'client'}]);
  });

  it('requestClose swallows handler errors', () => {
    connectionTracker.open({id: 'c1', host: 'h', protocol: 'http'});
    connectionTracker.setCloseHandler('c1', () => {
      throw new Error('close failed');
    });
    expect(() => {
      connectionTracker.requestClose('c1');
    }).not.toThrow();
    expect(connectionTracker.get('c1')).toBeDefined();
  });

  it('close is a no-op for unknown ids and removes handlers for known ids', () => {
    const events: any[] = [];
    subscribe((event) => {
      events.push(event);
    });
    connectionTracker.close('missing', 'server');
    expect(events).toEqual([]);

    connectionTracker.open({id: 'c1', host: 'h', protocol: 'http'});
    const handler = jest.fn();
    connectionTracker.setCloseHandler('c1', handler);
    connectionTracker.close('c1', 'timeout');
    expect(connectionTracker.get('c1')).toBeUndefined();
    connectionTracker.requestClose('c1');
    expect(handler).not.toHaveBeenCalled();
  });

  it('findByHost matches protocol and host', () => {
    connectionTracker.open({id: 'http', host: 'a:80', protocol: 'http'});
    connectionTracker.open({id: 'https', host: 'a:80', protocol: 'https'});
    expect(connectionTracker.findByHost('a:80', 'http')?.id).toBe('http');
    expect(connectionTracker.findByHost('a:80', 'https')?.id).toBe('https');
    expect(connectionTracker.findByHost('b:80', 'http')).toBeUndefined();
  });

  it('closeAll requests close for every connection', () => {
    const handler = jest.fn();
    connectionTracker.open({id: 'a', host: 'h', protocol: 'http'});
    connectionTracker.open({id: 'b', host: 'h', protocol: 'http'});
    connectionTracker.setCloseHandler('a', handler);
    connectionTracker.closeAll();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(connectionTracker.get('a')).toBeDefined();
    expect(connectionTracker.get('b')).toBeUndefined();
  });

  it('subscribe can unsubscribe and emit ignores listener errors', () => {
    const good = jest.fn();
    const unsub = subscribe(() => {
      throw new Error('listener failed');
    });
    subscribe(good);

    connectionTracker.open({id: 'c1', host: 'h', protocol: 'ws'});
    expect(good).toHaveBeenCalledTimes(1);

    unsub();
    connectionTracker.connected('c1');
    expect(good).toHaveBeenCalledTimes(2);
  });

  it('clear resets connections and id counter', () => {
    connectionTracker.open({id: 'c1', host: 'h', protocol: 'http'});
    connectionTracker.generateId();
    connectionTracker.clear();
    expect(connectionTracker.getAll()).toEqual([]);
    expect(connectionTracker.generateId()).toMatch(/^conn-1-/);
  });
});
