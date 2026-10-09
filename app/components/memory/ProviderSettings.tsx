import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { humanize, requireHttp } from '@/components/bots/shared';
import { Button, Card, EmptyState, ErrorState, Field, InlineNotice, LoadingState, Sheet, Toggle } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { loadProviderSettings, saveProviderSettings } from './api';
import type { ProviderSetting } from './types';
import { themed } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  provider: string | null;
};

// Settings for the active memory provider. The form mounts only with loaded settings,
// so its drafts start from the saved values.
export function ProviderSettingsSheet({ visible, onClose, provider }: Props) {
  const { http } = useGateway();
  const settings = useGatewayQuery<ProviderSetting[]>(
    visible && provider ? async () => loadProviderSettings(requireHttp(http), provider) : null,
    [http, provider, visible],
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Provider settings">
      {settings.loading && !settings.data ? <LoadingState label="Loading settings…" /> : null}
      {settings.error && !settings.data ? <ErrorState message={settings.error} onRetry={settings.refetch} /> : null}
      {settings.data && settings.data.length === 0 ? (
        <EmptyState title="No settings" body="This provider has nothing to configure here." />
      ) : null}
      {settings.data && settings.data.length > 0 && provider ? (
        <SettingsForm key={provider} provider={provider} settings={settings.data} onSaved={onClose} />
      ) : null}
    </Sheet>
  );
}

type FormProps = {
  provider: string;
  settings: ProviderSetting[];
  onSaved: () => void;
};

function SettingsForm({ provider, settings, onSaved }: FormProps) {
  const { http } = useGateway();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );

  const isChanged = (setting: ProviderSetting) => {
    const draft = drafts[setting.key] ?? '';
    if (setting.secret) return draft !== '';
    return draft !== setting.value;
  };
  const changed = settings.filter(isChanged);
  const badNumber = changed.find((setting) => setting.kind === 'number' && !Number.isFinite(Number(drafts[setting.key])));

  const save = useAction(async () => {
    if (badNumber) throw new Error(`${humanize(badNumber.key)} must be a number.`);
    const values: Record<string, string | number | boolean> = {};
    for (const setting of changed) {
      const draft = drafts[setting.key] ?? '';
      if (setting.kind === 'number') values[setting.key] = Number(draft);
      else if (setting.kind === 'boolean') values[setting.key] = draft === 'true';
      else values[setting.key] = draft;
    }
    await saveProviderSettings(requireHttp(http), provider, values);
    return true;
  });

  const setDraft = (key: string, value: string) => setDrafts((prev) => ({ ...prev, [key]: value }));

  const onSave = async () => {
    if (await save.run()) onSaved();
  };

  return (
    <View style={styles.form}>
      <Card style={styles.card}>
        {settings.map((setting) =>
          setting.kind === 'boolean' ? (
            <View key={setting.key} style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{humanize(setting.key)}</Text>
              <Toggle
                label={humanize(setting.key)}
                value={drafts[setting.key] === 'true'}
                onValueChange={(next) => setDraft(setting.key, String(next))}
              />
            </View>
          ) : (
            <Field
              key={setting.key}
              label={humanize(setting.key)}
              value={drafts[setting.key] ?? ''}
              onChangeText={(text) => setDraft(setting.key, text)}
              secureTextEntry={setting.secret}
              keyboardType={setting.kind === 'number' ? 'numeric' : 'default'}
              placeholder={setting.secret ? 'Leave blank to keep the saved value' : undefined}
            />
          ),
        )}
      </Card>
      {badNumber ? <InlineNotice tone="danger">{`${humanize(badNumber.key)} must be a number.`}</InlineNotice> : null}
      {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
      <Button
        label="Save settings"
        onPress={() => void onSave()}
        disabled={changed.length === 0 || !!badNumber}
        loading={save.pending}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  form: { gap: 12 },
  card: { gap: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { color: tokens.text, fontSize: 15, flex: 1 },
}));
