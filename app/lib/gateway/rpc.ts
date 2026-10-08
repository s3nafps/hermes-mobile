// JSON-RPC 2.0 client for the gateway's /api/ws endpoint. It is the same
// protocol the Hermes TUI and desktop use: requests get a response with the
// same id, and the server pushes events as notifications with method "event".

export type RpcEvent = {
  type: string;
  session_id?: string;
  payload?: unknown;
};

export type RpcStatus = 'connecting' | 'open' | 'closed';

export class RpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

// Close codes the gateway uses when the upgrade is refused.
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_FORBIDDEN = 4403;

export type RpcClientOptions = {
  // Resolves a fresh WebSocket URL on every connect. On a gated gateway this
  // mints a single-use ticket, so it must be called once per connection.
  getUrl: () => Promise<string>;
  onAuthFailure?: () => void;
  requestTimeoutMs?: number;
};

type Pending = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

export class RpcClient {
  private readonly options: RpcClientOptions;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly eventListeners = new Set<(event: RpcEvent) => void>();
  private readonly statusListeners = new Set<(status: RpcStatus) => void>();
  private status: RpcStatus = 'closed';
  private wantOpen = false;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RpcClientOptions) {
    this.options = options;
  }

  getStatus(): RpcStatus {
    return this.status;
  }

  // Opens the socket and keeps it open, reconnecting with backoff until stop().
  start(): void {
    if (this.wantOpen) return;
    this.wantOpen = true;
    void this.open();
  }

  stop(): void {
    this.wantOpen = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'client closed');
    this.rejectAll(new RpcError(0, 'Disconnected from the gateway.'));
    this.setStatus('closed');
  }

  onEvent(listener: (event: RpcEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatus(listener: (status: RpcStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // Sends one request and resolves with its result, or rejects with RpcError.
  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new RpcError(0, 'Not connected to the gateway.'));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(0, `${method} timed out.`));
      }, this.options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.pending.set(id, {
        method,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  private async open(): Promise<void> {
    if (!this.wantOpen) return;
    this.setStatus('connecting');
    let url: string;
    try {
      url = await this.options.getUrl();
    } catch (error) {
      this.setStatus('closed');
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) {
        // The session is gone, so reconnecting would only fail again.
        this.wantOpen = false;
        this.options.onAuthFailure?.();
      } else if (this.wantOpen) {
        // Anything else is usually a network blip, so retry with backoff.
        this.scheduleReconnect();
      }
      return;
    }
    if (!this.wantOpen) return;

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempts = 0;
      this.setStatus('open');
    };
    socket.onmessage = (message) => {
      if (this.socket !== socket) return;
      this.handleFrame(String(message.data));
    };
    socket.onclose = (close) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.rejectAll(new RpcError(0, 'The connection to the gateway closed.'));
      this.setStatus('closed');
      if (close.code === CLOSE_UNAUTHORIZED || close.code === CLOSE_FORBIDDEN) {
        this.wantOpen = false;
        this.options.onAuthFailure?.();
        return;
      }
      if (this.wantOpen) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempts) + Math.random() * 250;
    this.attempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.open();
    }, delay);
  }

  // A frame can carry one JSON object per line. Each line is handled on its own.
  private handleFrame(raw: string): void {
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let message: {
        id?: number | null;
        method?: string;
        params?: RpcEvent;
        result?: unknown;
        error?: { code: number; message: string };
      };
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.method === 'event' && message.params) {
        for (const listener of this.eventListeners) listener(message.params);
        continue;
      }
      if (message.id === undefined || message.id === null) continue;
      const entry = this.pending.get(message.id);
      if (!entry) continue;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) {
        entry.reject(new RpcError(message.error.code, message.error.message));
      } else {
        entry.resolve(message.result);
      }
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }

  private setStatus(status: RpcStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
