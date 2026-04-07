import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

import {GrpcRequest, GrpcResponse, NetworkConfig} from './NetworkData';

// gRPC status code → HTTP status code mapping
const GRPC_TO_HTTP_STATUS: Record<number, number> = {
  0: 200,   // OK
  1: 499,   // CANCELLED
  2: 500,   // UNKNOWN
  3: 400,   // INVALID_ARGUMENT
  4: 504,   // DEADLINE_EXCEEDED
  5: 404,   // NOT_FOUND
  6: 409,   // ALREADY_EXISTS
  7: 403,   // PERMISSION_DENIED
  8: 429,   // RESOURCE_EXHAUSTED
  9: 400,   // FAILED_PRECONDITION
  10: 409,  // ABORTED
  11: 400,  // OUT_OF_RANGE
  12: 501,  // UNIMPLEMENTED
  13: 500,  // INTERNAL
  14: 503,  // UNAVAILABLE
  15: 500,  // DATA_LOSS
  16: 401,  // UNAUTHENTICATED
};

const GRPC_STATUS_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
};

export function grpcStatusToHttp(grpcCode: number): number {
  return GRPC_TO_HTTP_STATUS[grpcCode] ?? 500;
}

export function grpcStatusName(grpcCode: number): string {
  return GRPC_STATUS_NAMES[grpcCode] ?? 'UNKNOWN';
}

// Channel pool keyed by host:port:tls
const channelPool: Map<string, grpc.Channel> = new Map();

// Reflection definition cache keyed by host:port:service
const reflectionCache: Map<string, protoLoader.PackageDefinition> = new Map();

