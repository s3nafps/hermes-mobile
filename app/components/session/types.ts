// Shapes for the session screens. The session REST endpoints return {} in the generated
// schema and the rollback and model RPCs are not typed either, so these are hand-typed.
// Field names come from the endpoint notes and are read defensively in normalize.ts.

// One saved chat from GET /api/sessions/{session_id}. Unverified field names.
export type StoredSession = {
  title: string;
  model: string;
  // Epoch seconds.
  startedAt: number | null;
  messageCount: number | null;
};

// One line of the transcript from GET /api/sessions/{session_id}/messages. Unverified.
export type TranscriptLine = {
  speaker: string;
  text: string;
};

// One restore point from rollback.list. The timestamp is already formatted for display.
export type Checkpoint = {
  hash: string;
  message: string;
  when: string;
};

export type CheckpointList = {
  enabled: boolean;
  checkpoints: Checkpoint[];
};

// One provider from model.options, with the models it offers.
export type ProviderOption = {
  slug: string;
  name: string;
  models: string[];
  authenticated: boolean;
  isCurrent: boolean;
};

export type ModelOptions = {
  providers: ProviderOption[];
  model: string;
  provider: string;
};

export type ReasoningLevel = 'low' | 'medium' | 'high';

// Reply from config.set. confirm_required asks the user before an expensive model is used.
export type ConfigSetResult = {
  confirm_required?: boolean;
  confirm_message?: string;
};
