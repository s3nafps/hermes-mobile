import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { RpcError, type RpcClient } from '@/lib/gateway/rpc';
import { useGateway } from '@/lib/gateway/GatewayProvider';

import { EMPTY_STATE, reduce, type ChatState, type PendingPrompt } from './reducer';
import type { ApprovalChoice, SentAttachment, SessionInfo, WireMessage } from './types';

export type ChatApi = {
  state: ChatState;
  createSession: () => Promise<string>;
  attach: (storedKey: string) => Promise<string>;
  // Resolves true when the gateway took the message, false when it was rejected.
  submit: (liveId: string, text: string, attachments?: SentAttachment[]) => Promise<boolean>;
  interrupt: (liveId: string) => Promise<void>;
  answerApproval: (prompt: PendingPrompt, choice: ApprovalChoice) => Promise<'answered' | 'expired'>;
  answerClarify: (prompt: PendingPrompt, answer: string) => Promise<void>;
  answerSudo: (prompt: PendingPrompt, password: string) => Promise<'answered' | 'expired'>;
  answerSecret: (prompt: PendingPrompt, value: string) => Promise<'answered' | 'expired'>;
  setTitle: (liveId: string, title: string) => Promise<void>;
  closeSession: (liveId: string) => Promise<void>;
  dismissNotice: (id: string) => void;
};

const ChatContext = createContext<ChatApi | null>(null);

const COLS = 80;

type ResumeResult = {
  session_id: string;
  session_key?: string;
  resumed?: string;
  messages?: WireMessage[];
  info?: Partial<SessionInfo>;
  running?: boolean;
  inflight?: { assistant?: string } | null;
  queued?: { user?: string } | null;
};

type CreateResult = {
  session_id: string;
  messages?: WireMessage[];
  info?: Partial<SessionInfo>;
};

