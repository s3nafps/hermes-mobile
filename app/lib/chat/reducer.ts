import type { RpcEvent } from '@/lib/gateway/rpc';

import { PROMPT_WINDOW_MS, type ApprovalChoice, type SessionInfo, type Usage, type WireMessage } from './types';

export type ChatItem =
  | { kind: 'user'; id: string; text: string; failed?: boolean }
  | { kind: 'assistant'; id: string; text: string; status: 'complete' | 'interrupted' | 'error'; usage?: Usage }
  | { kind: 'tool'; id: string; toolId: string; name: string; context: string; done: boolean; summary?: string; durationS?: number; risk?: string }
  | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

export type LiveSession = {
  liveId: string;
  storedKey: string | null;
  title: string;
  model: string;
  provider: string;
  cwd: string;
  approvalMode: string;
  reasoningEffort: string;
  yolo: boolean;
  usage: Usage | null;
  running: boolean;
  items: ChatItem[];
  streaming: string;
  thinking: string;
  statusLine: string;
  queued: string | null;
  lastError: string | null;
};

export type PromptKind = 'approval' | 'clarify' | 'sudo' | 'secret';

export type PendingPrompt = {
  id: string;
  kind: PromptKind;
  liveId: string;
  requestId: string | null;
  receivedAt: number;
  // approval
  command?: string;
  description?: string;
  choices?: ApprovalChoice[];
  // clarify
  question?: string;
  options?: string[] | null;
  // secret
  prompt?: string;
  envVar?: string;
};

export type Notice = {
  id: string;
  text: string;
  tone: 'info' | 'error';
  storedKey: string | null;
  at: number;
};

export type ChatState = {
  sessions: Record<string, LiveSession>;
  prompts: PendingPrompt[];
  notices: Notice[];
};

export type ChatAction =
  | { type: 'event'; event: RpcEvent; now: number }
  | {
      type: 'hydrate';
      liveId: string;
      storedKey: string | null;
      messages: WireMessage[];
      info: Partial<SessionInfo>;
      running: boolean;
      inflight: string | null;
      queued: string | null;
    }
  | { type: 'local_user'; liveId: string; id: string; text: string }
  | { type: 'user_failed'; liveId: string; id: string; message: string }
  | { type: 'queued'; liveId: string; text: string }
  | { type: 'drop_prompt'; id: string }
  | { type: 'drop_session'; liveId: string }
  | { type: 'notice'; notice: Notice }
  | { type: 'dismiss_notice'; id: string };

export const EMPTY_STATE: ChatState = { sessions: {}, prompts: [], notices: [] };

const DEFAULT_CHOICES: ApprovalChoice[] = ['once', 'session', 'always', 'deny'];
const MAX_NOTICES = 50;

function blankSession(liveId: string): LiveSession {
  return {
    liveId,
    storedKey: null,
    title: '',
    model: '',
    provider: '',
    cwd: '',
    approvalMode: 'manual',
    reasoningEffort: '',
    yolo: false,
    usage: null,
    running: false,
    items: [],
    streaming: '',
    thinking: '',
    statusLine: '',
    queued: null,
    lastError: null,
  };
}

function ensure(state: ChatState, liveId: string): LiveSession {
  return state.sessions[liveId] ?? blankSession(liveId);
}

function put(state: ChatState, session: LiveSession): ChatState {
  return { ...state, sessions: { ...state.sessions, [session.liveId]: session } };
}

