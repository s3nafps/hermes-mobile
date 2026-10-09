import { describe, expect, it, vi } from 'vitest';

import { addressHints, isPlainHttpPublic, withDeadline } from './http';

describe('isPlainHttpPublic', () => {
  it('warns for plain http to a public address', () => {
    expect(isPlainHttpPublic('http://95.111.242.216:9119')).toBe(true);
    expect(isPlainHttpPublic('http://home.example.com:9119')).toBe(true);
  });

  it('does not warn for plain http on the local network, Tailscale, or this phone', () => {
    expect(isPlainHttpPublic('http://192.168.1.20:9119')).toBe(false);
    expect(isPlainHttpPublic('http://10.0.0.5:9119')).toBe(false);
    expect(isPlainHttpPublic('http://172.20.1.1:9119')).toBe(false);
    expect(isPlainHttpPublic('http://100.101.102.103:9119')).toBe(false);
    expect(isPlainHttpPublic('http://hermes.local:9119')).toBe(false);
    expect(isPlainHttpPublic('http://127.0.0.1:9119')).toBe(false);
  });

  it('does not warn for https, and does not throw on an unusable address', () => {
    expect(isPlainHttpPublic('https://hermes.example.ts.net')).toBe(false);
    expect(isPlainHttpPublic('   ')).toBe(false);
  });
});

describe('addressHints', () => {
  it('explains that port 8642 is the messaging API, not the dashboard', () => {
    expect(addressHints('http://95.111.242.216:8642')[0]).toContain('Port 8642');
  });

  it('asks for the path to be removed when the address has one, such as /v1', () => {
    const hints = addressHints('http://95.111.242.216:9119/v1');
    expect(hints.join(' ')).toContain('Remove "/v1"');
  });

  it('notes a missing port on a plain IP address', () => {
    expect(addressHints('http://192.168.1.20')).toEqual([
      'No port is given. The dashboard listens on port 9119 by default.',
    ]);
  });

  it('gives no hints for a correct address', () => {
    expect(addressHints('http://192.168.1.20:9119')).toEqual([]);
  });

  it('says when the text is not an address at all', () => {
    expect(addressHints('http://[bad')[0]).toContain('does not look like an address');
  });
});

describe('withDeadline', () => {
  it('stops a request that never answers and says how long it waited', async () => {
    vi.useFakeTimers();
    try {
      const never = withDeadline((signal) => new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
      const settled = expect(never).rejects.toThrow('No answer from the gateway after 10 seconds.');
      await vi.advanceTimersByTimeAsync(10_000);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the value of a request that answers in time', async () => {
    await expect(withDeadline(async () => 'ok')).resolves.toBe('ok');
  });
});