function requireConnected(rpc: RpcClient | null): RpcClient {
  if (!rpc) throw new RpcError(0, 'Not connected to the gateway.');
  return rpc;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { rpc, rpcStatus } = useGateway();
  const [state, dispatch] = useReducer(reduce, EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const counter = useRef(0);

  const nextLocalId = useCallback(() => `u${Date.now().toString(36)}_${counter.current++}`, []);

  // Every event from the socket goes through the reducer.
  useEffect(() => {
    if (!rpc) return;
    return rpc.onEvent((event) => dispatch({ type: 'event', event, now: Date.now() }));
  }, [rpc]);

  const hydrate = useCallback((result: ResumeResult, fallbackKey: string | null) => {
    dispatch({
      type: 'hydrate',
      liveId: result.session_id,
      storedKey: result.session_key ?? result.resumed ?? fallbackKey,
      messages: result.messages ?? [],
      info: result.info ?? {},
      running: result.running ?? false,
      inflight: result.inflight?.assistant ?? null,
      queued: result.queued?.user ?? null,
    });
    return result.session_id;
  }, []);

  // After a reconnect the server has to be told to send this socket's events again.
  // Re-attaching each saved session also restores any text that streamed while we were away.
  useEffect(() => {
    if (!rpc || rpcStatus !== 'open') return;
    const sessions = Object.values(stateRef.current.sessions).filter((s) => s.storedKey);
    for (const session of sessions) {
      rpc
        .call<ResumeResult>('session.resume', { session_id: session.storedKey, cols: COLS })
        .then((result) => hydrate(result, session.storedKey))
        .catch(() => {
          // A session that no longer exists stays as it is. The user can reopen it from the list.
        });
    }
  }, [rpc, rpcStatus, hydrate]);

  const createSession = useCallback(async () => {
    const client = requireConnected(rpc);
    const result = await client.call<CreateResult>('session.create', { cols: COLS });
    dispatch({
      type: 'hydrate',
      liveId: result.session_id,
      // The stored key only becomes resumable after the first prompt, so it is read later from session.info.
      storedKey: null,
      messages: result.messages ?? [],
      info: result.info ?? {},
      running: false,
      inflight: null,
      queued: null,
    });
    return result.session_id;
  }, [rpc]);

  const attach = useCallback(
    async (storedKey: string) => {
      const client = requireConnected(rpc);
      const result = await client.call<ResumeResult>('session.resume', { session_id: storedKey, cols: COLS });
      return hydrate(result, storedKey);
    },
    [rpc, hydrate],
  );

  const submit = useCallback(
    async (liveId: string, text: string, attachments: SentAttachment[] = []): Promise<boolean> => {
      const client = requireConnected(rpc);
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return false;
      // The agent needs some words to act on, so files sent alone get a short request.
      const body = trimmed || 'Please look at the attached files.';
      const refs = attachments.flatMap((attachment) => (attachment.refText ? [attachment.refText] : []));
      const localId = nextLocalId();
      dispatch({ type: 'local_user', liveId, id: localId, text: trimmed, attachments });
      try {
        const result = await client.call<{ status: string }>('prompt.submit', {
          session_id: liveId,
          text: [body, ...refs].join('\n'),
        });
        if (result.status === 'queued') dispatch({ type: 'queued', liveId, text: body });
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The message could not be sent.';
        dispatch({ type: 'user_failed', liveId, id: localId, message });
        return false;
      }
    },
    [rpc, nextLocalId],
  );

  const interrupt = useCallback(
    async (liveId: string) => {
      await requireConnected(rpc).call('session.interrupt', { session_id: liveId });
    },
    [rpc],
  );

  const dismissPrompt = useCallback((id: string) => dispatch({ type: 'drop_prompt', id }), []);

  const answerApproval = useCallback(
    async (prompt: PendingPrompt, choice: ApprovalChoice) => {
      const result = await requireConnected(rpc).call<{ resolved: number }>('approval.respond', {
        session_id: prompt.liveId,
        choice,
      });
      dismissPrompt(prompt.id);
      return result.resolved > 0 ? 'answered' : 'expired';
    },
    [rpc, dismissPrompt],
  );

  const answerClarify = useCallback(
    async (prompt: PendingPrompt, answer: string) => {
      await requireConnected(rpc).call('clarify.respond', { request_id: prompt.requestId, answer });
      dismissPrompt(prompt.id);
    },
    [rpc, dismissPrompt],
  );

  const answerSudo = useCallback(
    async (prompt: PendingPrompt, password: string) => {
      const result = await requireConnected(rpc).call<{ status: string }>('sudo.respond', {
        request_id: prompt.requestId,
        password,
      });
      dismissPrompt(prompt.id);
      return result.status === 'expired' ? 'expired' : 'answered';
    },
    [rpc, dismissPrompt],
  );

  const answerSecret = useCallback(
    async (prompt: PendingPrompt, value: string) => {
      const result = await requireConnected(rpc).call<{ status: string }>('secret.respond', {
        request_id: prompt.requestId,
        value,
      });
      dismissPrompt(prompt.id);
      return result.status === 'expired' ? 'expired' : 'answered';
    },
    [rpc, dismissPrompt],
  );

  const setTitle = useCallback(
    async (liveId: string, title: string) => {
      await requireConnected(rpc).call('session.title', { session_id: liveId, title: title.trim() });
    },
    [rpc],
  );

  const closeSession = useCallback(
    async (liveId: string) => {
      try {
        await requireConnected(rpc).call('session.close', { session_id: liveId });
      } finally {
        dispatch({ type: 'drop_session', liveId });
      }
    },
    [rpc],
  );

  const dismissNotice = useCallback((id: string) => dispatch({ type: 'dismiss_notice', id }), []);

  const value = useMemo<ChatApi>(
    () => ({
      state,
      createSession,
      attach,
      submit,
      interrupt,
      answerApproval,
      answerClarify,
      answerSudo,
      answerSecret,
      setTitle,
      closeSession,
      dismissNotice,
    }),
    [
      state,
      createSession,
      attach,
      submit,
      interrupt,
      answerApproval,
      answerClarify,
      answerSudo,
      answerSecret,
      setTitle,
      closeSession,
      dismissNotice,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatApi {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside ChatProvider.');
  return value;
}
