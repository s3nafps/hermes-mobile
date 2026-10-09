import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { humanize, requireHttp } from '@/components/bots/shared';
import { Badge, Button, EmptyState, ErrorState, Field, InlineNotice, LoadingState, Row, Section, Sheet } from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { installCatalogEntry, listCatalog } from './api';
import type { CatalogEntry } from './types';
import { themed } from '@/lib/theme';

// The approved MCP catalog. Install asks for any keys the server needs, then adds it to the config.
export function CatalogPanel({ onInstalled }: { onInstalled: () => void }) {
  const { http } = useGateway();
  const catalog = useGatewayQuery<CatalogEntry[]>(async () => listCatalog(requireHttp(http)), [http]);
  const [picked, setPicked] = useState<CatalogEntry | null>(null);

  const data = catalog.data;

  return (
    <>
      {catalog.loading && !data ? <LoadingState label="Loading catalog…" /> : null}
      {catalog.error && !data ? <ErrorState message={catalog.error} onRetry={catalog.refetch} /> : null}
      {data && data.length === 0 ? <EmptyState title="The catalog is empty" body="No servers are listed yet." /> : null}

      {data && data.length > 0 ? (
        <Section label="Catalog">
          {data.map((entry, index) => (
            <Row
              key={entry.name}
              title={entry.name}
              subtitle={entry.description || undefined}
              last={index === data.length - 1}
              right={
                entry.installed ? (
                  <Badge label={entry.enabled ? 'Enabled' : 'Installed'} tone={entry.enabled ? 'done' : 'neutral'} />
                ) : (
                  <Button label="Install" variant="secondary" compact onPress={() => setPicked(entry)} />
                )
              }
            />
          ))}
        </Section>
      ) : null}

      <Sheet visible={picked !== null} onClose={() => setPicked(null)} title={picked ? `Install ${picked.name}` : 'Install'}>
        {picked ? (
          <InstallForm
            key={picked.name}
            entry={picked}
            onDone={() => {
              setPicked(null);
              catalog.refetch();
              onInstalled();
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function InstallForm({ entry, onDone }: { entry: CatalogEntry; onDone: () => void }) {
  const { http } = useGateway();
  const [env, setEnv] = useState<Record<string, string>>({});

  const missing = entry.envVars.filter((name) => !(env[name] ?? '').trim());

  const install = useAction(async () => {
    await installCatalogEntry(requireHttp(http), entry.name, env);
    return true;
  });

  const onInstall = async () => {
    if (await install.run()) onDone();
  };

  return (
    <View style={styles.form}>
      {entry.description ? <InlineNotice tone="info">{entry.description}</InlineNotice> : null}
      {entry.envVars.map((name) => (
        <Field
          key={name}
          label={humanize(name)}
          value={env[name] ?? ''}
          onChangeText={(text) => setEnv((prev) => ({ ...prev, [name]: text }))}
          secureTextEntry={/key|token|secret|password/i.test(name)}
          placeholder={name}
        />
      ))}
      {install.error ? <InlineNotice tone="danger">{install.error}</InlineNotice> : null}
      <Button
        label={`Install ${entry.name}`}
        onPress={() => void onInstall()}
        disabled={missing.length > 0}
        loading={install.pending}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  form: { gap: 12 },
}));
