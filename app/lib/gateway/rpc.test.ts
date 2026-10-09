import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RpcClient, RpcError, type RpcEvent, type RpcStatus } from './rpc';

// A stand-in for the browser WebSocket. Tests drive it: open it, send frames to it, or drop it.
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: ((close: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  // Closing from the client side. The real socket also fires onclose, but the client has
  // already let go of this socket by then, so nothing else needs to happen here.
  close(): void {
    this.readyState = FakeSocket.CLOSED;
  }

  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }

  drop(code = 1006): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code });
  }
}

// Lets the client's async connect step run before the test looks at the socket.
async function nextSocket(): Promise<FakeSocket> {
  await vi.waitFor(() => expect(FakeSocket.instances.length).toBeGreaterThan(0));
  return FakeSocket.instances[FakeSocket.instances.length - 1];
}

function sentRequest(socket: FakeSocket, index = 0): { id: number; method: string; params: unknown } {
  return JSON.parse(socket.sent[index]);
}

describe('RpcClient', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends a JSON-RPC request and resolves with the response that has the same id', async () => {
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    const socket = await nextSocket();
    socket.open();

    const pending = client.call<string>('session.create', { cols: 80 });
    const request = sentRequest(socket);
    expect(request).toMatchObject({ jsonrpc: '2.0', method: 'session.create', params: { cols: 80 } });

    socket.receive(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 'live-1' }));

    await expect(pending).resolves.toBe('live-1');
    client.stop();
  });

  it('rejects a call with the gateway error code and message', async () => {
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    const socket = await nextSocket();
    socket.open();

    const pending = client.call('prompt.submit', { session_id: 'live-1', text: 'hi' });
    const request = sentRequest(socket);
    socket.receive(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: 4009, message: 'Busy' } }));

    await expect(pending).rejects.toMatchObject({ code: 4009, message: 'Busy' });
    client.stop();
  });

  it('passes server events to listeners, including when one frame carries several lines', async () => {
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    const seen: RpcEvent[] = [];
    client.onEvent((event) => seen.push(event));
    client.start();
    const socket = await nextSocket();
    socket.open();

    socket.receive(
      [
        JSON.stringify({ jsonrpc: '2.0', method: 'event', params: { type: 'message.delta', session_id: 'a', payload: { text: 'x' } } }),
        'not json',
        JSON.stringify({ jsonrpc: '2.0', method: 'event', params: { type: 'message.complete', session_id: 'a' } }),
      ].join('\n'),
    );

    expect(seen.map((event) => event.type)).toEqual(['message.delta', 'message.complete']);
    client.stop();
  });

  it('rejects calls in flight when the socket drops, then reconnects and reports each status', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    const statuses: RpcStatus[] = [];
    client.onStatus((status) => statuses.push(status));
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakeSocket.instances[0];
    first.open();

    const pending = client.call('session.interrupt', { session_id: 'live-1' });
    first.drop();

    await expect(pending).rejects.toBeInstanceOf(RpcError);
    expect(statuses).toEqual(['connecting', 'open', 'closed']);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(FakeSocket.instances.length).toBe(2);
    client.stop();
  });

  it('does not reconnect after the gateway refuses the sign-in, and reports it', async () => {
    vi.useFakeTimers();
    const onAuthFailure = vi.fn();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws', onAuthFailure });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FakeSocket.instances[0];
    socket.open();

    socket.drop(4401);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances.length).toBe(1);
  });

  it('rejects a call that gets no answer within the request timeout', async () => {
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws', requestTimeoutMs: 20 });
    client.start();
    const socket = await nextSocket();
    socket.open();

    await expect(client.call('session.list')).rejects.toThrow('session.list timed out.');
    client.stop();
  });
});
