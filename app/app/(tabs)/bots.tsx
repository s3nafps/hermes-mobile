import { router } from 'expo-router';

import { activateBot, loadRoster } from '@/components/bots/api';
import { botHref, botNewHref } from '@/components/bots/routes';
import type { BotProfile, BotRoster } from '@/components/bots/types';
import { useRefetchOnFocus } from '@/components/tasks/useRefetchOnFocus';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
} from '@/components/ui';
import { requireHttp } from '@/components/bots/shared';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// The bot roster: every Hermes profile, with the active one marked. Tapping a row opens its page.
export default function BotsScreen() {
  const { http } = useGateway();
  const roster = useGatewayQuery<BotRoster>(
    async () => loadRoster(requireHttp(http)),
    [http],
  );
  useRefetchOnFocus(roster.refetch);

  const activate = useAction(async (name: string) => {
    await activateBot(requireHttp(http), name);
    return name;
  });

  const onActivate = async (name: string) => {
    if (await activate.run(name)) roster.refetch();
  };

  const data = roster.data;
  const newBotButton = <Button label="New bot" compact onPress={() => router.push(botNewHref())} />;

  return (
    <Screen refreshing={roster.loading} onRefresh={roster.refetch}>
      <ScreenTitle
        title="Bots"
        subtitle="Each bot has its own persona, model and skills."
        action={newBotButton}
      />

      {roster.loading && !data ? <LoadingState label="Loading bots…" /> : null}
      {roster.error && !data ? <ErrorState message={roster.error} onRetry={roster.refetch} /> : null}
      {roster.error && data ? <InlineNotice tone="danger">{roster.error}</InlineNotice> : null}
      {activate.error ? <InlineNotice tone="danger">{activate.error}</InlineNotice> : null}

      {data && data.bots.length === 0 ? (
        <EmptyState
          title="No bots yet"
          body="Create a bot to give the agent its own persona, model and skills."
          action={<Button label="New bot" onPress={() => router.push(botNewHref())} />}
        />
      ) : null}

      {data && data.bots.length > 0 ? (
        <Section label="Your bots">
          {data.bots.map((bot, index) => (
            <Row
              key={bot.name}
              title={bot.name}
              subtitle={subtitleOf(bot)}
              value={bot.model ?? undefined}
              onPress={() => router.push(botHref(bot.name))}
              last={index === data.bots.length - 1}
              right={
                bot.isActive ? (
                  <Badge label="Active" tone="accent" />
                ) : (
                  <Button
                    label="Use"
                    variant="secondary"
                    compact
                    loading={activate.pending}
                    onPress={() => void onActivate(bot.name)}
                  />
                )
              }
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function subtitleOf(bot: BotProfile): string {
  const parts = [bot.isDefault ? 'Default profile' : null, bot.description || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No description yet';
}
