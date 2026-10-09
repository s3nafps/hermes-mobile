import { describe, expect, it } from 'vitest';

import { GatewayHttpError, normalizeBaseUrl, toWebSocketUrl, unwrap } from './http';

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
