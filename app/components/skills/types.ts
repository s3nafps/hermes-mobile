// Skills from GET /api/skills, the hub search, and the curator status. These endpoints
// are untyped in the generated schema, so api.ts reads them defensively.

export type InstalledSkill = {
  name: string;
  description: string;
  category: string | null;
  enabled: boolean;
};

export type HubSkill = {
  identifier: string;
  name: string;
  description: string;
  source: string | null;
  trust: string | null;
  installed: boolean;
};

export type CuratorStatus = {
  // null when the response does not say whether the curator is paused.
  paused: boolean | null;
  rows: { label: string; value: string }[];
};
