import { untyped } from '@/components/control/client';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import { firstFlag, firstText, isRecord, nonNull, recordsUnder, stringsOf, type Raw } from './read';
import type { WebhookDraft, WebhookRoute, WebhookState } from './types';

// GET /api/webhooks returns {} in the generated schema. The reader accepts a list or a
// {webhooks: []} wrapper. It also looks for a flag saying whether the webhook platform
// is on, either at the top level or under a platform object.

const LIST_KEYS = ['webhooks', 'routes', 'subscriptions', 'items'];
const PLATFORM_FLAG_KEYS = ['platform_enabled', 'webhook_platform_enabled', 'webhooks_enabled'];

function platformEnabledOf(raw: unknown): boolean | null {
  if (!isRecord(raw)) return null;
  const direct = firstFlag(raw, PLATFORM_FLAG_KEYS);
  if (direct !== null) return direct;
  for (const key of ['platform', 'webhook_platform']) {
    const nested = raw[key];
    if (isRecord(nested)) {
      const flag = firstFlag(nested, ['enabled', 'is_enabled']);
      if (flag !== null) return flag;
    }
  }
  return null;
}

function toRoute(raw: Raw): WebhookRoute | null {
  const name = firstText(raw, ['name', 'id']);
  if (!name) return null;
  const deliver = firstText(raw, ['deliver', 'deliver_to', 'target', 'delivery']);
  const chat = firstText(raw, ['deliver_chat_id', 'chat_id']);
  return {
    name,
    description: firstText(raw, ['description']),
    route: firstText(raw, ['route', 'route_path', 'path', 'url', 'endpoint']),
    deliver: deliver && chat ? `${deliver} (${chat})` : (deliver ?? chat),
    events: stringsOf(raw.events),
    enabled: firstFlag(raw, ['enabled', 'is_enabled']) ?? true,
  };
}

export async function loadWebhooks(http: GatewayHttp): Promise<WebhookState> {
  const raw = untyped<unknown>(await http.GET('/api/webhooks'));
  return {
    routes: recordsUnder(raw, LIST_KEYS).map(toRoute).filter(nonNull),
    platformEnabled: platformEnabledOf(raw),
  };
}

export async function createWebhook(http: GatewayHttp, draft: WebhookDraft): Promise<void> {
  const description = draft.description.trim();
  const prompt = draft.prompt.trim();
  const chat = draft.deliverChatId.trim();
  const secret = draft.secret.trim();
  unwrap(
    await http.POST('/api/webhooks', {
      body: {
        name: draft.name.trim(),
        description: description || null,
        events: draft.events,
        prompt: prompt || null,
        skills: [],
        deliver: draft.deliver.trim() || 'log',
        deliver_only: false,
        deliver_chat_id: chat || null,
        secret: secret || null,
      },
    }),
  );
}

export async function enableWebhookPlatform(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/webhooks/enable'));
}

export async function setWebhookEnabled(http: GatewayHttp, name: string, enabled: boolean): Promise<void> {
  unwrap(
    await http.PUT('/api/webhooks/{name}/enabled', {
      params: { path: { name } },
      body: { enabled },
    }),
  );
}

export async function deleteWebhook(http: GatewayHttp, name: string): Promise<void> {
  unwrap(await http.DELETE('/api/webhooks/{name}', { params: { path: { name } } }));
}
