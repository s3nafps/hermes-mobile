import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  activateBot,
  deleteBot,
  getBotPersona,
  loadModelChoices,
  loadRoster,
  renameBot,
  setBotDescription,
  setBotModel,
  setBotPersona,
} from '@/components/bots/api';
import { ModelPicker } from '@/components/bots/ModelPicker';
import { BOTS_TAB_HREF, botHref } from '@/components/bots/routes';
import { requireHttp } from '@/components/bots/shared';
import type { BotRoster, ModelChoice } from '@/components/bots/types';
import { confirmAction } from '@/components/control/confirm';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
  SectionLabel,
  Sheet,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// One bot. Reads come from the profile list, since the gateway has no single-profile read.
// Each save updates the local copy, then refetches so the list stays in step.
export default function BotScreen() {
  const params = useLocalSearchParams<{ name: string }>();
  const name = String(params.name ?? '');
  const { http } = useGateway();

  const roster = useGatewayQuery<BotRoster>(async () => loadRoster(requireHttp(http)), [http, name]);
  const persona = useGatewayQuery<string>(async () => getBotPersona(requireHttp(http), name), [http, name]);
  const choices = useGatewayQuery<ModelChoice[]>(async () => loadModelChoices(requireHttp(http)), [http]);

  const bot = roster.data?.bots.find((item) => item.name === name) ?? null;
  const missing = roster.data !== undefined && bot === null && !roster.loading;

  // A draft holds an unsaved edit. null means nothing is pending, so the saved value shows.
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [personaDraft, setPersonaDraft] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const saveDescription = useAction(async (value: string) => {
    await setBotDescription(requireHttp(http), name, value);
    return value.trim();
  });
  const savePersona = useAction(async (value: string) => {
    await setBotPersona(requireHttp(http), name, value);
    return value;
  });
  const pickModel = useAction(async (choice: ModelChoice) => {
    await setBotModel(requireHttp(http), name, choice);
    return choice;
  });
  const activate = useAction(async () => {
    await activateBot(requireHttp(http), name);
    return true;
  });
  const rename = useAction(async (target: string) => {
    await renameBot(requireHttp(http), name, target);
    return target;
  });
  const remove = useAction(async () => {
    await deleteBot(requireHttp(http), name);
    return true;
  });

  const patchRoster = (change: (current: BotRoster) => BotRoster) => {
    if (roster.data) roster.setData(change(roster.data));
  };

  const onSaveDescription = async () => {
    if (descDraft === null) return;
    const saved = await saveDescription.run(descDraft);
    if (saved === undefined) return;
    setDescDraft(null);
    patchRoster((current) => ({
      ...current,
      bots: current.bots.map((item) => (item.name === name ? { ...item, description: saved } : item)),
    }));
    roster.refetch();
  };

  const onSavePersona = async () => {
    if (personaDraft === null) return;
    const saved = await savePersona.run(personaDraft);
    if (saved === undefined) return;
    setPersonaDraft(null);
    persona.setData(saved);
  };

  const onPickModel = async (choice: ModelChoice) => {
    const picked = await pickModel.run(choice);
    if (!picked) return;
    patchRoster((current) => ({
      ...current,
      bots: current.bots.map((item) =>
        item.name === name ? { ...item, model: picked.model, provider: picked.provider } : item,
      ),
    }));
    roster.refetch();
  };

  const onActivate = async () => {
    if (!(await activate.run())) return;
    patchRoster((current) => ({
      activeName: name,
      bots: current.bots.map((item) => ({ ...item, isActive: item.name === name })),
    }));
    roster.refetch();
  };

  const onRename = async () => {
    const target = newName.trim();
    if (!target || target === name) return;
    const renamed = await rename.run(target);
    if (!renamed) return;
    setRenameOpen(false);
    router.replace(botHref(renamed));
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(BOTS_TAB_HREF);
  };

  const onDelete = () => {
    confirmAction({
      title: `Delete ${name}?`,
      body: 'Its persona, settings and skills are removed. This cannot be undone.',
      action: 'Delete',
      destructive: true,
      onConfirm: async () => {
        if (await remove.run()) goBack();
      },
    });
  };

  const refreshAll = () => {
    roster.refetch();
    persona.refetch();
  };

  const descValue = descDraft ?? bot?.description ?? '';
  const personaValue = personaDraft ?? persona.data ?? '';

  return (
    <Screen refreshing={roster.loading} onRefresh={refreshAll}>
      <Stack.Screen options={{ title: name || 'Bot' }} />

      {roster.loading && !roster.data ? <LoadingState label="Loading bot…" /> : null}
      {roster.error && !roster.data ? <ErrorState message={roster.error} onRetry={roster.refetch} /> : null}
      {missing ? (
        <EmptyState
          title="Bot not found"
          body="It may have been deleted or renamed."
          action={<Button label="Back to bots" variant="secondary" onPress={goBack} />}
        />
      ) : null}

      {bot ? (
        <>
          <ScreenTitle title={bot.name} subtitle={bot.isDefault ? 'Default profile' : undefined} />

          {activate.error ? <InlineNotice tone="danger">{activate.error}</InlineNotice> : null}
          <Section label="Status">
            <Row
              title={bot.isActive ? 'Active bot' : 'Not active'}
              subtitle="New sessions and gateways use the active bot."
              last
              right={
                bot.isActive ? (
                  <Badge label="Active" tone="accent" />
                ) : (
                  <Button
                    label="Make active"
                    variant="secondary"
                    compact
                    loading={activate.pending}
                    onPress={() => void onActivate()}
                  />
                )
              }
            />
          </Section>

          <Section label="Model">
            <Row
              title={bot.model ?? 'Use the default model'}
              subtitle={bot.provider ?? 'Pick a model to pin this bot to it.'}
              onPress={() => setModelOpen(true)}
              last
            />
          </Section>
          {pickModel.error ? <InlineNotice tone="danger">{pickModel.error}</InlineNotice> : null}

          <View style={styles.group}>
            <SectionLabel>Role description</SectionLabel>
            <Card style={styles.card}>
              <Field
                label="Description"
                value={descValue}
                onChangeText={setDescDraft}
                placeholder="What this bot is for"
                multiline
                autoCapitalize="sentences"
              />
              {saveDescription.error ? <InlineNotice tone="danger">{saveDescription.error}</InlineNotice> : null}
              <Button
                label="Save description"
                compact
                onPress={() => void onSaveDescription()}
                disabled={descDraft === null || descDraft.trim() === (bot.description ?? '').trim()}
                loading={saveDescription.pending}
              />
            </Card>
          </View>

          <View style={styles.group}>
            <SectionLabel>Persona</SectionLabel>
            <Card style={styles.card}>
              {persona.loading && persona.data === undefined ? <LoadingState label="Loading persona…" /> : null}
              {persona.error && persona.data === undefined ? (
                <ErrorState message={persona.error} onRetry={persona.refetch} />
              ) : null}
              {persona.data !== undefined ? (
                <>
                  <Field
                    label="Persona (SOUL)"
                    value={personaValue}
                    onChangeText={setPersonaDraft}
                    placeholder="How this bot should think and speak"
                    multiline
                    autoCapitalize="sentences"
                    style={styles.persona}
                  />
                  {savePersona.error ? <InlineNotice tone="danger">{savePersona.error}</InlineNotice> : null}
                  <Button
                    label="Save persona"
                    compact
                    onPress={() => void onSavePersona()}
                    disabled={personaDraft === null || personaDraft === persona.data}
                    loading={savePersona.pending}
                  />
                </>
              ) : null}
            </Card>
          </View>

          <Section label="Manage">
            <Row
              title="Rename bot"
              subtitle="The bot's page address changes with its name."
              onPress={() => {
                setNewName(name);
                setRenameOpen(true);
              }}
              last={bot.isDefault}
            />
            {bot.isDefault ? null : (
              <View style={styles.dangerRow}>
                {remove.error ? <InlineNotice tone="danger">{remove.error}</InlineNotice> : null}
                <Button label="Delete bot" variant="danger" onPress={onDelete} loading={remove.pending} />
              </View>
            )}
          </Section>
        </>
      ) : null}

      <ModelPicker
        visible={modelOpen}
        onClose={() => setModelOpen(false)}
        choices={choices.data}
        loading={choices.loading}
        error={choices.error}
        onRetry={choices.refetch}
        selected={{ provider: bot?.provider ?? null, model: bot?.model ?? null }}
        onPick={(choice) => void onPickModel(choice)}
      />

      <Sheet visible={renameOpen} onClose={() => setRenameOpen(false)} title="Rename bot">
        <Field
          label="New name"
          value={newName}
          onChangeText={setNewName}
          maxLength={64}
          placeholder="For example, reviewer"
        />
        {rename.error ? <InlineNotice tone="danger">{rename.error}</InlineNotice> : null}
        <Button
          label="Save name"
          onPress={() => void onRename()}
          disabled={!newName.trim() || newName.trim() === name}
          loading={rename.pending}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  card: { gap: 12 },
  persona: { minHeight: 180 },
  dangerRow: { padding: 14, gap: 10 },
});
