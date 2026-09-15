import {EventEmitter} from 'events';

import {DEFAULT_NETWORK_CONFIG, NetworkConfig} from './NetworkData';

jest.mock('@grpc/grpc-js', () => {
  const {EventEmitter: EE} = require('events');

  const connectivityState = {
    IDLE: 0,
    CONNECTING: 1,
    READY: 2,
    TRANSIENT_FAILURE: 3,
    SHUTDOWN: 4,
  };

  class Metadata {
    _map: Record<string, any> = {};
    set(key: string, value: any) {
      this._map[key] = value;
    }
    getMap() {
      return this._map;
    }
  }

  const state: any = {
    channels: [] as any[],
    grpcObject: null as any,
    reflection: {
      v1: 'success' as string,
      v1alpha: 'success' as string,
    },
    handlers: null as any,
    channelTarget: undefined as string | null | undefined,
  };

  function defaultHandlers() {
    function SayHello(this: any, _message: any, _metadata: any, callback: Function) {
      callback(null, {hello: 'world'});
    }
    const trailing = new Metadata();
    trailing.set('x-trail', 'ok');
    (SayHello as any).__lastMetadata = trailing;

    function ListItems(this: any, _message: any, _metadata: any) {
      const call = new EE();
      (call as any).write = jest.fn();
      (call as any).end = jest.fn();
      process.nextTick(() => {
        call.emit('data', {n: 1});
        call.emit('data', {n: 2});
        const statusMeta = new Metadata();
        statusMeta.set('x-server', 'trail');
        call.emit('status', {metadata: statusMeta});
        call.emit('end');
      });
      return call;
    }

    function Upload(this: any, _metadata: any, callback: Function) {
      const call = new EE();
      const written: any[] = [];
      (call as any).write = jest.fn((msg: any) => {
        written.push(msg);
      });
      (call as any).end = jest.fn(() => {
        callback(null, {count: written.length, written});
      });
      return call;
    }

    function Chat(this: any, _metadata: any) {
      const call = new EE();
      const written: any[] = [];
      (call as any).write = jest.fn((msg: any) => {
        written.push(msg);
      });
      (call as any).end = jest.fn(() => {
        call.emit('data', {echo: written});
        const statusMeta = new Metadata();
        statusMeta.set('x-bidi', 'done');
        call.emit('status', {metadata: statusMeta});
        call.emit('end');
      });
      return call;
    }

    return {SayHello, ListItems, Upload, Chat};
  }

  function makeServiceClient() {
    function ServiceClient(this: any, addr: string, creds: any) {
      this.addr = addr;
      this.creds = creds;
      Object.assign(this, state.handlers || defaultHandlers());
    }
    ServiceClient.service = {mock: true};
    return ServiceClient;
  }

  function reflectionStream(version: 'v1' | 'v1alpha') {
    const stream = new EE();
    (stream as any).end = jest.fn();
    (stream as any).write = jest.fn(() => {
      const mode = state.reflection[version];
      if (mode === 'missing-service') {
        return;
      }
      if (mode === 'error') {
        stream.emit('error', new Error(`${version} reflection failed`));
        return;
      }
      if (mode === 'end') {
        stream.emit('end');
        return;
      }
      if (mode === 'error_response') {
        stream.emit('data', {
          error_response: {error_message: `${version} reflection error`},
        });
        return;
      }
      if (mode === 'error_response_empty') {
        stream.emit('data', {error_response: {}});
        return;
      }
      if (mode === 'empty-descriptor') {
        stream.emit('data', {
          file_descriptor_response: {file_descriptor_proto: [null]},
        });
        return;
      }
      if (mode === 'success') {
        stream.emit('data', {
          file_descriptor_response: {
            file_descriptor_proto: [Buffer.from('fake-descriptor')],
          },
        });
        stream.emit('data', {ignored: true});
        stream.emit('error', new Error('late error'));
        stream.emit('end');
        return;
      }
      stream.emit('error', new Error(`unknown reflection mode ${mode}`));
    });
    return stream;
  }

  function makeReflectionClient(version: 'v1' | 'v1alpha') {
    return function ReflectionClient(this: any) {
      this.ServerReflectionInfo = () => reflectionStream(version);
    };
  }

  class Channel {
    target: string;
    credentials: any;
    options: any;
    _state: number;
    close: jest.Mock;
    getConnectivityState: jest.Mock;
    getTarget?: jest.Mock;
    constructor(target: string, credentials: any, options: any) {
      this.target = target;
      this.credentials = credentials;
      this.options = options;
      this._state = connectivityState.READY;
      this.close = jest.fn(() => {
        this._state = connectivityState.SHUTDOWN;
      });
      this.getConnectivityState = jest.fn((tryToConnect?: boolean) => {
        void tryToConnect;
        return this._state;
      });
      if (state.channelTarget !== null) {
        this.getTarget = jest.fn(() =>
          state.channelTarget === undefined ? this.target : state.channelTarget);
      }
      state.channels.push(this);
    }
  }

  const grpc = {
    connectivityState,
    Metadata,
    Channel,
    credentials: {
      createInsecure: jest.fn(() => ({type: 'insecure'})),
      createFromSecureContext: jest.fn((ctx: any) => ({type: 'ssl', ctx})),
    },
    loadPackageDefinition: jest.fn((pkgDef: any) => {
      if (pkgDef && pkgDef.__kind === 'reflection-v1') {
        if (state.reflection.v1 === 'missing-service') {
          return {};
        }
        return {
          grpc: {
            reflection: {
              v1: {ServerReflection: makeReflectionClient('v1')},
            },
          },
        };
      }
      if (pkgDef && pkgDef.__kind === 'reflection-v1alpha') {
        if (state.reflection.v1alpha === 'missing-service') {
          return {grpc: {reflection: {v1alpha: undefined}}};
        }
        return {
          grpc: {
            reflection: {
              v1alpha: {ServerReflection: makeReflectionClient('v1alpha')},
            },
          },
        };
      }
      if (state.grpcObject) {
        return state.grpcObject;
      }
      return {pkg: {Greeter: makeServiceClient()}};
    }),
    __state: state,
    __reset() {
      state.channels = [];
      state.grpcObject = null;
      state.handlers = null;
      state.channelTarget = undefined;
      state.reflection = {v1: 'success', v1alpha: 'success'};
      grpc.credentials.createInsecure.mockClear();
      grpc.credentials.createFromSecureContext.mockClear();
      grpc.loadPackageDefinition.mockClear();
    },
    __makeServiceClient: makeServiceClient,
    __Metadata: Metadata,
  };

  return grpc;
});

