import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  createGatewayHttp,
  GatewayHttpError,
  normalizeBaseUrl,
  toWebSocketUrl,
  unwrap,
  type GatewayHttp,
} from './http';
import { loadStored, newProfileId, saveStored, type GatewayProfile } from './profiles';
import { RpcClient, type RpcStatus } from './rpc';
import type { AuthProvider, GatewayStatus } from './status';

export type { AuthProvider, GatewayStatus } from './status';

// loading: reading saved gateways. no_gateway: nothing saved yet.
// signed_out: the gateway needs a sign-in. connecting: first handshake running.
// online: the chat socket is open. error: the gateway could not be reached.
export type GatewayPhase = 'loading' | 'no_gateway' | 'signed_out' | 'connecting' | 'online' | 'error';

type GatewayContextValue = {
  phase: GatewayPhase;
  error: string | null;
  profiles: GatewayProfile[];
  activeProfile: GatewayProfile | null;
  status: GatewayStatus | null;
  authProviders: AuthProvider[];
  http: GatewayHttp | null;
  rpc: RpcClient | null;
  rpcStatus: RpcStatus;
  addGateway: (name: string, address: string) => Promise<void>;
  selectGateway: (id: string) => Promise<void>;
  removeGateway: (id: string) => Promise<void>;
  connect: () => Promise<void>;
  signIn: (provider: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

const CONNECT_TIMEOUT_MS = 15_000;

// Reads the per-process token the dashboard injects into its page. A loopback
// gateway (auth off) needs it on the WebSocket. Gated gateways use tickets.
async function loopbackToken(baseUrl: string): Promise<string> {
  const html = await fetch(baseUrl + '/', { credentials: 'include' }).then((r) => r.text());
  const match = /window\.__HERMES_SESSION_TOKEN__="([^"]+)"/.exec(html);
  if (!match) throw new Error('This gateway did not provide a connection token.');
  return match[1];
}

