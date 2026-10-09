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

    expect(state.sessions[LIVE].items).toEqual([{ kind: 'user', id: 'u1', text: 'hi', attachments: undefined, pending: true }]);

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

  it('keeps an unsure message even when the gateway shows its text, so the user decides', () => {
    // Matching text is not proof: a short reply such as "ok" can appear in any history.
    const state = hydrated(unsure('ok'), [{ role: 'user', text: 'Can you look at the logs?' }] as WireMessage[]);

    expect(state.sessions[LIVE].items).toEqual([
      { kind: 'user', id: 'h0', text: 'Can you look at the logs?' },
      expect.objectContaining({ kind: 'user', id: 'u1', text: 'ok', unknown: true }),
    ]);
  });

  it('shows a message the gateway is running once, and not twice next to its unsure copy', () => {
    const running = hydrated(EMPTY_STATE, [], { running: true, inflightUser: 'deploy it' });
    expect(running.sessions[LIVE].items).toEqual([{ kind: 'user', id: 'inflight', text: 'deploy it' }]);

    const withCopy = hydrated(unsure('deploy it'), [], { running: true, inflightUser: 'deploy it' });
    expect(withCopy.sessions[LIVE].items).toEqual([expect.objectContaining({ id: 'u1', unknown: true })]);
  });

  it('keeps a send that is still awaiting its answer through a reconnect', () => {
    const sent = reduce(EMPTY_STATE, { type: 'local_user', liveId: LIVE, id: 'u1', text: 'hi' });
    const state = hydrated(sent, []);

    expect(state.sessions[LIVE].items).toEqual([expect.objectContaining({ id: 'u1', pending: true })]);
  });

  it('drops a sent message on reconnect, since the gateway history has it once the turn completes', () => {
    let state = reduce(EMPTY_STATE, { type: 'local_user', liveId: LIVE, id: 'u1', text: 'hi' });
    state = reduce(state, { type: 'user_sent', liveId: LIVE, id: 'u1' });
    state = hydrated(state, [{ role: 'user', text: 'hi' }] as WireMessage[]);

    expect(state.sessions[LIVE].items).toEqual([{ kind: 'user', id: 'h0', text: 'hi' }]);
  });

  it('clears the waiting flag when the agent makes progress again', () => {
    let state = hydrated(EMPTY_STATE, [], { running: true, waiting: true });
    state = reduce(state, event('tool.start', { tool_id: 't1', name: 'terminal' }));

    expect(state.sessions[LIVE].waiting).toBe(false);
  });

  it('clears the waiting flag once the last prompt for the session is answered', () => {
    let state = hydrated(EMPTY_STATE, [], { running: true, waiting: true });
    state = reduce(state, event('approval.request', { command: 'ls', description: 'list files' }));
    expect(state.sessions[LIVE].waiting).toBe(true);

    state = reduce(state, { type: 'drop_prompt', id: state.prompts[0].id });
    expect(state.sessions[LIVE].waiting).toBe(false);
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
