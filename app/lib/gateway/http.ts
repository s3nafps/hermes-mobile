import createClient, { type Client } from 'openapi-fetch';

import type { paths } from './schema';

// Typed REST client for the Hermes dashboard API. Paths, methods, params and
// bodies are checked against the server's own OpenAPI schema (see schema.ts).
export type GatewayHttp = Client<paths>;

export class GatewayHttpError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'GatewayHttpError';
    this.status = status;
    this.detail = detail;
  }
}

// Gated gateways authenticate with the session cookie. An open (loopback) gateway
// takes the per-process token as a bearer header instead, the same way its own page does.
export function createGatewayHttp(baseUrl: string, bearerToken?: string): GatewayHttp {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
    headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
  });
}

// Normalises user input such as "hermes.local:9119" or "https://x.ts.net/" into
// a base URL with no trailing slash.
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter the gateway address.');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The gateway address must start with http:// or https://.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export const REQUEST_TIMEOUT_MS = 10_000;

// Bounds one request. Without it, a host that drops packets leaves the app waiting for as
// long as the OS keeps retrying, which can be minutes.
export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (caught) {
    if (controller.signal.aborted) {
      throw new Error(
        `No answer from the gateway after ${timeoutMs / 1000} seconds. Check the address, and that Hermes is running and reachable from this phone.`,
      );
    }
    throw caught;
  } finally {
    clearTimeout(timer);
  }
}

// True for addresses that stay on this phone, the local network, or a VPN such as
// Tailscale. Plain http is acceptable there. Any other host is treated as public.
function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.ts.net')) return true;
  if (host === '[::1]' || /^\[f[cd]/i.test(host)) return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254)
  );
}

// Warns when an address would send the password over plain http to a public host.
export function isPlainHttpPublic(input: string): boolean {
  try {
    const url = new URL(normalizeBaseUrl(input));
    return url.protocol === 'http:' && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
}

// Mistakes we can recognise from the text alone. Each hint says what to change.
export function addressHints(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return ['This does not look like an address. Use something like http://192.168.1.20:9119.'];
  }
  const hints: string[] = [];
  if (url.port === '8642') {
    hints.push(
      "Port 8642 is Hermes's messaging API, which this app cannot use. The app needs the dashboard, usually port 9119.",
    );
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    hints.push(`Remove "${url.pathname}" from the address. Enter only the address and port, such as http://192.168.1.20:9119.`);
  }
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
  if (!url.port && url.protocol === 'http:' && isIp) {
    hints.push('No port is given. The dashboard listens on port 9119 by default.');
  }
  return hints;
}

// The dashboard's WebSocket lives on the same origin, with wss:// for https.
export function toWebSocketUrl(baseUrl: string, path: string, query: Record<string, string>): string {
  const url = new URL(baseUrl + path);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

function messageFrom(status: number, detail: unknown): string {
  if (detail && typeof detail === 'object' && 'detail' in detail) {
    const text = (detail as { detail: unknown }).detail;
    if (typeof text === 'string') return text;
  }
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 404) return 'This gateway does not offer that sign-in method.';
  if (status === 429) return 'Too many sign-in attempts. Wait a minute and try again.';
  if (status === 503) return 'The gateway could not reach its sign-in provider. Try again shortly.';
  return `The gateway returned an error (${status}).`;
}

// Turns an openapi-fetch result into its data, or throws GatewayHttpError.
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  const { response, error, data } = result;
  if (error !== undefined || !response.ok) {
    throw new GatewayHttpError(response.status, messageFrom(response.status, error), error);
  }
  return data as T;
}