jest.mock('@grpc/proto-loader', () => {
  const state = {
    lastLoadPath: '',
    lastLoadSyncPath: '',
  };
  return {
    __state: state,
    load: jest.fn(async (protoPath: string) => {
      state.lastLoadPath = protoPath;
      return {__kind: 'user', path: protoPath};
    }),
    loadSync: jest.fn((protoPath: string) => {
      state.lastLoadSyncPath = protoPath;
      if (String(protoPath).includes('v1alpha')) {
        return {__kind: 'reflection-v1alpha'};
      }
      return {__kind: 'reflection-v1'};
    }),
  };
});

jest.mock('protobufjs', () => {
  const state = {
    service: {name: 'pkg.Greeter'} as any,
  };
  return {
    __state: state,
    Root: {
      fromDescriptor: jest.fn(() => ({
        lookupService: () => state.service,
      })),
    },
  };
});

jest.mock('tls', () => {
  const actual = jest.requireActual('tls');
  return {
    ...actual,
    createSecureContext: jest.fn((opts: any) => ({mockSecureContext: true, opts})),
  };
});

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as tls from 'tls';

import {
  closeAllGrpcChannels,
  grpcStatusName,
  grpcStatusToHttp,
  sendGrpcRequest,
} from './grpcCore';

const grpcMock = grpc as any;
const protoLoaderMock = protoLoader as any;

const fileLoader = async () => '';

