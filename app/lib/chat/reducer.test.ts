import { describe, expect, it } from 'vitest';

import type { WireMessage } from './types';
import { EMPTY_STATE, itemsFromWire, reduce, type ChatState } from './reducer';

const NOW = 1_000;
const LIVE = 'live-1';

function event(type: string, payload: Record<string, unknown> = {}) {
  return { type: 'event' as const, event: { type, session_id: LIVE, payload }, now: NOW };
}

function started(state: ChatState = EMPTY_STATE): ChatState {
  return reduce(state, event('message.start'));
}

describe('streaming a reply', () => {
  it('builds the reply from deltas and commits it when the turn completes', () => {
    let state = started();
    state = reduce(state, event('message.delta', { text: 'Hel' }));
    state = reduce(state, event('message.delta', { text: 'lo' }));

    expect(state.sessions[LIVE].streaming).toBe('Hello');
    expect(state.sessions[LIVE].running).toBe(true);

    state = reduce(state, event('message.complete', { status: 'complete' }));

    expect(state.sessions[LIVE].streaming).toBe('');
    expect(state.sessions[LIVE].items).toEqual([
      expect.objectContaining({ kind: 'assistant', text: 'Hello', status: 'complete' }),
    ]);
  });

  it('turns a failed turn into an error notice and keeps the message', () => {
    const state = reduce(started(), event('message.complete', { status: 'error', text: 'Provider is down' }));

    expect(state.sessions[LIVE].lastError).toBe('Provider is down');
    expect(state.notices).toEqual([expect.objectContaining({ tone: 'error', text: 'Provider is down' })]);
  });

  it('clears the thinking line when the server says the session stopped running', () => {
    let state = started();
    state = reduce(state, event('thinking.delta', { text: 'hmm' }));
    state = reduce(state, event('session.info', { running: false }));

    expect(state.sessions[LIVE].running).toBe(false);
    expect(state.sessions[LIVE].thinking).toBe('');
  });
});

describe('sending a message', () => {
  it('shows the user message at once and marks it failed when the gateway rejects it', () => {
    let state = reduce(EMPTY_STATE, { type: 'local_user', liveId: LIVE, id: 'u1', text: 'hi' });

    expect(state.sessions[LIVE].items).toEqual([{ kind: 'user', id: 'u1', text: 'hi', attachments: undefined }]);

    state = reduce(state, { type: 'user_failed', liveId: LIVE, id: 'u1', message: 'Not allowed' });

    expect(state.sessions[LIVE].items[0]).toMatchObject({ kind: 'user', id: 'u1', failed: true });
    expect(state.sessions[LIVE].items[1]).toMatchObject({ kind: 'notice', tone: 'error', text: 'Not allowed' });
  });

  it('keeps the attachments that were sent with a message', () => {
    const state = reduce(EMPTY_STATE, {
      type: 'local_user',
      liveId: LIVE,
      id: 'u2',
      text: 'read this',
      attachments: [{ name: 'notes.txt', kind: 'file', refText: '@file:notes.txt' }],
    });

    expect(state.sessions[LIVE].items[0]).toMatchObject({
      kind: 'user',
      attachments: [{ name: 'notes.txt', kind: 'file', refText: '@file:notes.txt' }],
    });
  });
});

describe('restoring a conversation', () => {
  it('turns saved messages into chat items in order', () => {
    const wire = [
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi there' },
      { role: 'tool', name: 'terminal', context: 'ls' },
    ] as WireMessage[];

    expect(itemsFromWire(wire)).toEqual([
      { kind: 'user', id: 'h0', text: 'hello' },
      { kind: 'assistant', id: 'h1', text: 'hi there', status: 'complete' },
      expect.objectContaining({ kind: 'tool', id: 'h2', name: 'terminal', context: 'ls', done: true }),
    ]);
  });
});

describe('reconnecting with sends still on screen', () => {
  function hydrated(state: ChatState, messages: WireMessage[], extra: Partial<Parameters<typeof reduce>[1]> = {}): ChatState {
    return reduce(state, {
      type: 'hydrate',
      liveId: LIVE,
      storedKey: 'stored-1',
      messages,
      info: {},
      running: false,
      inflight: null,
      inflightUser: null,
      queued: null,
      waiting: false,
      ...extra,
    } as Parameters<typeof reduce>[1]);
  }

  function unsure(text: string): ChatState {
    const sent = reduce(EMPTY_STATE, { type: 'local_user', liveId: LIVE, id: 'u1', text });
    return reduce(sent, { type: 'user_unknown', liveId: LIVE, id: 'u1' });
  }

  it('keeps an unsure message when the gateway does not show it', () => {
    const state = hydrated(unsure('deploy it'), [{ role: 'user', text: 'earlier question' }] as WireMessage[]);

    expect(state.sessions[LIVE].items).toEqual([
      { kind: 'user', id: 'h0', text: 'earlier question' },
      expect.objectContaining({ kind: 'user', id: 'u1', text: 'deploy it', unknown: true }),
    ]);
  });

  it('drops an unsure message once the gateway shows its text, so it is not sent twice', () => {
    const state = hydrated(unsure('deploy it'), [{ role: 'user', text: 'deploy it' }] as WireMessage[]);

    expect(state.sessions[LIVE].items).toEqual([{ kind: 'user', id: 'h0', text: 'deploy it' }]);
  });

  it('treats an unsure message as delivered when it is the turn the gateway is running', () => {
    const state = hydrated(unsure('deploy it'), [], { running: true, inflightUser: 'deploy it' });

    expect(state.sessions[LIVE].items).toEqual([]);
  });

  it('keeps a failed message through a reconnect, since the gateway never had it', () => {
    let state = reduce(EMPTY_STATE, { type: 'local_user', liveId: LIVE, id: 'u1', text: 'hi' });
    state = reduce(state, { type: 'user_failed', liveId: LIVE, id: 'u1', message: 'Not allowed' });
    state = hydrated(state, []);

    expect(state.sessions[LIVE].items).toEqual([expect.objectContaining({ kind: 'user', id: 'u1', failed: true })]);
  });

  it('flags a session the agent is waiting on, and clears the flag when the turn ends', () => {
    let state = hydrated(EMPTY_STATE, [], { running: true, waiting: true });
    expect(state.sessions[LIVE].waiting).toBe(true);

    state = reduce(state, event('message.complete', { status: 'interrupted' }));
    expect(state.sessions[LIVE].waiting).toBe(false);
  });
});
