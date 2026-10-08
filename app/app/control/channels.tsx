import { Stack } from 'expo-router';
import { useState } from 'react';

import { NOT_CONNECTED } from '@/components/control/client';
import { confirmAction } from '@/components/control/confirm';
import { PlatformRow } from '@/components/messaging/PlatformRow';
import { loadPlatforms, restartGateway, setPlatformEnabled, testPlatform } from '@/components/messaging/platformsApi';
import type { MessagingPlatform, PlatformGroup, TestResult } from '@/components/messaging/types';
import {
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
import { messageOf, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

const GROUPS: { group: PlatformGroup; label: string }[] = [
  { group: 'connected', label: 'Connected' },
  { group: 'setup', label: 'Needs setup' },
  { group: 'other', label: 'Other platforms' },
];

// Messaging platforms, grouped by state. Each one can be switched on or off, tested,
// and the gateway can be restarted to apply changes.
export default function ChannelsScreen() {
  const { http } = useGateway();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [restarted, setRestarted] = useState(false);

  const platforms = useGatewayQuery<MessagingPlatform[]>(
    async () => {
      if (!http) throw new Error(NOT_CONNECTED);
      return loadPlatforms(http);
    },
    [http],
    { pollMs: 15_000 },
  );

  const toggle = useAction(async (id: string, enabled: boolean) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await setPlatformEnabled(http, id, enabled);
    return true;
  });

  // A failed test is shown on its row, so the action itself never throws.
  const test = useAction(async (id: string): Promise<TestResult> => {
    if (!http) throw new Error(NOT_CONNECTED);
    try {
      return await testPlatform(http, id);
    } catch (caught) {
      return { ok: false, text: messageOf(caught) };
    }
  });

  const restart = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    await restartGateway(http);
    return true;
  });

  const onToggle = async (platform: MessagingPlatform, enabled: boolean) => {
    setBusyId(platform.id);
    await toggle.run(platform.id, enabled);
    setBusyId(null);
    platforms.refetch();
  };

  const onTest = async (id: string) => {
    setTestingId(id);
    const result = await test.run(id);
    setTestingId(null);
    if (result) setResults((prev) => ({ ...prev, [id]: result }));
  };

  const onRestart = () =>
    confirmAction({
      title: 'Restart the gateway?',
      body: 'The gateway restarts in the background. Platforms may disconnect for a moment.',
      action: 'Restart',
      onConfirm: async () => {
        setRestarted(false);
        if (await restart.run()) setRestarted(true);
        platforms.refetch();
      },
    });

  const list = platforms.data;
  const writeError = toggle.error ?? restart.error;

  return (
    <Screen refreshing={platforms.loading && !!list} onRefresh={platforms.refetch}>
      <Stack.Screen options={{ title: 'Channels' }} />
      <ScreenTitle title="Channels" subtitle="Messaging platforms the agent can talk through." />

      {writeError ? <InlineNotice tone="danger">{writeError}</InlineNotice> : null}
      {restarted ? <InlineNotice tone="info">Restart requested. Status updates in a moment.</InlineNotice> : null}

      {!list && platforms.loading ? <LoadingState label="Loading platforms…" /> : null}
      {!list && platforms.error ? <ErrorState message={platforms.error} onRetry={platforms.refetch} /> : null}
      {list && list.length === 0 ? (
        <EmptyState title="No platforms yet" body="The gateway did not list any messaging platforms." />
      ) : null}

      {list
        ? GROUPS.map(({ group, label }) => {
            const items = list.filter((platform) => platform.group === group);
            if (items.length === 0) return null;
            return (
              <Section key={group} label={label}>
                {items.map((platform, index) => (
                  <PlatformRow
                    key={platform.id}
                    platform={platform}
                    last={index === items.length - 1}
                    busy={busyId === platform.id}
                    testing={testingId === platform.id}
                    result={results[platform.id]}
                    onToggle={(enabled) => onToggle(platform, enabled)}
                    onTest={() => onTest(platform.id)}
                  />
                ))}
              </Section>
            );
          })
        : null}

      <Section label="Gateway">
        <Row
          title="Restart gateway"
          subtitle="Restarts the Hermes gateway in the background."
          last
          right={
            <Button
              label="Restart"
              variant="secondary"
              compact
              loading={restart.pending}
              disabled={restart.pending}
              onPress={onRestart}
            />
          }
        />
      </Section>
    </Screen>
  );
}
