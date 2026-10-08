// A Hermes profile, shown as a bot. GET /api/profiles is untyped in the generated
// schema, so api.ts reads these fields from the response defensively.
export type BotProfile = {
  name: string;
  description: string;
  model: string | null;
  provider: string | null;
  // The built-in default profile. It cannot be deleted.
  isDefault: boolean;
  // The sticky active profile from GET /api/profiles/active.
  isActive: boolean;
};

export type BotRoster = {
  bots: BotProfile[];
  activeName: string | null;
};

// One model the gateway offers, from GET /api/model/options.
export type ModelChoice = {
  provider: string;
  providerLabel: string;
  model: string;
};