function waitForOpen(rpc: RpcClient): Promise<RpcStatus> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve('closed');
    }, CONNECT_TIMEOUT_MS);
    const unsubscribe = rpc.onStatus((status) => {
      if (status === 'open' || status === 'closed') {
        clearTimeout(timer);
        unsubscribe();
        resolve(status);
      }
    });
    if (rpc.getStatus() === 'open') {
      clearTimeout(timer);
      unsubscribe();
      resolve('open');
    }
  });
}

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<GatewayPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<GatewayProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [http, setHttp] = useState<GatewayHttp | null>(null);
  const [rpc, setRpc] = useState<RpcClient | null>(null);
  const [rpcStatus, setRpcStatus] = useState<RpcStatus>('closed');

  // Connection attempts can overlap (for example, a fast gateway switch). Each
  // attempt gets a number, and only the newest one may change state.
  const attempt = useRef(0);
  const rpcRef = useRef<RpcClient | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? null,
    [profiles, activeId],
  );

  const stopRpc = useCallback(() => {
    rpcRef.current?.stop();
    rpcRef.current = null;
    setRpc(null);
    setRpcStatus('closed');
  }, []);

  const connectTo = useCallback(
    async (profile: GatewayProfile) => {
      const current = ++attempt.current;
      const isCurrent = () => attempt.current === current;

      stopRpc();
      setPhase('connecting');
      setError(null);
      setStatus(null);

      const client = createGatewayHttp(profile.baseUrl);
      setHttp(client);

      try {
        const info = unwrap(await client.GET('/api/status')) as unknown as GatewayStatus;
        if (!isCurrent()) return;
        setStatus(info);

        if (info.auth_required) {
          // A signed-in cookie is only valid while the server accepts it.
          try {
            unwrap(await client.GET('/api/auth/me'));
          } catch (authError) {
            if (!isCurrent()) return;
            if (authError instanceof GatewayHttpError && authError.status === 401) {
              const listed = (await client.GET('/api/auth/providers')).data as
                | { providers?: AuthProvider[] }
                | undefined;
              if (!isCurrent()) return;
              setAuthProviders(listed?.providers ?? []);
              setPhase('signed_out');
              return;
            }
            throw authError;
          }
        }

        let authFailed = false;
        const socket = new RpcClient({
          getUrl: async () => {
            if (info.auth_required) {
              const ticket = unwrap(await client.POST('/api/auth/ws-ticket')) as unknown as { ticket: string };
              return toWebSocketUrl(profile.baseUrl, '/api/ws', { ticket: ticket.ticket });
            }
            const token = await loopbackToken(profile.baseUrl);
            return toWebSocketUrl(profile.baseUrl, '/api/ws', { token });
          },
          onAuthFailure: () => {
            authFailed = true;
            if (!isCurrent()) return;
            stopRpc();
            setPhase('signed_out');
          },
        });
        rpcRef.current = socket;
        setRpc(socket);
        socket.onStatus((next) => {
          if (isCurrent()) setRpcStatus(next);
        });
        socket.start();

        const opened = await waitForOpen(socket);
        if (!isCurrent()) return;
        if (opened === 'open') {
          setPhase('online');
        } else if (!authFailed) {
          stopRpc();
          setPhase('error');
          setError('Reached the gateway, but the chat channel did not open.');
        }
      } catch (caught) {
        if (!isCurrent()) return;
        if (caught instanceof GatewayHttpError && caught.status === 401) {
          setPhase('signed_out');
          return;
        }
        setPhase('error');
        setError(caught instanceof Error ? caught.message : 'Could not reach the gateway.');
      }
    },
    [stopRpc],
  );

  // Load saved gateways once, then connect to the one that was active.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadStored();
      if (cancelled) return;
      setProfiles(stored.profiles);
      setActiveId(stored.activeId);
      const active = stored.profiles.find((p) => p.id === stored.activeId);
      if (!active) {
        setPhase('no_gateway');
        return;
      }
      await connectTo(active);
    })();
    return () => {
      cancelled = true;
      attempt.current++;
      rpcRef.current?.stop();
    };
  }, [connectTo]);

  const persist = useCallback(async (nextProfiles: GatewayProfile[], nextActive: string | null) => {
    setProfiles(nextProfiles);
    setActiveId(nextActive);
    await saveStored({ profiles: nextProfiles, activeId: nextActive });
  }, []);

  const addGateway = useCallback(
    async (name: string, address: string) => {
      const baseUrl = normalizeBaseUrl(address);
      const profile: GatewayProfile = {
        id: newProfileId(),
        name: name.trim() || new URL(baseUrl).host,
        baseUrl,
      };
      const nextProfiles = [...profiles, profile];
      await persist(nextProfiles, profile.id);
      await connectTo(profile);
    },
    [profiles, persist, connectTo],
  );

  const selectGateway = useCallback(
    async (id: string) => {
      const profile = profiles.find((p) => p.id === id);
      if (!profile) return;
      await persist(profiles, id);
      await connectTo(profile);
    },
    [profiles, persist, connectTo],
  );

  const removeGateway = useCallback(
    async (id: string) => {
      const remaining = profiles.filter((p) => p.id !== id);
      const nextActive = activeId === id ? (remaining[0]?.id ?? null) : activeId;
      await persist(remaining, nextActive);
      if (activeId === id) {
        stopRpc();
        const next = remaining.find((p) => p.id === nextActive);
        if (next) {
          await connectTo(next);
        } else {
          setStatus(null);
          setHttp(null);
          setPhase('no_gateway');
        }
      }
    },
    [profiles, activeId, persist, stopRpc, connectTo],
  );

  const connect = useCallback(async () => {
    if (!activeProfile) {
      setPhase('no_gateway');
      return;
    }
    await connectTo(activeProfile);
  }, [activeProfile, connectTo]);

  const signIn = useCallback(
    async (provider: string, username: string, password: string) => {
      if (!http || !activeProfile) throw new Error('Choose a gateway first.');
      unwrap(await http.POST('/auth/password-login', { body: { provider, username, password, next: '/' } }));
      await connectTo(activeProfile);
    },
    [http, activeProfile, connectTo],
  );

  const signOut = useCallback(async () => {
    try {
      if (http) await http.POST('/auth/logout');
    } finally {
      stopRpc();
      setPhase('signed_out');
    }
  }, [http, stopRpc]);

  const value = useMemo<GatewayContextValue>(
    () => ({
      phase,
      error,
      profiles,
      activeProfile,
      status,
      authProviders,
      http,
      rpc,
      rpcStatus,
      addGateway,
      selectGateway,
      removeGateway,
      connect,
      signIn,
      signOut,
    }),
    [
      phase,
      error,
      profiles,
      activeProfile,
      status,
      authProviders,
      http,
      rpc,
      rpcStatus,
      addGateway,
      selectGateway,
      removeGateway,
      connect,
      signIn,
      signOut,
    ],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextValue {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}

// Returns the connected HTTP client, or throws. Screens only call this once online.
export function useHttp(): GatewayHttp {
  const { http } = useGateway();
  if (!http) throw new Error('The gateway is not connected.');
  return http;
}
