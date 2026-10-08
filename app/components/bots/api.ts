import { untyped } from '@/components/control/client';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import { contentOf, firstText, flagOf, isRecord, listOf, textOf, type Raw } from './shared';
import type { BotProfile, BotRoster, ModelChoice } from './types';

// The profile endpoints return {} in the generated schema. Field names follow the
// endpoint notes: rows carry name, description and model, and /active returns
// `active` (the sticky default) and `current` (the profile this dashboard runs as).

function toBot(raw: Raw): BotProfile | null {
  const name = firstText(raw, ['name', 'id']);
  if (!name) return null;
  const model = isRecord(raw.model) ? raw.model : null;
  return {
    name,
    description: firstText(raw, ['description']) ?? '',
    model: model ? firstText(model, ['default', 'model']) : firstText(raw, ['model', 'model_name']),
    provider: model ? firstText(model, ['provider']) : firstText(raw, ['provider']),
    isDefault: flagOf(raw.is_default) === true || flagOf(raw.default) === true || name === 'default',
    isActive: false,
  };
}

function toModelChoices(raw: unknown): ModelChoice[] {
  const choices: ModelChoice[] = [];
  const providers = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.providers) ? raw.providers : [];
  for (const entry of providers) {
    if (!isRecord(entry)) continue;
    const slug = firstText(entry, ['slug', 'id', 'name']);
    if (!slug) continue;
    const label = firstText(entry, ['name', 'label']) ?? slug;
    const models: unknown[] = Array.isArray(entry.models) ? entry.models : [];
    for (const model of models) {
      const id = isRecord(model) ? firstText(model, ['id', 'model', 'name']) : textOf(model);
      if (id) choices.push({ provider: slug, providerLabel: label, model: id });
    }
  }
  return choices;
}

async function listBots(http: GatewayHttp): Promise<BotProfile[]> {
  const raw = untyped<unknown>(await http.GET('/api/profiles'));
  return listOf(raw, ['profiles', 'items'])
    .map(toBot)
    .filter((bot): bot is BotProfile => bot !== null);
}

async function getActiveName(http: GatewayHttp): Promise<string | null> {
  const raw = untyped<unknown>(await http.GET('/api/profiles/active'));
  if (!isRecord(raw)) return textOf(raw);
  return firstText(raw, ['active', 'name']);
}

// The roster is the profile list with the sticky active profile marked.
export async function loadRoster(http: GatewayHttp): Promise<BotRoster> {
  const [bots, activeName] = await Promise.all([listBots(http), getActiveName(http)]);
  return {
    bots: bots.map((bot) => ({ ...bot, isActive: bot.name === activeName })),
    activeName,
  };
}

export async function activateBot(http: GatewayHttp, name: string): Promise<void> {
  unwrap(await http.POST('/api/profiles/active', { body: { name } }));
}

export async function createBot(
  http: GatewayHttp,
  input: { name: string; cloneFrom: string | null; description: string },
): Promise<void> {
  unwrap(
    await http.POST('/api/profiles', {
      body: {
        name: input.name,
        clone_from: input.cloneFrom,
        clone_from_default: false,
        clone_all: false,
        no_skills: false,
        description: input.description.trim() || null,
        mcp_servers: [],
        keep_skills: [],
        hub_skills: [],
      },
    }),
  );
}

export async function setBotDescription(http: GatewayHttp, name: string, description: string): Promise<void> {
  unwrap(
    await http.PUT('/api/profiles/{name}/description', {
      params: { path: { name } },
      body: { description: description.trim() },
    }),
  );
}

export async function setBotModel(http: GatewayHttp, name: string, choice: ModelChoice): Promise<void> {
  unwrap(
    await http.PUT('/api/profiles/{name}/model', {
      params: { path: { name } },
      body: { provider: choice.provider, model: choice.model },
    }),
  );
}

export async function getBotPersona(http: GatewayHttp, name: string): Promise<string> {
  const raw = untyped<unknown>(await http.GET('/api/profiles/{name}/soul', { params: { path: { name } } }));
  return contentOf(raw, ['content', 'soul', 'text']);
}

export async function setBotPersona(http: GatewayHttp, name: string, content: string): Promise<void> {
  unwrap(await http.PUT('/api/profiles/{name}/soul', { params: { path: { name } }, body: { content } }));
}

// PATCH only renames. Making a bot the default goes through activateBot.
export async function renameBot(http: GatewayHttp, name: string, newName: string): Promise<void> {
  unwrap(await http.PATCH('/api/profiles/{name}', { params: { path: { name } }, body: { new_name: newName } }));
}

export async function deleteBot(http: GatewayHttp, name: string): Promise<void> {
  unwrap(await http.DELETE('/api/profiles/{name}', { params: { path: { name } } }));
}

export async function loadModelChoices(http: GatewayHttp): Promise<ModelChoice[]> {
  return toModelChoices(untyped<unknown>(await http.GET('/api/model/options')));
}