function config(overrides: Partial<NetworkConfig> = {}): NetworkConfig {
  return {
    ...DEFAULT_NETWORK_CONFIG,
    ...overrides,
    ca: {...DEFAULT_NETWORK_CONFIG.ca, ...(overrides.ca || {})},
    clients: overrides.clients || [],
  };
}

function unaryReq(overrides: Record<string, any> = {}) {
  return {
    url: 'grpc://example.test:50051',
    proto: '/abs/greeter.proto',
    service: 'pkg.Greeter',
    method: 'SayHello',
    message: {name: 'ada'},
    ...overrides,
  };
}

describe('grpcCore status mapping', () => {
  test('maps known codes and defaults unknown', () => {
    expect(grpcStatusToHttp(0)).toBe(200);
    expect(grpcStatusToHttp(5)).toBe(404);
    expect(grpcStatusToHttp(16)).toBe(401);
    expect(grpcStatusToHttp(99)).toBe(500);
    expect(grpcStatusName(0)).toBe('OK');
    expect(grpcStatusName(14)).toBe('UNAVAILABLE');
    expect(grpcStatusName(99)).toBe('UNKNOWN');
  });

  test('closeAllGrpcChannels is safe with an empty pool', () => {
    expect(() => closeAllGrpcChannels()).not.toThrow();
    closeAllGrpcChannels();
  });
});

