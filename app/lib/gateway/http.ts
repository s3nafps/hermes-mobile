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

// Cookies carry the login session on native too, so credentials are included.
export function createGatewayHttp(baseUrl: string): GatewayHttp {
  return createClient<paths>({ baseUrl, credentials: 'include' });
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
