import { describe, expect, it } from 'vitest';

import { GatewayHttpError, isPlainHttpRisky, normalizeBaseUrl, toWebSocketUrl, unwrap } from './http';

describe('normalizeBaseUrl', () => {
  it('adds https when the user typed only a host and port', () => {
    expect(normalizeBaseUrl('hermes.local:9119')).toBe('https://hermes.local:9119');
  });

  it('keeps an http address as typed and drops trailing slashes', () => {
    expect(normalizeBaseUrl('http://10.0.0.5:9119/')).toBe('http://10.0.0.5:9119');
  });

  it('refuses an empty address', () => {
    expect(() => normalizeBaseUrl('   ')).toThrow('Enter the gateway address.');
  });
});

describe('isPlainHttpRisky', () => {
  it('does not flag https', () => {
    expect(isPlainHttpRisky('https://hermes.example.com')).toBe(false);
  });

  it('does not flag plain http on this phone or on a Tailscale address', () => {
    expect(isPlainHttpRisky('http://localhost:9119')).toBe(false);
    expect(isPlainHttpRisky('http://127.0.0.1:9119')).toBe(false);
    expect(isPlainHttpRisky('http://100.101.102.103:9119')).toBe(false);
    expect(isPlainHttpRisky('http://home.tailnet.ts.net:9119')).toBe(false);
  });

  it('flags plain http on a LAN or public address, and on addresses just outside Tailscale', () => {
    expect(isPlainHttpRisky('http://192.168.1.20:9119')).toBe(true);
    expect(isPlainHttpRisky('http://203.0.113.7:9119')).toBe(true);
    expect(isPlainHttpRisky('http://100.128.0.1:9119')).toBe(true);
    expect(isPlainHttpRisky('http://hermes.local:9119')).toBe(true);
  });
});

describe('toWebSocketUrl', () => {
  it('uses wss for https and carries the query parameters', () => {
    expect(toWebSocketUrl('https://hermes.example.ts.net', '/api/ws', { token: 't' })).toBe(
      'wss://hermes.example.ts.net/api/ws?token=t',
    );
  });

  it('uses ws for http', () => {
    expect(toWebSocketUrl('http://10.0.0.5:9119', '/api/ws', { ticket: 'abc' })).toBe(
      'ws://10.0.0.5:9119/api/ws?ticket=abc',
    );
  });
});

describe('unwrap', () => {
  it('returns the data of a successful response', () => {
    const response = new Response(null, { status: 200 });
    expect(unwrap({ data: { ok: true }, response })).toEqual({ ok: true });
  });

  it('throws a GatewayHttpError that carries the server detail', () => {
    const response = new Response(null, { status: 401 });
    try {
      unwrap({ error: { detail: 'Wrong password' }, response });
      expect.unreachable('unwrap should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(GatewayHttpError);
      expect(caught).toMatchObject({ status: 401, message: 'Wrong password' });
    }
  });

  it('falls back to a plain message when the server sends no detail', () => {
    const response = new Response(null, { status: 503 });
    expect(() => unwrap({ response })).toThrow('The gateway could not reach its sign-in provider. Try again shortly.');
  });
});
