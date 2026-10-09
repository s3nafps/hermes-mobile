import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RPC_NOT_CONNECTED, RpcClient, RpcError, type RpcEvent, type RpcStatus } from './rpc';

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

  it('marks a call made while disconnected as never sent', async () => {
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    await expect(client.call('session.list')).rejects.toMatchObject({ code: RPC_NOT_CONNECTED });
  });

  it('reconnects at once when the app comes back, instead of waiting out the backoff', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop();

    client.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeSocket.instances.length).toBe(2);
    client.stop();
  });

  it('drops a socket that stops answering while the app is on screen, then reconnects', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = FakeSocket.instances[0];
    first.open();

    client.setForeground(true);
    expect(sentRequest(first).method).toBe('session.active_list');

    await vi.advanceTimersByTimeAsync(8_000);
    expect(client.getStatus()).toBe('closed');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(FakeSocket.instances.length).toBe(2);
    client.stop();
  });

  it('keeps a socket whose probe gets an error answer, since the link itself works', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FakeSocket.instances[0];
    socket.open();

    client.setForeground(true);
    const probe = sentRequest(socket);
    socket.receive(JSON.stringify({ jsonrpc: '2.0', id: probe.id, error: { code: 4001, message: 'no' } }));
    await vi.advanceTimersByTimeAsync(20_000);

    expect(client.getStatus()).toBe('open');
    expect(FakeSocket.instances.length).toBe(1);
    client.stop();
  });

  it('keeps backing off while a socket keeps dropping right after it opens', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop();
    await vi.advanceTimersByTimeAsync(1_300);
    expect(FakeSocket.instances.length).toBe(2);

    FakeSocket.instances[1].open();
    FakeSocket.instances[1].drop();
    await vi.advanceTimersByTimeAsync(1_300);
    expect(FakeSocket.instances.length).toBe(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances.length).toBe(3);
    client.stop();
  });

  it('resets the reconnect backoff once a socket has stayed open for a while', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop();
    await vi.advanceTimersByTimeAsync(1_300);
    expect(FakeSocket.instances.length).toBe(2);

    FakeSocket.instances[1].open();
    await vi.advanceTimersByTimeAsync(5_000);
    FakeSocket.instances[1].drop();
    await vi.advanceTimersByTimeAsync(1_300);
    expect(FakeSocket.instances.length).toBe(3);
    client.stop();
  });

  it('gives up on a handshake that never finishes, then reconnects', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getStatus()).toBe('closed');

    await vi.advanceTimersByTimeAsync(1_300);
    expect(FakeSocket.instances.length).toBe(2);
    client.stop();
  });

  it('leaves a connection attempt that is already in progress alone when the app comes back', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);

    client.setForeground(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeSocket.instances.length).toBe(1);
    client.stop();
  });

  it('replaces a connection attempt that is still handshaking when the user asks to reconnect', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const stuck = FakeSocket.instances[0];

    client.wake();
    await vi.advanceTimersByTimeAsync(0);

    expect(stuck.readyState).toBe(FakeSocket.CLOSED);
    expect(FakeSocket.instances.length).toBe(2);
    client.stop();
  });

  it('checks a silent socket every 30 seconds while the app is on screen', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FakeSocket.instances[0];
    socket.open();

    client.setForeground(true);
    socket.receive(JSON.stringify({ jsonrpc: '2.0', id: sentRequest(socket).id, result: [] }));
    expect(socket.sent.length).toBe(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(socket.sent.length).toBe(2);
    expect(sentRequest(socket, 1).method).toBe('session.active_list');

    await vi.advanceTimersByTimeAsync(8_000);
    expect(client.getStatus()).toBe('closed');
    client.stop();
  });

  it('stops checking the socket once the app is in the background', async () => {
    vi.useFakeTimers();
    const client = new RpcClient({ getUrl: async () => 'ws://gateway/api/ws' });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FakeSocket.instances[0];
    socket.open();

    client.setForeground(true);
    socket.receive(JSON.stringify({ jsonrpc: '2.0', id: sentRequest(socket).id, result: [] }));
    client.setForeground(false);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(socket.sent.length).toBe(1);
    client.stop();
  });

  it('does not open a second socket when it is stopped and started while a URL is being fetched', async () => {
    const urls: Array<(url: string) => void> = [];
    const client = new RpcClient({ getUrl: () => new Promise<string>((resolve) => urls.push(resolve)) });
    client.start();
    client.stop();
    client.start();

    urls[1]('ws://gateway/api/ws');
    await vi.waitFor(() => expect(FakeSocket.instances.length).toBe(1));

    urls[0]('ws://gateway/api/ws');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(FakeSocket.instances.length).toBe(1);
    client.stop();
  });
});
