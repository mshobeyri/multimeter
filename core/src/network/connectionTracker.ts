// Connection tracking for HTTP keep-alive and WebSocket connections
// This module tracks active network connections and their lifecycle events.

export interface ActiveConnection {
  id: string;
  host: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  state: 'connecting' | 'open' | 'idle' | 'closing';
  connectedAt: number;
  lastActivityAt: number;
  requestCount: number;
  bytesReceived?: number;
  bytesSent?: number;
}

export type ConnectionEvent =
  | { type: 'open'; connection: ActiveConnection }
  | { type: 'update'; connection: ActiveConnection }
  | { type: 'close'; id: string; closedBy: 'client' | 'server' | 'timeout' };

export type ConnectionEventListener = (event: ConnectionEvent) => void;
export type CloseHandler = () => void;

class ConnectionTrackerImpl {
  private connections: Map<string, ActiveConnection> = new Map();
  private closeHandlers: Map<string, CloseHandler> = new Map();
  private listeners: Set<ConnectionEventListener> = new Set();
  private idCounter = 0;

  /**
   * Generate a unique connection ID
   */
  generateId(): string {
    return `conn-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Register a new connection
   */
  open(params: {
    id: string;
    host: string;
    protocol: 'http' | 'https' | 'ws' | 'wss';
  }): ActiveConnection {
    const now = Date.now();
    const connection: ActiveConnection = {
      id: params.id,
      host: params.host,
      protocol: params.protocol,
      state: 'connecting',
      connectedAt: now,
      lastActivityAt: now,
      requestCount: 0,
    };
    this.connections.set(params.id, connection);
    this.emit({ type: 'open', connection });
    return connection;
  }

  /**
   * Register a close handler for a connection
   * This handler will be called when the user requests to close the connection
   */
  setCloseHandler(id: string, handler: CloseHandler): void {
    this.closeHandlers.set(id, handler);
  }

  /**
   * Mark connection as open/connected
   */
  connected(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.state = 'open';
      conn.lastActivityAt = Date.now();
      this.emit({ type: 'update', connection: conn });
    }
  }

  /**
   * Record activity on a connection (e.g., request sent/response received)
   */
  activity(id: string, opts?: { incrementRequests?: boolean; bytesReceived?: number; bytesSent?: number }): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.state = 'open';
      conn.lastActivityAt = Date.now();
      if (opts?.incrementRequests) {
        conn.requestCount++;
      }
      if (opts?.bytesReceived) {
        conn.bytesReceived = (conn.bytesReceived || 0) + opts.bytesReceived;
      }
      if (opts?.bytesSent) {
        conn.bytesSent = (conn.bytesSent || 0) + opts.bytesSent;
      }
      this.emit({ type: 'update', connection: conn });
    }
  }

  /**
   * Mark connection as idle
   */
  idle(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.state = 'idle';
      this.emit({ type: 'update', connection: conn });
    }
  }

  /**
   * Mark connection as closing
   */
  closing(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.state = 'closing';
      this.emit({ type: 'update', connection: conn });
    }
  }

  /**
   * Request to close a connection - calls the close handler if registered
   * This is used when the user clicks the close button
   */
  requestClose(id: string): void {
    const handler = this.closeHandlers.get(id);
    if (handler) {
      try {
        handler();
      } catch {
        // Ignore errors from close handler
      }
    }
    // The actual close() will be called by the socket's close event
    // But if there's no handler, we just remove from tracking
    if (!handler && this.connections.has(id)) {
      this.close(id, 'client');
    }
  }

  /**
   * Close and remove a connection (called when socket actually closes)
   */
  close(id: string, closedBy: 'client' | 'server' | 'timeout' = 'client'): void {
    if (this.connections.has(id)) {
      this.connections.delete(id);
      this.closeHandlers.delete(id);
      this.emit({ type: 'close', id, closedBy });
    }
  }

  /**
   * Get a connection by ID
   */
  get(id: string): ActiveConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all active connections
   */
  getAll(): ActiveConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Find connection by host (useful for HTTP keep-alive reuse detection)
   */
  findByHost(host: string, protocol: 'http' | 'https'): ActiveConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.host === host && conn.protocol === protocol) {
        return conn;
      }
    }
    return undefined;
  }

  /**
   * Close all connections - calls close handlers for each
   */
  closeAll(): void {
    const ids = Array.from(this.connections.keys());
    for (const id of ids) {
      this.requestClose(id);
    }
  }

  /**
   * Subscribe to connection events
   */
  subscribe(listener: ConnectionEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: ConnectionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        // Ignore listener errors
      }
    }
  }

  /**
   * Clear all connections (for testing/reset)
   */
  clear(): void {
    this.connections.clear();
    this.idCounter = 0;
  }
}

// Singleton instance
export const connectionTracker = new ConnectionTrackerImpl();
