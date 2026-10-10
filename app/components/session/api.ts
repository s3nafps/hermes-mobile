import { Share } from 'react-native';

import { unwrap, type GatewayHttp } from '@/lib/gateway';
import { RpcError, type RpcClient } from '@/lib/gateway/rpc';

import { toCheckpointList, toModelOptions, toStoredSession, toTranscript } from './normalize';
import type {
  CheckpointList,
  ConfigSetResult,
  ModelOptions,
  ReasoningLevel,
  StoredSession,
  TranscriptLine,
} from './types';

// REST calls go through the typed openapi-fetch client. Paths and bodies are typed in
// schema.ts, but the responses are untyped, so their readers live in normalize.ts.
// RPC calls go through the chat socket, using the live session id.

export const OFFLINE_MESSAGE = 'The gateway is not connected.';
export const MODEL_BUSY_MESSAGE = 'Wait for the reply to finish before changing the model.';
export const REASONING_BUSY_MESSAGE = 'Wait for the reply to finish before changing the reasoning level.';

// Code 4009 means the server refused the change because a turn is running.
export function friendlyError(error: unknown, busyMessage: string): Error {
  if (error instanceof RpcError && error.code === 4009) return new Error(busyMessage);
  return error instanceof Error ? error : new Error('Something went wrong.');
}

// ---- Stored session (REST) -------------------------------------------------

export async function fetchSession(http: GatewayHttp, id: string): Promise<StoredSession> {
  const raw = unwrap(await http.GET('/api/sessions/{session_id}', { params: { path: { session_id: id } } }));
  return toStoredSession(raw);
}

// An empty title clears it on the gateway.
export async function renameSession(http: GatewayHttp, id: string, title: string): Promise<void> {
  unwrap(
    await http.PATCH('/api/sessions/{session_id}', {
      params: { path: { session_id: id } },
      body: { title: title.trim() || null },
    }),
  );
}

export async function deleteSession(http: GatewayHttp, id: string): Promise<void> {
  unwrap(await http.DELETE('/api/sessions/{session_id}', { params: { path: { session_id: id } } }));
}

export async function fetchTranscript(http: GatewayHttp, id: string, limit: number): Promise<TranscriptLine[]> {
  const raw = unwrap(
    await http.GET('/api/sessions/{session_id}/messages', {
      params: { path: { session_id: id }, query: { limit, offset: 0 } },
    }),
  );
  return toTranscript(raw);
}

// The export is returned as text (JSON when the gateway sends an object).
export async function fetchExport(http: GatewayHttp, id: string): Promise<string> {
  const raw = unwrap(await http.GET('/api/sessions/{session_id}/export', { params: { path: { session_id: id } } }));
  if (raw === undefined || raw === null) throw new Error('The gateway returned an empty export.');
  return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
}

// Opens the system share sheet with the export text.
export async function shareExport(text: string, title: string): Promise<void> {
  await Share.share({ title, message: text });
}

// ---- Checkpoints (RPC) -----------------------------------------------------

export async function fetchCheckpoints(rpc: RpcClient, liveId: string): Promise<CheckpointList> {
  return toCheckpointList(await rpc.call<unknown>('rollback.list', { session_id: liveId }));
}

// The server refuses a full rollback while the session is running. That error text is shown as is.
export async function restoreCheckpoint(rpc: RpcClient, liveId: string, hash: string): Promise<void> {
  await rpc.call('rollback.restore', { session_id: liveId, hash });
}

// ---- Model and reasoning (RPC) ---------------------------------------------

export async function fetchModelOptions(rpc: RpcClient, liveId: string): Promise<ModelOptions> {
  return toModelOptions(await rpc.call<unknown>('model.options', { session_id: liveId }));
}

// Sets one key on the live session. confirm_expensive_model is sent only after the user agrees.
export async function setConfig(
  rpc: RpcClient,
  liveId: string,
  key: 'model' | 'reasoning',
  value: string | ReasoningLevel,
  confirmExpensive = false,
): Promise<ConfigSetResult> {
  const params: Record<string, unknown> = { key, value, session_id: liveId };
  if (confirmExpensive) params.confirm_expensive_model = true;
  const result = await rpc.call<ConfigSetResult | null | undefined>('config.set', params);
  return result ?? {};
}

// Makes a model and reasoning level the gateway default for new chats. The gateway writes both to config.yaml.
// The model goes first, since it can ask to confirm an expensive model. The level is sent only after that.
export async function makeGlobalDefault(
  rpc: RpcClient,
  liveId: string,
  defaults: { model: string; provider: string; level: ReasoningLevel | null },
  confirmExpensive = false,
): Promise<ConfigSetResult> {
  if (defaults.model) {
    const value = [defaults.model, defaults.provider ? `--provider ${defaults.provider}` : '', '--global']
      .filter(Boolean)
      .join(' ');
    const params: Record<string, unknown> = { key: 'model', value, session_id: liveId };
    if (confirmExpensive) params.confirm_expensive_model = true;
    const result = (await rpc.call<ConfigSetResult | null | undefined>('config.set', params)) ?? {};
    if (result.confirm_required && !confirmExpensive) return result;
  }
  if (defaults.level) {
    await rpc.call('config.set', { key: 'reasoning', value: defaults.level, session_id: liveId, scope: 'global' });
  }
  return {};
}
