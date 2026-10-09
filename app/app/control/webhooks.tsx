import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NOT_CONNECTED } from '@/components/control/client';
import { confirmAction } from '@/components/control/confirm';
import { WebhookForm } from '@/components/messaging/WebhookForm';
import { WebhookRow } from '@/components/messaging/WebhookRow';
import {
  createWebhook,
  deleteWebhook,
  enableWebhookPlatform,
  loadWebhooks,
  setWebhookEnabled,
} from '@/components/messaging/webhooksApi';
import type { WebhookDraft, WebhookRoute, WebhookState } from '@/components/messaging/types';
import {
  Button,
  Card,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';
import { themed } from '@/lib/theme';

// Incoming webhook routes. The webhook platform has to be on before routes can receive events.
export default function WebhooksScreen() {
  const { http } = useGateway();
  const [creating, setCreating] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [busyName, setBusyName] = useState<string | null>(null);

  const hooks = useGatewayQuery<WebhookState>(
    async () => {
      if (!http) throw new Error(NOT_CONNECTED);
      return loadWebhooks(http);
    },
    [http],
  );

  const enable = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    await enableWebhookPlatform(http);
    return true;
  });

  const toggle = useAction(async (name: string, enabled: boolean) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await setWebhookEnabled(http, name, enabled);
    return true;
  });

  const remove = useAction(async (name: string) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await deleteWebhook(http, name);
    return true;
  });

  const create = useAction(async (draft: WebhookDraft) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await createWebhook(http, draft);
    return true;
  });

  const onEnable = async () => {
    await enable.run();
    hooks.refetch();
  };

  const onToggle = async (route: WebhookRoute, enabled: boolean) => {
    setBusyName(route.name);
    await toggle.run(route.name, enabled);
    setBusyName(null);
    hooks.refetch();
  };

  const onDelete = (route: WebhookRoute) =>
    confirmAction({
      title: `Delete ${route.name}?`,
      body: 'The route is removed from the gateway. Its events stop being accepted.',
      action: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setBusyName(route.name);
        await remove.run(route.name);
        setBusyName(null);
        hooks.refetch();
      },
    });

  const onCreate = async (draft: WebhookDraft) => {
    if (await create.run(draft)) {
      setCreating(false);
      hooks.refetch();
    }
  };

  const data = hooks.data;
  const platformOff = data?.platformEnabled === false;
  const writeError = enable.error ?? toggle.error ?? remove.error;

  return (
    <Screen refreshing={hooks.loading && !!data} onRefresh={hooks.refetch}>
      <Stack.Screen options={{ title: 'Webhooks' }} />
      <ScreenTitle
        title="Webhooks"
        subtitle="Incoming triggers from other services."
        action={
          <Button
            label="Add"
            compact
            disabled={!data || platformOff}
            onPress={() => {
              setFormKey((key) => key + 1);
              setCreating(true);
            }}
          />
        }
      />

      {writeError ? <InlineNotice tone="danger">{writeError}</InlineNotice> : null}

      {platformOff ? (
        <Card tone="warning" style={{ gap: 12 }}>
          <Text style={styles.noticeText}>
            Webhooks are turned off. Turn on the webhook platform in Channels first.
          </Text>
          <View style={styles.noticeActions}>
            <Button label="Open Channels" variant="secondary" compact onPress={() => router.push('/control/channels')} />
            <Button
              label="Turn on webhooks"
              compact
              loading={enable.pending}
              disabled={enable.pending}
              onPress={onEnable}
            />
          </View>
        </Card>
      ) : null}

      {!data && hooks.loading ? <LoadingState label="Loading webhooks…" /> : null}
      {!data && hooks.error ? <ErrorState message={hooks.error} onRetry={hooks.refetch} /> : null}

      {data ? (
        <Section label="Routes">
          {data.routes.length === 0 ? (
            <Row title="No webhooks yet" subtitle="Add one to receive events from another service." last />
          ) : (
            data.routes.map((route, index) => (
              <WebhookRow
                key={route.name}
                route={route}
                last={index === data.routes.length - 1}
                busy={busyName === route.name}
                onToggle={(enabled) => onToggle(route, enabled)}
                onDelete={() => onDelete(route)}
              />
            ))
          )}
        </Section>
      ) : null}

      <WebhookForm
        key={formKey}
        visible={creating}
        pending={create.pending}
        error={create.error}
        onClose={() => {
          setCreating(false);
          create.clearError();
        }}
        onSubmit={onCreate}
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  noticeText: { color: tokens.text, fontSize: 15, lineHeight: 21 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
