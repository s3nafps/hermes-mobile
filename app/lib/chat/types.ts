// Wire types for the chat side of the gateway JSON-RPC protocol (Hermes 0.19.0).
// Source of truth: scratchpad rpc-spec, derived from tui_gateway/server.py.

export type Usage = {
  model?: string;
  input?: number;
  output?: number;
  reasoning?: number;
  total?: number;
  calls?: number;
  context_percent?: number;
  context_used?: number;
  context_max?: number;
  compressions?: number;
};

// One entry of a stored conversation, as shown to the UI.
export type WireMessage =
  | { role: 'user' | 'system'; text: string }
  | { role: 'assistant'; text: string; reasoning?: string }
  | { role: 'tool'; name: string; context: string };

export type ApprovalChoice = 'once' | 'session' | 'always' | 'deny';

// Subset of session.info that the app reads.
export type SessionInfo = {
  model: string;
  provider: string;
  cwd: string;
  approval_mode: 'manual' | 'smart' | 'off';
  yolo: boolean;
  running: boolean;
  title: string;
  stored_session_id: string;
  usage: Usage;
  reasoning_effort: string;
  fast: boolean;
  profile_name: string;
};

// A photo or file sent with a chat message. refText is the reference the agent reads
// for a file; images are attached to the session and need no reference in the text.
// previewUri is this device's copy of a photo, for the thumbnail. It is not sent or stored.
export type SentAttachment = { name: string; kind: 'image' | 'file'; refText?: string; previewUri?: string };

// How long the server keeps each kind of prompt open before it gives up.
// Approvals have no expire event, so the app hides them when the window closes.
export const PROMPT_WINDOW_MS = {
  approval: 60_000,
  clarify: 300_000,
  sudo: 120_000,
  secret: 300_000,
} as const;