function itemId(prefix: string, now: number): string {
  return `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Turns a stored conversation into display items.
export function itemsFromWire(messages: WireMessage[]): ChatItem[] {
  return messages.map((message, index) => {
    const id = `h${index}`;
    if (message.role === 'user') return { kind: 'user', id, text: message.text };
    if (message.role === 'assistant') return { kind: 'assistant', id, text: message.text, status: 'complete' };
    if (message.role === 'tool') {
      return { kind: 'tool', id, toolId: id, name: message.name, context: message.context, done: true };
    }
    return { kind: 'notice', id, text: message.text, tone: 'info' };
  });
}

function sessionInfoPatch(session: LiveSession, info: Partial<SessionInfo>): LiveSession {
  return {
    ...session,
    model: info.model ?? session.model,
    provider: info.provider ?? session.provider,
    cwd: info.cwd ?? session.cwd,
    approvalMode: info.approval_mode ?? session.approvalMode,
    reasoningEffort: info.reasoning_effort ?? session.reasoningEffort,
    yolo: info.yolo ?? session.yolo,
    title: info.title ?? session.title,
    storedKey: info.stored_session_id || session.storedKey,
    usage: info.usage ?? session.usage,
  };
}

function prunePromptsFor(prompts: PendingPrompt[], liveId: string): PendingPrompt[] {
  // The server releases every waiting prompt when a turn ends.
  return prompts.filter((p) => p.liveId !== liveId);
}

export function reduce(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'hydrate': {
      const base = ensure(state, action.liveId);
      const next: LiveSession = {
        ...sessionInfoPatch(base, action.info),
        liveId: action.liveId,
        storedKey: action.storedKey ?? base.storedKey,
        running: action.running,
        items: itemsFromWire(action.messages),
        streaming: action.inflight ?? '',
        thinking: '',
        statusLine: '',
        queued: action.queued,
        lastError: null,
      };
      return put(state, next);
    }

    case 'local_user': {
      const session = ensure(state, action.liveId);
      const item: ChatItem = { kind: 'user', id: action.id, text: action.text };
      return put(state, { ...session, items: [...session.items, item], lastError: null });
    }

    case 'user_failed': {
      const session = ensure(state, action.liveId);
      const items = session.items.map((item) =>
        item.kind === 'user' && item.id === action.id ? { ...item, failed: true } : item,
      );
      const notice: ChatItem = { kind: 'notice', id: itemId('n', 0), text: action.message, tone: 'error' };
      return put(state, { ...session, items: [...items, notice] });
    }

    case 'queued': {
      return put(state, { ...ensure(state, action.liveId), queued: action.text });
    }

    case 'drop_prompt':
      return { ...state, prompts: state.prompts.filter((p) => p.id !== action.id) };

    case 'drop_session': {
      const { [action.liveId]: _removed, ...rest } = state.sessions;
      return { ...state, sessions: rest, prompts: prunePromptsFor(state.prompts, action.liveId) };
    }

    case 'notice':
      return { ...state, notices: [action.notice, ...state.notices].slice(0, MAX_NOTICES) };

    case 'dismiss_notice':
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };

    case 'event':
      return reduceEvent(state, action.event, action.now);

    default:
      return state;
  }
}

function reduceEvent(state: ChatState, event: RpcEvent, now: number): ChatState {
  const type = event.type;
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const liveId = event.session_id ?? '';

  // Stored-key events (title, background results) carry no live id in every case.
  if (type === 'session.title') {
    const storedKey = String(payload.session_id ?? '');
    const sessions = Object.fromEntries(
      Object.entries(state.sessions).map(([id, s]) =>
        s.storedKey === storedKey ? [id, { ...s, title: String(payload.title ?? s.title) }] : [id, s],
      ),
    );
    return { ...state, sessions };
  }

  if (type === 'background.complete') {
    const text = String(payload.text ?? '').trim() || 'Background task finished.';
    return reduce(state, {
      type: 'notice',
      notice: { id: itemId('bg', now), text, tone: text.startsWith('error') ? 'error' : 'info', storedKey: null, at: now },
    });
  }

  if (!liveId) return state;

  const session = ensure(state, liveId);

  switch (type) {
    case 'session.info': {
      const info = payload as Partial<SessionInfo>;
      let next = sessionInfoPatch(session, info);
      if (typeof info.running === 'boolean') next = { ...next, running: info.running };
      if (info.running === false) {
        next = { ...next, thinking: '', statusLine: '' };
        return put({ ...state, prompts: prunePromptsFor(state.prompts, liveId) }, next);
      }
      return put(state, next);
    }

    case 'message.start':
      return put(state, { ...session, running: true, streaming: '', thinking: '', statusLine: '', queued: null, lastError: null });

    case 'message.delta':
      return put(state, { ...session, streaming: session.streaming + String(payload.text ?? '') });

    case 'message.interim': {
      // Commits the text so far as its own assistant message, between tool calls.
      const text = String(payload.text ?? session.streaming);
      if (!text) return state;
      const item: ChatItem = { kind: 'assistant', id: itemId('a', now), text, status: 'complete' };
      return put(state, { ...session, items: [...session.items, item], streaming: '' });
    }

    case 'message.complete': {
      const status = (payload.status as 'complete' | 'interrupted' | 'error') ?? 'complete';
      const finalText = String(payload.text ?? '') || session.streaming;
      const usage = (payload.usage as Usage | undefined) ?? session.usage;
      const items = [...session.items];
      if (finalText) {
        items.push({ kind: 'assistant', id: itemId('a', now), text: finalText, status, usage: usage ?? undefined });
      }
      const notice: Notice | null =
        status === 'error'
          ? { id: itemId('n', now), text: finalText || 'The turn failed.', tone: 'error', storedKey: session.storedKey, at: now }
          : null;
      const next = put(state, {
        ...session,
        items,
        streaming: '',
        thinking: '',
        statusLine: '',
        usage,
        lastError: status === 'error' ? finalText : null,
      });
      return notice ? reduce(next, { type: 'notice', notice }) : next;
    }

    case 'thinking.delta':
      return put(state, { ...session, thinking: String(payload.text ?? '') });

    case 'reasoning.delta':
    case 'reasoning.available':
      return state;

    case 'status.update': {
      const kind = String(payload.kind ?? '');
      const text = String(payload.text ?? '');
      if (!text || kind === 'status') return state;
      return put(state, { ...session, statusLine: text });
    }

    case 'tool.generating':
      return put(state, { ...session, thinking: `Preparing ${String(payload.name ?? 'a tool')}…` });

    case 'tool.start': {
      const toolId = String(payload.tool_id ?? itemId('t', now));
      const item: ChatItem = {
        kind: 'tool',
        id: toolId,
        toolId,
        name: String(payload.name ?? 'tool'),
        context: String(payload.context ?? ''),
        done: false,
      };
      return put(state, { ...session, items: [...session.items, item], thinking: '' });
    }

    case 'tool.output_risk': {
      const toolId = String(payload.tool_id ?? '');
      const items = session.items.map((item) =>
        item.kind === 'tool' && item.toolId === toolId ? { ...item, risk: String(payload.risk ?? 'risk') } : item,
      );
      return put(state, { ...session, items });
    }

    case 'tool.complete': {
      const toolId = String(payload.tool_id ?? '');
      const done = {
        summary: typeof payload.summary === 'string' ? payload.summary : undefined,
        durationS: typeof payload.duration_s === 'number' ? payload.duration_s : undefined,
      };
      const exists = session.items.some((item) => item.kind === 'tool' && item.toolId === toolId);
      const items: ChatItem[] = exists
        ? session.items.map((item) => (item.kind === 'tool' && item.toolId === toolId ? { ...item, done: true, ...done } : item))
        : [
            ...session.items,
            { kind: 'tool', id: toolId, toolId, name: String(payload.name ?? 'tool'), context: '', done: true, ...done },
          ];
      return put(state, { ...session, items });
    }

    case 'approval.request': {
      const choices = Array.isArray(payload.choices) && payload.choices.length ? (payload.choices as ApprovalChoice[]) : DEFAULT_CHOICES;
      const prompt: PendingPrompt = {
        id: itemId('p', now),
        kind: 'approval',
        liveId,
        requestId: null,
        receivedAt: now,
        command: String(payload.command ?? ''),
        description: String(payload.description ?? ''),
        choices,
      };
      return { ...state, prompts: [...state.prompts, prompt] };
    }

    case 'clarify.request': {
      const prompt: PendingPrompt = {
        id: itemId('p', now),
        kind: 'clarify',
        liveId,
        requestId: String(payload.request_id ?? ''),
        receivedAt: now,
        question: String(payload.question ?? ''),
        options: Array.isArray(payload.choices) ? (payload.choices as string[]) : null,
      };
      return { ...state, prompts: [...state.prompts, prompt] };
    }

    case 'sudo.request': {
      const prompt: PendingPrompt = {
        id: itemId('p', now),
        kind: 'sudo',
        liveId,
        requestId: String(payload.request_id ?? ''),
        receivedAt: now,
      };
      return { ...state, prompts: [...state.prompts, prompt] };
    }

    case 'secret.request': {
      const prompt: PendingPrompt = {
        id: itemId('p', now),
        kind: 'secret',
        liveId,
        requestId: String(payload.request_id ?? ''),
        receivedAt: now,
        prompt: String(payload.prompt ?? 'Enter the secret'),
        envVar: String(payload.env_var ?? ''),
      };
      return { ...state, prompts: [...state.prompts, prompt] };
    }

    case 'sudo.expire':
    case 'secret.expire': {
      const requestId = String(payload.request_id ?? '');
      return { ...state, prompts: state.prompts.filter((p) => p.requestId !== requestId) };
    }

    case 'error': {
      const message = String(payload.message ?? 'Something went wrong.');
      const notice: Notice = { id: itemId('n', now), text: message, tone: 'error', storedKey: session.storedKey, at: now };
      return reduce(put(state, { ...session, running: false, thinking: '', statusLine: '', lastError: message }), {
        type: 'notice',
        notice,
      });
    }

    default:
      return state;
  }
}

// Prompts that have passed their server-side window no longer need an answer.
export function livePrompts(prompts: PendingPrompt[], now: number): PendingPrompt[] {
  return prompts.filter((p) => now - p.receivedAt < PROMPT_WINDOW_MS[p.kind]);
}