describe('sendGrpcRequest', () => {
  const createSecureContextMock = tls.createSecureContext as jest.Mock;

  beforeEach(() => {
    closeAllGrpcChannels();
    grpcMock.__reset();
    protoLoaderMock.load.mockClear();
    protoLoaderMock.loadSync.mockClear();
    createSecureContextMock.mockClear();
    createSecureContextMock.mockImplementation((opts: any) => ({
      mockSecureContext: true,
      opts,
    }));
  });

  afterEach(() => {
    closeAllGrpcChannels();
  });

  test('unary success with proto file, metadata, and trailing metadata', async () => {
    const res = await sendGrpcRequest(
        unaryReq({
          metadata: {authorization: 'Bearer t'},
        }),
        config(),
        fileLoader,
        '/work',
    );

    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(JSON.parse(res.body)).toEqual({hello: 'world'});
    expect(res.metadata['x-trail']).toBe('ok');
    expect(res.duration).toBeGreaterThanOrEqual(0);
    expect(protoLoaderMock.load).toHaveBeenCalledWith(
        '/abs/greeter.proto',
        expect.objectContaining({keepCase: true}),
    );
    expect(grpcMock.credentials.createInsecure).toHaveBeenCalled();
  });

  test('loads a relative proto path against basePath', async () => {
    await sendGrpcRequest(
        unaryReq({proto: 'greeter.proto'}),
        config(),
        fileLoader,
        '/work',
    );
    expect(protoLoaderMock.__state.lastLoadPath).toBe('/work/greeter.proto');
  });

  test('unary error maps gRPC status, details, and binary metadata', async () => {
    const errMeta = new grpcMock.Metadata();
    errMeta.set('x-bin', Buffer.from('abc'));
    errMeta.set('x-str', 'plain');
    grpcMock.__state.handlers = {
      SayHello(_message: any, _metadata: any, callback: Function) {
        callback({
          code: 5,
          details: 'missing',
          message: 'not found',
          metadata: errMeta,
        });
      },
    };

    const res = await sendGrpcRequest(unaryReq(), config(), fileLoader);
    expect(res.status).toBe(404);
    expect(res.statusText).toBe('NOT_FOUND: missing');
    expect(JSON.parse(res.body)).toBe('missing');
    expect(res.metadata['x-str']).toBe('plain');
    expect(res.metadata['x-bin']).toBe(Buffer.from('abc').toString('base64'));
  });

  test('unary error without code or details falls back to UNKNOWN', async () => {
    grpcMock.__state.handlers = {
      SayHello(_message: any, _metadata: any, callback: Function) {
        callback({message: 'boom'});
      },
    };

    const res = await sendGrpcRequest(unaryReq({message: undefined}), config(), fileLoader);
    expect(res.status).toBe(500);
    expect(res.statusText).toBe('UNKNOWN');
    expect(JSON.parse(res.body)).toBe('boom');
  });

  test('server stream success collects messages and trailing metadata', async () => {
    const res = await sendGrpcRequest(
        unaryReq({method: 'ListItems', stream: 'server'}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual([{n: 1}, {n: 2}]);
    expect(res.metadata['x-server']).toBe('trail');
  });

  test('server stream error includes details and partial messages', async () => {
    grpcMock.__state.handlers = {
      ListItems() {
        const call = new EventEmitter();
        process.nextTick(() => {
          call.emit('data', {n: 1});
          call.emit('error', {code: 14, details: 'down', metadata: undefined});
        });
        return call;
      },
    };

    const res = await sendGrpcRequest(
        unaryReq({method: 'ListItems', stream: 'server', message: undefined}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(503);
    expect(res.statusText).toBe('UNAVAILABLE: down');
    expect(JSON.parse(res.body)).toEqual([{n: 1}]);
    expect(res.metadata).toEqual({});
  });

  test('server stream status without metadata still ends OK', async () => {
    grpcMock.__state.handlers = {
      ListItems() {
        const call = new EventEmitter();
        process.nextTick(() => {
          call.emit('status', {});
          call.emit('end');
        });
        return call;
      },
    };

    const res = await sendGrpcRequest(
        unaryReq({method: 'ListItems', stream: 'server'}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  test('client stream success writes an array of messages', async () => {
    const res = await sendGrpcRequest(
        unaryReq({
          method: 'Upload',
          stream: 'client',
          message: [{a: 1}, {a: 2}],
        }),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).count).toBe(2);
  });

  test('client stream wraps a single message and maps errors without details suffix', async () => {
    grpcMock.__state.handlers = {
      Upload(_metadata: any, callback: Function) {
        const call = new EventEmitter();
        (call as any).write = jest.fn();
        (call as any).end = jest.fn(() => {
          callback({code: 8, details: 'full', message: 'exhausted'});
        });
        return call;
      },
    };

    const res = await sendGrpcRequest(
        unaryReq({method: 'Upload', stream: 'client', message: {one: true}}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(429);
    expect(res.statusText).toBe('RESOURCE_EXHAUSTED');
    expect(JSON.parse(res.body)).toBe('full');
  });

  test('client stream error without code uses UNKNOWN and empty message object', async () => {
    grpcMock.__state.handlers = {
      Upload(_metadata: any, callback: Function) {
        const call = new EventEmitter();
        (call as any).write = jest.fn();
        (call as any).end = jest.fn(() => {
          callback({message: 'nope'});
        });
        return call;
      },
    };

    const res = await sendGrpcRequest(
        unaryReq({method: 'Upload', stream: 'client', message: undefined}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(500);
    expect(res.statusText).toBe('UNKNOWN');
  });

  test('bidi stream success writes messages and collects responses', async () => {
    const res = await sendGrpcRequest(
        unaryReq({
          method: 'Chat',
          stream: 'bidi',
          message: [{q: 1}, {q: 2}],
        }),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)[0].echo).toEqual([{q: 1}, {q: 2}]);
    expect(res.metadata['x-bidi']).toBe('done');
  });

  test('bidi stream error and missing status metadata', async () => {
    grpcMock.__state.handlers = {
      Chat() {
        const call = new EventEmitter();
        (call as any).write = jest.fn();
        (call as any).end = jest.fn(() => {
          call.emit('data', {partial: true});
          call.emit('status', {});
          call.emit('error', {code: 4, message: 'timeout'});
        });
        return call;
      },
    };

    const res = await sendGrpcRequest(
        unaryReq({method: 'Chat', stream: 'bidi', message: undefined}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(504);
    expect(res.statusText).toBe('DEADLINE_EXCEEDED');
    expect(JSON.parse(res.body)).toEqual([{partial: true}]);
  });

  test('throws for missing service, missing method, and unsupported stream type', async () => {
    await expect(sendGrpcRequest(
        unaryReq({service: 'pkg.Missing'}),
        config(),
        fileLoader,
    )).rejects.toThrow('Service "pkg.Missing" not found in proto definition');

    grpcMock.__state.grpcObject = {pkg: {NotAClient: {service: {}}}};
    await expect(sendGrpcRequest(
        unaryReq({service: 'pkg.NotAClient'}),
        config(),
        fileLoader,
    )).rejects.toThrow('Service "pkg.NotAClient" not found');

    grpcMock.__state.grpcObject = null;
    await expect(sendGrpcRequest(
        unaryReq({method: 'DoesNotExist'}),
        config(),
        fileLoader,
    )).rejects.toThrow('Method "DoesNotExist" not found in service "pkg.Greeter"');

    await expect(sendGrpcRequest(
        unaryReq({stream: 'duplex' as any}),
        config(),
        fileLoader,
    )).rejects.toThrow('Unsupported gRPC stream type: duplex');
  });

  test('uses server reflection when proto is reflect and caches the definition', async () => {
    const req = unaryReq({proto: 'reflect'});
    const first = await sendGrpcRequest(req, config(), fileLoader);
    expect(first.status).toBe(200);
    expect(protoLoaderMock.loadSync).toHaveBeenCalled();

    protoLoaderMock.loadSync.mockClear();
    const second = await sendGrpcRequest(req, config(), fileLoader);
    expect(second.status).toBe(200);
    expect(protoLoaderMock.loadSync).not.toHaveBeenCalled();
  });

  test('falls back from v1 reflection to v1alpha', async () => {
    closeAllGrpcChannels();
    grpcMock.__state.reflection.v1 = 'error';
    grpcMock.__state.reflection.v1alpha = 'success';

    const res = await sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://alpha.test:50051'}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
  });

  test('throws when both reflection versions fail', async () => {
    grpcMock.__state.reflection.v1 = 'error';
    grpcMock.__state.reflection.v1alpha = 'end';

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://none.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('Server reflection not available');
  });

  test('throws when v1alpha reflection returns an error_response', async () => {
    grpcMock.__state.reflection.v1 = 'error';
    grpcMock.__state.reflection.v1alpha = 'error_response';

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://err.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('v1alpha reflection error');
  });

  test('throws when the reflection service is missing from the proto', async () => {
    grpcMock.__state.reflection.v1 = 'missing-service';
    grpcMock.__state.reflection.v1alpha = 'missing-service';

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://missing.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('not found in proto');
  });

  test('throws when reflection returns an empty descriptor', async () => {
    grpcMock.__state.reflection.v1 = 'empty-descriptor';

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://empty.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('not found via server reflection');
  });

  test('throws when protobufjs cannot look up the reflected service', async () => {
    const protobuf = require('protobufjs');
    protobuf.__state.service = null;

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://lookup.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('not found via server reflection');

    protobuf.__state.service = {name: 'pkg.Greeter'};
  });

  test('grpcs URL uses TLS credentials, default port 443, CA list, and PFX client cert', async () => {
    const res = await sendGrpcRequest(
        unaryReq({
          url: 'grpcs://secure.test',
          metadata: {k: 'v'},
        }),
        config({
          ca: {enabled: true, certData: [Buffer.from('ca1'), Buffer.from('ca2')]},
          clients: [{
            id: 'c1',
            name: 'client',
            host: 'secure.test',
            enabled: true,
            pfxData: Buffer.from('pfx'),
            passphrase_plain: 'secret',
          }],
        }),
        fileLoader,
    );

    expect(res.status).toBe(200);
    expect(createSecureContextMock).toHaveBeenCalled();
    const opts = createSecureContextMock.mock.calls[0][0];
    expect(Array.isArray(opts.ca)).toBe(true);
    expect(opts.pfx).toEqual(Buffer.from('pfx'));
    expect(opts.passphrase).toBe('secret');
    expect(grpcMock.credentials.createFromSecureContext).toHaveBeenCalled();
    expect(grpcMock.__state.channels[0].target).toBe('secure.test:443');
  });

  test('grpcs wraps a single CA cert and uses PEM client cert/key', async () => {
    await sendGrpcRequest(
        unaryReq({url: 'grpcs://pem.test:8443'}),
        config({
          ca: {enabled: true, certData: Buffer.from('ca')},
          clients: [{
            id: 'c2',
            name: 'pem',
            host: 'pem.test:8443',
            enabled: true,
            certData: Buffer.from('cert'),
            keyData: Buffer.from('key'),
          }],
        }),
        fileLoader,
    );

    const opts = createSecureContextMock.mock.calls[0][0];
    expect(opts.ca).toEqual([Buffer.from('ca')]);
    expect(opts.cert).toEqual(Buffer.from('cert'));
    expect(opts.key).toEqual(Buffer.from('key'));
  });

  test('reuses a live channel and recreates one after shutdown; closeAllGrpcChannels closes the pool', async () => {
    await sendGrpcRequest(unaryReq({url: 'grpc://pool.test:50051'}), config(), fileLoader);
    expect(grpcMock.__state.channels).toHaveLength(1);

    await sendGrpcRequest(unaryReq({url: 'grpc://pool.test:50051'}), config(), fileLoader);
    expect(grpcMock.__state.channels).toHaveLength(1);

    grpcMock.__state.channels[0]._state = grpcMock.connectivityState.SHUTDOWN;
    await sendGrpcRequest(unaryReq({url: 'grpc://pool.test:50051'}), config(), fileLoader);
    expect(grpcMock.__state.channels).toHaveLength(2);

    const last = grpcMock.__state.channels[1];
    closeAllGrpcChannels();
    expect(last.close).toHaveBeenCalled();

    await sendGrpcRequest(unaryReq({url: 'grpc://pool.test:50051'}), config(), fileLoader);
    expect(grpcMock.__state.channels).toHaveLength(3);
  });

  test('defaults grpc host and port when the URL is incomplete', async () => {
    await sendGrpcRequest(unaryReq({url: 'grpc://'}), config(), fileLoader);
    expect(grpcMock.__state.channels[0].target).toBe('localhost:50051');
  });

  test('treats empty proto as reflect and parses a channel with no getTarget', async () => {
    grpcMock.__state.channelTarget = null;
    const res = await sendGrpcRequest(
        unaryReq({proto: '', url: 'grpc://notarget.test:50051'}),
        config(),
        fileLoader,
    );
    expect(res.status).toBe(200);
  });

  test('unary success without last metadata uses an empty map', async () => {
    grpcMock.__state.handlers = {
      SayHello(_message: any, _metadata: any, callback: Function) {
        callback(null, {ok: true});
      },
    };
    const res = await sendGrpcRequest(unaryReq(), config(), fileLoader);
    expect(res.status).toBe(200);
    expect(res.metadata).toEqual({});
  });

  test('rejects a constructor that is not a service client', async () => {
    function Bare() {}
    grpcMock.__state.grpcObject = {pkg: {Greeter: Bare}};
    await expect(sendGrpcRequest(unaryReq(), config(), fileLoader))
        .rejects.toThrow('Service "pkg.Greeter" not found');
  });

  test('grpcs without matching pfx or PEM still builds SSL credentials', async () => {
    await sendGrpcRequest(
        unaryReq({url: 'grpcs://plain.test:443'}),
        config({
          ca: {enabled: true},
          clients: [{
            id: 'c3',
            name: 'empty',
            host: 'plain.test',
            enabled: true,
          }],
        }),
        fileLoader,
    );
    expect(createSecureContextMock).toHaveBeenCalled();
    const opts = createSecureContextMock.mock.calls[0][0];
    expect(opts.pfx).toBeUndefined();
    expect(opts.cert).toBeUndefined();
  });

  test('reflection error_response without a message uses a fallback', async () => {
    grpcMock.__state.reflection.v1 = 'error';
    grpcMock.__state.reflection.v1alpha = 'error_response_empty';

    await expect(sendGrpcRequest(
        unaryReq({proto: 'reflect', url: 'grpc://fallback.test:50051'}),
        config(),
        fileLoader,
    )).rejects.toThrow('Reflection error');
  });
});
