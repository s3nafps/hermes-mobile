import { unwrap } from '@/lib/gateway';

// Untyped endpoints return `unknown` data from openapi-fetch. Callers name the
// shape they expect, and unwrap still throws GatewayHttpError on a non-2xx reply.
export function untyped<T>(result: { data?: unknown; error?: unknown; response: Response }): T {
  return unwrap(result as { data?: T; error?: unknown; response: Response });
}

// Shared message for a loader that runs before the gateway is online.
export const NOT_CONNECTED = 'The gateway is not connected.';