function parseGrpcUrl(url: string): { host: string; port: number; tls: boolean } {
  // grpc://host:port or grpcs://host:port
  const normalized = url.replace(/^grpcs?:\/\//, '');
  const tls = url.startsWith('grpcs://');
  const [hostPart, portStr] = normalized.split(':');
  const host = hostPart || 'localhost';
  const port = portStr ? parseInt(portStr, 10) : (tls ? 443 : 50051);
  return { host, port, tls };
}

function getOrCreateChannel(
  url: string,
  config: NetworkConfig,
  metadata?: grpc.Metadata,
): grpc.Channel {
  const { host, port, tls } = parseGrpcUrl(url);
  const key = `${host}:${port}:${tls}`;

  const existing = channelPool.get(key);
  if (existing) {
    const state = existing.getConnectivityState(false);
    if (state !== grpc.connectivityState.SHUTDOWN) {
      return existing;
    }
    channelPool.delete(key);
  }

  let credentials: grpc.ChannelCredentials;
  if (tls) {
    // Build SSL credentials from NetworkConfig
    const rootCerts = config.ca?.enabled && config.ca.certData
      ? (Array.isArray(config.ca.certData) ? Buffer.concat(config.ca.certData) : config.ca.certData)
      : null;

    // Find matching client cert for mTLS
    const hostname = host;
    const clientCert = config.clients?.find(
      c => c.enabled && (c.host === hostname || hostname.includes(c.host) || c.host === '*')
    );

    if (clientCert?.certData && clientCert?.keyData) {
      credentials = grpc.credentials.createSsl(
        rootCerts,
        clientCert.keyData,
        clientCert.certData,
      );
    } else {
      credentials = grpc.credentials.createSsl(rootCerts);
    }
  } else {
    credentials = grpc.credentials.createInsecure();
  }

  const channel = new grpc.Channel(`${host}:${port}`, credentials, {
    'grpc.max_receive_message_length': 50 * 1024 * 1024,
    'grpc.max_send_message_length': 50 * 1024 * 1024,
  });
  channelPool.set(key, channel);
  return channel;
}

/**
 * Reflect a service definition from a gRPC server using server reflection.
 * Tries grpc.reflection.v1 first, falls back to grpc.reflection.v1alpha.
 */
async function reflectServiceDefinition(
  channel: grpc.Channel,
  serviceName: string,
): Promise<grpc.GrpcObject> {
  const { host, port } = parseChannelTarget(channel);
  const cacheKey = `${host}:${port}:${serviceName}`;
  const cached = reflectionCache.get(cacheKey);
  if (cached) {
    return grpc.loadPackageDefinition(cached);
  }

  // Load the reflection proto
  const reflectionProtoPath = require.resolve('@grpc/proto-loader/build/src/../../protos/grpc/reflection/v1/reflection.proto');
  const reflectionAlphaProtoPath = require.resolve('@grpc/proto-loader/build/src/../../protos/grpc/reflection/v1alpha/reflection.proto');

  let descriptorBytes: Buffer | null = null;

  // Try v1 first
  try {
    descriptorBytes = await callReflection(channel, reflectionProtoPath, 'grpc.reflection.v1.ServerReflection', serviceName);
  } catch {
    // Fall back to v1alpha
    try {
      descriptorBytes = await callReflection(channel, reflectionAlphaProtoPath, 'grpc.reflection.v1alpha.ServerReflection', serviceName);
    } catch (e: any) {
      throw new Error(
        `Server reflection not available at ${host}:${port} — set "grpc.proto" to a .proto file path instead. (${e?.message || e})`
      );
    }
  }

  if (!descriptorBytes) {
    throw new Error(`Service "${serviceName}" not found via server reflection`);
  }

  // Decode the FileDescriptorProto(s) and build a package definition
  const root = await protoLoader.load('', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // For now, use a simpler approach: decode the proto descriptor bytes and use them
  // to build a serviceDef
  // Actually, proto-loader doesn't directly accept descriptor bytes.
  // We need to use protobufjs directly to decode them.

  // Alternative approach: use grpc-js reflection client built-in (not available yet)
  // For now, create a dynamic proto loading from the descriptor

  const protobuf = require('protobufjs');
  const descriptorRoot = protobuf.Root.fromDescriptor(descriptorBytes);
  const service = descriptorRoot.lookupService(serviceName);
  if (!service) {
    throw new Error(`Service "${serviceName}" not found via server reflection`);
  }

  // Build grpc service definition from protobufjs service
  const pkgDef = buildPackageDefinitionFromService(service, descriptorRoot);
  reflectionCache.set(cacheKey, pkgDef);
  return grpc.loadPackageDefinition(pkgDef);
}

function parseChannelTarget(channel: grpc.Channel): { host: string; port: number } {
  const target = (channel as any).getTarget?.() || '';
  const parts = target.split(':');
  return {
    host: parts[0] || 'localhost',
    port: parseInt(parts[1], 10) || 50051,
  };
}

async function callReflection(
  channel: grpc.Channel,
  protoPath: string,
  reflectionServiceName: string,
  targetServiceName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pkgDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const grpcObj = grpc.loadPackageDefinition(pkgDef);

    // Navigate to the reflection service
    const parts = reflectionServiceName.split('.');
    let current: any = grpcObj;
    for (const part of parts) {
      current = current?.[part];
    }

    if (!current) {
      reject(new Error(`Reflection service ${reflectionServiceName} not found in proto`));
      return;
    }

    const target = parseChannelTarget(channel);
    const client = new current(`${target.host}:${target.port}`, grpc.credentials.createInsecure());

    const stream = client.ServerReflectionInfo();
    let resolved = false;

    stream.on('data', (response: any) => {
      if (resolved) { return; }
      if (response.error_response) {
        resolved = true;
        stream.end();
        reject(new Error(response.error_response.error_message || 'Reflection error'));
        return;
      }
      if (response.file_descriptor_response?.file_descriptor_proto?.length) {
        resolved = true;
        stream.end();
        resolve(response.file_descriptor_response.file_descriptor_proto[0]);
        return;
      }
    });

    stream.on('error', (err: any) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    stream.on('end', () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Reflection stream ended without response'));
      }
    });

    stream.write({
      file_containing_symbol: targetServiceName,
    });
  });
}

function buildPackageDefinitionFromService(
  _service: any,
  _root: any,
): protoLoader.PackageDefinition {
  // Placeholder: this is complex to implement fully.
  // For production we'd decode the FileDescriptorSet and build proper definitions.
  // For now, return empty — will be fleshed out when testing with real servers.
  return {} as any;
}

