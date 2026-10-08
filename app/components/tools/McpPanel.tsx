import { Alert } from 'react-native';
import { useState } from 'react';

import { requireHttp } from '@/components/bots/shared';
import { confirmAction } from '@/components/control/confirm';
import {
  Button,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Section,
  Toggle,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { removeServer, setServerEnabled, listServers, testServer } from './api';
import { AddServerSheet } from './AddServerSheet';
import { CatalogPanel } from './CatalogPanel';
import type { McpServer } from './types';

// MCP servers the agent connects to. Tapping a server offers a connection test or removal.
export function McpPanel() {
  const { http } = useGateway();
  const servers = useGatewayQuery<McpServer[]>(async () => listServers(requireHttp(http)), [http]);
  const [adding, setAdding] = useState(false);

  const toggle = useAction(async (name: string, enabled: boolean) => {
    await setServerEnabled(requireHttp(http), name, enabled);
    return true;
  });
  const test = useAction(async (name: string) => testServer(requireHttp(http), name));
  const remove = useAction(async (name: string) => {
    await removeServer(requireHttp(http), name);
    return true;
  });

  const onToggle = async (server: McpServer, enabled: boolean) => {
    if (servers.data) {
      servers.setData(servers.data.map((item) => (item.name === server.name ? { ...item, enabled } : item)));
    }
    await toggle.run(server.name, enabled);
    // Reload either way, so a failed change shows the server's real state.
    servers.refetch();
  };

  const onTest = async (server: McpServer) => {
    const result = await test.run(server.name);
    if (result) Alert.alert(result.ok ? 'Connected' : 'Could not connect', `${server.name}: ${result.summary}`);
  };

  const confirmRemove = (server: McpServer) =>
    confirmAction({
      title: `Remove ${server.name}?`,
      body: 'The server is removed from the config. Its settings are lost.',
      action: 'Remove',
      destructive: true,
      onConfirm: async () => {
        if (await remove.run(server.name)) servers.refetch();
      },
    });

  const onOpen = (server: McpServer) =>
    Alert.alert(server.name, server.target ?? 'No address set.', [
      { text: 'Test connection', onPress: () => void onTest(server) },
      { text: 'Remove', style: 'destructive', onPress: () => confirmRemove(server) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const data = servers.data;

  return (
    <>
      {servers.loading && !data ? <LoadingState label="Loading servers…" /> : null}
      {servers.error && !data ? <ErrorState message={servers.error} onRetry={servers.refetch} /> : null}
      {servers.error && data ? <InlineNotice tone="danger">{servers.error}</InlineNotice> : null}
      {toggle.error ? <InlineNotice tone="danger">{toggle.error}</InlineNotice> : null}
      {test.error ? <InlineNotice tone="danger">{test.error}</InlineNotice> : null}
      {remove.error ? <InlineNotice tone="danger">{remove.error}</InlineNotice> : null}

      {data && data.length === 0 ? (
        <EmptyState title="No MCP servers" body="Add a server, or install one from the catalog below." />
      ) : null}

      {data && data.length > 0 ? (
        <Section label={`Servers (${data.length})`}>
          {data.map((server, index) => (
            <Row
              key={server.name}
              title={server.name}
              subtitle={server.target ?? undefined}
              value={server.transport === 'unknown' ? undefined : server.transport}
              onPress={() => onOpen(server)}
              last={index === data.length - 1}
              right={
                <Toggle
                  label={`Turn ${server.name} ${server.enabled ? 'off' : 'on'}`}
                  value={server.enabled}
                  onValueChange={(next) => void onToggle(server, next)}
                />
              }
            />
          ))}
        </Section>
      ) : null}

      <Button label="Add server" variant="secondary" onPress={() => setAdding(true)} />

      <CatalogPanel onInstalled={servers.refetch} />

      <AddServerSheet visible={adding} onClose={() => setAdding(false)} onAdded={servers.refetch} />
    </>
  );
}
