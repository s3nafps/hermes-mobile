// Hand-written shapes for the messaging, pairing and webhook endpoints. The generated
// schema leaves their responses untyped, so these describe what the screens need.

export type PlatformGroup = 'connected' | 'setup' | 'other';

export type MessagingPlatform = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  connected: boolean;
  needsSetup: boolean;
  group: PlatformGroup;
};

export type TestResult = { ok: boolean; text: string };

export type PendingCode = {
  key: string;
  platform: string | null;
  code: string;
  who: string | null;
  // Epoch milliseconds, or null when the response does not say when the code expires.
  expiresAt: number | null;
};

export type ApprovedUser = {
  key: string;
  platform: string | null;
  userId: string | null;
  who: string | null;
  approvedAt: string | null;
};

export type PairingState = {
  pending: PendingCode[];
  approved: ApprovedUser[];
};

export type WebhookRoute = {
  name: string;
  description: string | null;
  route: string | null;
  deliver: string | null;
  events: string[];
  enabled: boolean;
};

export type WebhookState = {
  routes: WebhookRoute[];
  // null when the response does not say whether the webhook platform is on.
  platformEnabled: boolean | null;
};

export type WebhookDraft = {
  name: string;
  description: string;
  events: string[];
  prompt: string;
  deliver: string;
  deliverChatId: string;
  secret: string;
};
