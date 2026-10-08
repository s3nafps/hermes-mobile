import { useCallback, useEffect, useRef, useState } from 'react';

import { useGateway } from './GatewayProvider';
import type { RpcEvent } from './rpc';

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export type GatewayQuery<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refetch: () => void;
  setData: (data: T) => void;
};

// Loads data from the gateway. Refreshing keeps the old data on screen until the new
// data arrives, so pull-to-refresh and polling never flash an empty state.
export function useGatewayQuery<T>(
  load: (() => Promise<T>) | null,
  deps: readonly unknown[],
  options: { pollMs?: number } = {},
): GatewayQuery<T> {
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: load !== null,
  });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const run = loadRef.current;
    if (!run) {
      setState({ data: undefined, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    run().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (caught) => {
        if (!cancelled) setState((prev) => ({ data: prev.data, error: messageOf(caught), loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
    // deps is the caller's list of inputs. It is passed through so each screen
    // controls when its query reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, load === null, ...deps]);

  useEffect(() => {
    if (!options.pollMs) return;
    const id = setInterval(() => setTick((t) => t + 1), options.pollMs);
    return () => clearInterval(id);
  }, [options.pollMs]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState((prev) => ({ ...prev, data, error: null })), []);

  return { ...state, refetch, setData };
}

// Subscribes to the live gateway event stream for as long as the component is mounted.
export function useRpcEvents(handler: (event: RpcEvent) => void): void {
  const { rpc } = useGateway();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!rpc) return;
    return rpc.onEvent((event) => handlerRef.current(event));
  }, [rpc]);
}

export type GatewayAction<A extends unknown[], R> = {
  run: (...args: A) => Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
};

// Wraps a write (create, save, delete, toggle). Pending and error state come with it,
// so a button can show progress and the reason for a failure.
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>): GatewayAction<A, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: A) => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (caught) {
      setError(messageOf(caught));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  return { run, pending, error, clearError };
}
