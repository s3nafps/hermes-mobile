import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { untyped } from '@/components/control/client';
import { ConfigField } from '@/components/control/ConfigField';
import {
  coerceFieldValue,
  cloneConfig,
  fieldLabel,
  getPath,
  isSecretKey,
  setPath,
  titleCase,
} from '@/components/control/configPath';
import type { ConfigObject, ConfigSchema, ConfigSchemaField, RawConfig } from '@/components/control/types';
import {
  Button,
  Card,
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
import { tokens } from '@/constants/tokens';
import { unwrap, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// The gateway config as a form. Fields come from the config schema. Edits stay on this
// screen until Save, which sends the whole config back to the gateway.
export default function ConfigScreen() {
  const { http } = useGateway();
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const [pickingSection, setPickingSection] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const schema = useGatewayQuery<ConfigSchema>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ConfigSchema>(await http.GET('/api/config/schema'));
    },
    [http],
  );

  const config = useGatewayQuery<ConfigObject>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ConfigObject>(await http.GET('/api/config'));
    },
    [http],
  );

  const raw = useGatewayQuery<RawConfig>(
    rawOpen
      ? async () => {
          if (!http) throw new Error('The gateway is not connected.');
          return untyped<RawConfig>(await http.GET('/api/config/raw'));
        }
      : null,
    [http, rawOpen],
  );

  const categories = useMemo(() => {
    if (!schema.data) return [];
    const present = new Set(Object.values(schema.data.fields).map((field) => field.category));
    const ordered = schema.data.category_order.filter((name) => present.has(name));
    const rest = [...present].filter((name) => !ordered.includes(name)).sort();
    return [...ordered, ...rest];
  }, [schema.data]);

  const section = chosen && categories.includes(chosen) ? chosen : (categories[0] ?? null);

  const fields = useMemo<[string, ConfigSchemaField][]>(() => {
    if (!schema.data || !section) return [];
    return Object.entries(schema.data.fields)
      .filter(([, field]) => field.category === section)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [schema.data, section]);

  const dirty = Object.keys(edits).length > 0;

  const update = (key: string, value: unknown) => setEdits((prev) => ({ ...prev, [key]: value }));

  const save = useAction(async () => {
    if (!http || !config.data || !schema.data) throw new Error('The gateway is not connected.');
    let next = cloneConfig(config.data);
    for (const [key, value] of Object.entries(edits)) {
      const field = schema.data.fields[key];
      if (!field) continue;
      // A blank secret means "keep the current value", so it is not written.
      if (isSecretKey(key) && String(value ?? '') === '') continue;
      next = setPath(next, key, coerceFieldValue(field, value, fieldLabel(field.description)));
    }
    unwrap(await http.PUT('/api/config', { body: { config: next } }));
    return true;
  });

  const reset = useAction(async () => {
    if (!http) throw new Error('The gateway is not connected.');
    const defaults = untyped<ConfigObject>(await http.GET('/api/config/defaults'));
    unwrap(await http.PUT('/api/config', { body: { config: defaults } }));
    return true;
  });

  const onSave = async () => {
    const ok = await save.run();
    if (ok) {
      setEdits({});
      config.refetch();
    }
  };

  const confirmReset = () =>
    Alert.alert(
      'Reset every setting?',
      'All settings go back to their defaults. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void reset.run().then((ok) => {
              if (ok) {
                setEdits({});
                config.refetch();
              }
            });
          },
        },
      ],
    );

  const loading = (schema.loading && !schema.data) || (config.loading && !config.data);
  const failure = schema.error ?? config.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Config' }} />
      <ScreenTitle title="Config" subtitle="Gateway settings. Save to apply your changes." />

      {loading ? <LoadingState label="Loading settings…" /> : null}
      {failure && !loading ? (
        <ErrorState
          message={failure}
          onRetry={() => {
            schema.refetch();
            config.refetch();
          }}
        />
      ) : null}

      {schema.data && config.data ? (
        <>
          {categories.length > 0 ? (
            <Section label="Section">
              <Row
                title={section ? titleCase(section) : 'Choose a section'}
                subtitle={`${fields.length} settings`}
                last
                onPress={() => setPickingSection(true)}
                testID="config-section-picker"
              />
            </Section>
          ) : null}

          {fields.length === 0 ? (
            <EmptyState title="No settings here" body="This section has no settings in the schema." />
          ) : (
            <Card style={{ gap: 18 }}>
              {fields.map(([key, field]) => {
                const secret = isSecretKey(key) && field.type === 'string';
                const stored = getPath(config.data, key);
                return (
                  <ConfigField
                    key={key}
                    field={field}
                    value={secret ? (edits[key] ?? '') : (key in edits ? edits[key] : stored)}
                    secretSet={secret ? typeof stored === 'string' && stored.length > 0 : undefined}
                    onChange={(value) => update(key, value)}
                  />
                );
              })}
            </Card>
          )}

          {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
          {reset.error ? <InlineNotice tone="danger">{reset.error}</InlineNotice> : null}

          <Button label="Save" onPress={onSave} loading={save.pending} disabled={!dirty || save.pending || reset.pending} testID="config-save" />
          <Button
            label="Discard changes"
            variant="secondary"
            onPress={() => setEdits({})}
            disabled={!dirty || save.pending}
          />
          <Button
            label="Reset to defaults"
            variant="danger"
            onPress={confirmReset}
            loading={reset.pending}
            disabled={save.pending || reset.pending}
          />

          <Section label="Advanced">
            <Row title="View config.yaml" subtitle="Read only" last onPress={() => setRawOpen(true)} />
          </Section>
        </>
      ) : null}

      <Sheet visible={pickingSection} onClose={() => setPickingSection(false)} title="Choose a section">
        {categories.map((name) => (
          <Row
            key={name}
            title={titleCase(name)}
            value={String(Object.values(schema.data?.fields ?? {}).filter((f) => f.category === name).length)}
            onPress={() => {
              setChosen(name);
              setPickingSection(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={rawOpen} onClose={() => setRawOpen(false)} title="config.yaml">
        {raw.loading && !raw.data ? <LoadingState label="Loading…" /> : null}
        {raw.error ? <ErrorState message={raw.error} onRetry={raw.refetch} /> : null}
        {raw.data ? (
          <>
            {raw.data.path ? <Text style={styles.path}>{raw.data.path}</Text> : null}
            <Text selectable style={styles.raw}>
              {raw.data.yaml_text ?? raw.data.yaml ?? 'The gateway returned no config text.'}
            </Text>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  path: { color: tokens.textMuted, fontSize: 12 },
  raw: { color: tokens.text, fontFamily: MONO, fontSize: 12, lineHeight: 17 },
});
