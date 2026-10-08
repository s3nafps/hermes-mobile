import { Stack } from 'expo-router';
import { useState } from 'react';

import { requireHttp } from '@/components/bots/shared';
import { confirmAction } from '@/components/control/confirm';
import { loadMemory, resetMemory, setMemoryProvider } from '@/components/memory/api';
import { ProviderSettingsSheet } from '@/components/memory/ProviderSettings';
import type { MemoryStatus } from '@/components/memory/types';
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
  Sheet,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// What the agent remembers, which provider stores it, and the controls for both.
export default function MemoryScreen() {
  const { http } = useGateway();
  const memory = useGatewayQuery<MemoryStatus>(async () => loadMemory(requireHttp(http)), [http]);
  const [providerOpen, setProviderOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const chooseProvider = useAction(async (provider: string) => {
    await setMemoryProvider(requireHttp(http), provider);
    return provider;
  });
  const reset = useAction(async () => {
    await resetMemory(requireHttp(http));
    return true;
  });

  const onChoose = async (provider: string) => {
    if (await chooseProvider.run(provider)) memory.refetch();
  };

  const onReset = () =>
    confirmAction({
      title: 'Reset memory?',
      body: 'Everything the agent remembers is erased. This cannot be undone.',
      action: 'Reset',
      destructive: true,
      onConfirm: async () => {
        if (await reset.run()) memory.refetch();
      },
    });

  const data = memory.data;
  const currentProvider = data?.providers.find((item) => item.name === data.provider);

  return (
    <Screen refreshing={memory.loading} onRefresh={memory.refetch}>
      <Stack.Screen options={{ title: 'Memory' }} />
      <ScreenTitle title="Memory" subtitle="What the agent remembers across chats." />

      {memory.loading && !data ? <LoadingState label="Loading memory…" /> : null}
      {memory.error && !data ? <ErrorState message={memory.error} onRetry={memory.refetch} /> : null}
      {memory.error && data ? <InlineNotice tone="danger">{memory.error}</InlineNotice> : null}
      {chooseProvider.error ? <InlineNotice tone="danger">{chooseProvider.error}</InlineNotice> : null}

      {data ? (
        <>
          <Section label="Provider">
            <Row
              title={data.provider ?? 'No provider set'}
              subtitle={currentProvider?.description ?? currentProvider?.label ?? 'Stores what the agent remembers.'}
              right={<Button label="Change" variant="secondary" compact onPress={() => setProviderOpen(true)} />}
              last={!data.provider}
            />
            {data.provider ? (
              <Row
                title="Provider settings"
                subtitle="Keys and options for this provider."
                onPress={() => setSettingsOpen(true)}
                last
              />
            ) : null}
          </Section>

          {data.stats.length > 0 ? (
            <Section label="Stats">
              {data.stats.map((stat, index) => (
                <Row
                  key={stat.label}
                  title={stat.label}
                  value={stat.value}
                  last={index === data.stats.length - 1}
                />
              ))}
            </Section>
          ) : null}

          <Section label={`Remembered (${data.entries.length})`}>
            {data.entries.length === 0 ? (
              <EmptyState title="Nothing remembered yet" body="Entries appear here as the agent saves them." />
            ) : (
              data.entries.map((entry, index) => (
                <Row
                  key={entry.id}
                  title={entry.text}
                  subtitle={entry.detail ?? undefined}
                  last={index === data.entries.length - 1}
                />
              ))
            )}
          </Section>

          {reset.error ? <InlineNotice tone="danger">{reset.error}</InlineNotice> : null}
          <Button label="Reset memory" variant="danger" onPress={onReset} loading={reset.pending} />
        </>
      ) : null}

      <Sheet visible={providerOpen} onClose={() => setProviderOpen(false)} title="Memory provider">
        {data && data.providers.length === 0 ? (
          <EmptyState title="No providers listed" body="The gateway did not list any memory providers." />
        ) : null}
        {data
          ? data.providers.map((item, index) => (
              <Row
                key={item.name}
                title={item.label}
                subtitle={item.description ?? undefined}
                value={item.name === data.provider ? 'Current' : undefined}
                last={index === data.providers.length - 1}
                onPress={() => {
                  setProviderOpen(false);
                  void onChoose(item.name);
                }}
              />
            ))
          : null}
      </Sheet>

      <ProviderSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={data?.provider ?? null}
      />
    </Screen>
  );
}