/**
 * Load a service definition from a .proto file.
 */
async function loadProtoFromFile(
  protoPath: string,
  basePath?: string,
): Promise<protoLoader.PackageDefinition> {
  // Resolve relative paths against the base directory (usually the .mmt file's directory)
  const resolvedPath = path.isAbsolute(protoPath) ? protoPath : path.resolve(basePath || '.', protoPath);
  return protoLoader.load(resolvedPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
}

function findServiceClient(
  grpcObj: grpc.GrpcObject,
  serviceName: string,
): grpc.ServiceClientConstructor | undefined {
  // Service name may be fully qualified (e.g. "mypackage.UserService")
  const parts = serviceName.split('.');
  let current: any = grpcObj;
  for (const part of parts) {
    current = current?.[part];
    if (!current) { return undefined; }
  }
  if (typeof current === 'function' && current.service) {
    return current as grpc.ServiceClientConstructor;
  }
  return undefined;
}

/**
 * Send a gRPC request. Uses proto file or server reflection to build the client.
 */
export async function sendGrpcRequest(
  req: GrpcRequest,
  config: NetworkConfig,
  fileLoader: (path: string) => Promise<string>,
  basePath?: string,
): Promise<GrpcResponse> {
  const start = Date.now();
  const { host, port, tls } = parseGrpcUrl(req.url);
  const channel = getOrCreateChannel(req.url, config);

  let grpcObj: grpc.GrpcObject;

  const protoSource = req.proto || 'reflect';
  if (protoSource === 'reflect') {
    grpcObj = await reflectServiceDefinition(channel, req.service);
  } else {
    const pkgDef = await loadProtoFromFile(protoSource, basePath);
    grpcObj = grpc.loadPackageDefinition(pkgDef);
  }

  const ServiceClient = findServiceClient(grpcObj, req.service);
  if (!ServiceClient) {
    throw new Error(`Service "${req.service}" not found in proto definition`);
  }

  // Build credentials matching what getOrCreateChannel uses
  let credentials: grpc.ChannelCredentials;
  if (tls) {
    const rootCerts = config.ca?.enabled && config.ca.certData
      ? (Array.isArray(config.ca.certData) ? Buffer.concat(config.ca.certData) : config.ca.certData)
      : null;
    const clientCert = config.clients?.find(
      (c: any) => c.enabled && (c.host === host || host.includes(c.host) || c.host === '*')
    );
    if (clientCert?.certData && clientCert?.keyData) {
      credentials = grpc.credentials.createSsl(rootCerts, clientCert.keyData, clientCert.certData);
    } else {
      credentials = grpc.credentials.createSsl(rootCerts);
    }
  } else {
    credentials = grpc.credentials.createInsecure();
  }
  const client = new ServiceClient(`${host}:${port}`, credentials);

  // Build metadata from headers + auth
  const metadata = new grpc.Metadata();
  if (req.metadata) {
    for (const [key, value] of Object.entries(req.metadata)) {
      metadata.set(key, value);
    }
  }

  // Check if method exists on the client
  const methodName = req.method;
  const clientMethod = (client as any)[methodName];
  if (typeof clientMethod !== 'function') {
    throw new Error(`Method "${methodName}" not found in service "${req.service}"`);
  }

  // Execute based on streaming mode
  if (!req.stream) {
    // Unary call
    return new Promise<GrpcResponse>((resolve) => {
      clientMethod.call(client, req.message || {}, metadata, (err: grpc.ServiceError | null, response: any) => {
        const duration = Date.now() - start;
        if (err) {
          const grpcCode = err.code ?? 2;
          resolve({
            body: JSON.stringify(err.details || err.message || ''),
            metadata: extractMetadata(err.metadata),
            status: grpcStatusToHttp(grpcCode),
            statusText: grpcStatusName(grpcCode) + (err.details ? `: ${err.details}` : ''),
            duration,
          });
          return;
        }
        resolve({
          body: JSON.stringify(response),
          metadata: extractMetadata((clientMethod as any).__lastMetadata || new grpc.Metadata()),
          status: 200,
          statusText: 'OK',
          duration,
        });
      });
    });
  }

  if (req.stream === 'server') {
    // Server streaming
    return new Promise<GrpcResponse>((resolve) => {
      const messages: any[] = [];
      const call = clientMethod.call(client, req.message || {}, metadata);
      let trailingMeta = new grpc.Metadata();

      call.on('data', (msg: any) => {
        messages.push(msg);
      });

      call.on('status', (status: grpc.StatusObject) => {
        trailingMeta = status.metadata || trailingMeta;
      });

      call.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          body: JSON.stringify(messages),
          metadata: extractMetadata(trailingMeta),
          status: 200,
          statusText: 'OK',
          duration,
        });
      });

      call.on('error', (err: grpc.ServiceError) => {
        const duration = Date.now() - start;
        const grpcCode = err.code ?? 2;
        resolve({
          body: JSON.stringify(messages),
          metadata: extractMetadata(err.metadata),
          status: grpcStatusToHttp(grpcCode),
          statusText: grpcStatusName(grpcCode) + (err.details ? `: ${err.details}` : ''),
          duration,
        });
      });
    });
  }

  if (req.stream === 'client') {
    // Client streaming
    return new Promise<GrpcResponse>((resolve) => {
      const call = clientMethod.call(client, metadata, (err: grpc.ServiceError | null, response: any) => {
        const duration = Date.now() - start;
        if (err) {
          const grpcCode = err.code ?? 2;
          resolve({
            body: JSON.stringify(err.details || err.message || ''),
            metadata: extractMetadata(err.metadata),
            status: grpcStatusToHttp(grpcCode),
            statusText: grpcStatusName(grpcCode),
            duration,
          });
          return;
        }
        resolve({
          body: JSON.stringify(response),
          metadata: extractMetadata(new grpc.Metadata()),
          status: 200,
          statusText: 'OK',
          duration,
        });
      });

      // message should be an array for client streaming
      const messages = Array.isArray(req.message) ? req.message : [req.message || {}];
      for (const msg of messages) {
        call.write(msg);
      }
      call.end();
    });
  }

  if (req.stream === 'bidi') {
    // Bidirectional streaming
    return new Promise<GrpcResponse>((resolve) => {
      const responses: any[] = [];
      const call = clientMethod.call(client, metadata);
      let trailingMeta = new grpc.Metadata();

      call.on('data', (msg: any) => {
        responses.push(msg);
      });

      call.on('status', (status: grpc.StatusObject) => {
        trailingMeta = status.metadata || trailingMeta;
      });

      call.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          body: JSON.stringify(responses),
          metadata: extractMetadata(trailingMeta),
          status: 200,
          statusText: 'OK',
          duration,
        });
      });

      call.on('error', (err: grpc.ServiceError) => {
        const duration = Date.now() - start;
        const grpcCode = err.code ?? 2;
        resolve({
          body: JSON.stringify(responses),
          metadata: extractMetadata(err.metadata),
          status: grpcStatusToHttp(grpcCode),
          statusText: grpcStatusName(grpcCode),
          duration,
        });
      });

      // Write messages
      const messages = Array.isArray(req.message) ? req.message : [req.message || {}];
      for (const msg of messages) {
        call.write(msg);
      }
      call.end();
    });
  }

  throw new Error(`Unsupported gRPC stream type: ${req.stream}`);
}

function extractMetadata(metadata: grpc.Metadata | undefined): Record<string, string> {
  if (!metadata) { return {}; }
  const result: Record<string, string> = {};
  const map = metadata.getMap();
  for (const [key, value] of Object.entries(map)) {
    result[key] = typeof value === 'string' ? value : Buffer.from(value).toString('base64');
  }
  return result;
}

/**
 * Close all gRPC channels.
 */
export function closeAllGrpcChannels(): void {
  for (const channel of channelPool.values()) {
    channel.close();
  }
  channelPool.clear();
  reflectionCache.clear();
}
