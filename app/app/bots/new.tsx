import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { createBot, loadModelChoices, loadRoster, setBotModel } from '@/components/bots/api';
import { ModelPicker } from '@/components/bots/ModelPicker';
import { botHref } from '@/components/bots/routes';
import { requireHttp } from '@/components/bots/shared';
import type { ModelChoice } from '@/components/bots/types';
import {
  Button,
  Card,
  Chip,
  Field,
  InlineNotice,
  Row,
  Screen,
  ScreenTitle,
  Section,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { messageOf, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';
import { themed } from '@/lib/theme';

// Letters, numbers, dashes and underscores. The gateway checks the name again on save.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

type CreateResult = { name: string; modelError: string | null };

// Creates a bot from an optional source bot, then pins a model if one was chosen.
export default function NewBotScreen() {
  const { http } = useGateway();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cloneFrom, setCloneFrom] = useState<string | null>(null);
  const [model, setModel] = useState<ModelChoice | null>(null);
  const [pickingModel, setPickingModel] = useState(false);
  const [nameProblem, setNameProblem] = useState<string | null>(null);

  const bots = useGatewayQuery(async () => (await loadRoster(requireHttp(http))).bots, [http]);
  const choices = useGatewayQuery(async () => loadModelChoices(requireHttp(http)), [http]);

  const create = useAction(async (): Promise<CreateResult> => {
    const client = requireHttp(http);
    const trimmed = name.trim();
    await createBot(client, { name: trimmed, cloneFrom, description });
    if (!model) return { name: trimmed, modelError: null };
    try {
      await setBotModel(client, trimmed, model);
      return { name: trimmed, modelError: null };
    } catch (caught) {
      return { name: trimmed, modelError: messageOf(caught) };
    }
  });

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!NAME_PATTERN.test(trimmed)) {
      setNameProblem('Use letters, numbers, dashes or underscores.');
      return;
    }
    setNameProblem(null);
    const result = await create.run();
    if (!result) return;
    if (result.modelError) {
      Alert.alert(
        'Model not set',
        `${result.name} was created, but its model could not be set. ${result.modelError}`,
        [{ text: 'Open bot', onPress: () => router.replace(botHref(result.name)) }],
      );
      return;
    }
    router.replace(botHref(result.name));
  };

  const botOptions = (bots.data ?? []).map((bot) => ({ value: bot.name, label: bot.name }));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'New bot' }} />
      <ScreenTitle title="New bot" subtitle="Give the bot a name. You can change the rest later." />

      <Card style={styles.form}>
        <Field
          label="Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setNameProblem(null);
          }}
          placeholder="For example, reviewer"
          maxLength={64}
          returnKeyType="next"
        />
        {nameProblem ? <InlineNotice tone="danger">{nameProblem}</InlineNotice> : null}
        <Field
          label="Role description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What this bot is for"
          multiline
          autoCapitalize="sentences"
        />
      </Card>

      {botOptions.length > 0 ? (
        <Section label="Start from (optional)">
          <View style={styles.chipsPad}>
            <Chip options={botOptions} value={cloneFrom} onChange={setCloneFrom} />
          </View>
          <Row
            title="Copy settings and skills from the bot above"
            subtitle="Leave empty to start a fresh bot."
            last
          />
        </Section>
      ) : null}

      <Section label="Model (optional)">
        <Row
          title={model ? model.model : 'Use the default model'}
          subtitle={model ? model.providerLabel : 'Pick a model to pin this bot to it.'}
          onPress={() => setPickingModel(true)}
          last
          right={
            model ? (
              <Button label="Clear" variant="ghost" compact onPress={() => setModel(null)} />
            ) : undefined
          }
        />
      </Section>

      {choices.error ? <InlineNotice tone="danger">{choices.error}</InlineNotice> : null}
      {create.error ? <InlineNotice tone="danger">{create.error}</InlineNotice> : null}

      <Button
        label="Create bot"
        onPress={() => void onCreate()}
        loading={create.pending}
        disabled={!name.trim()}
        testID="create-bot"
      />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} />

      <ModelPicker
        visible={pickingModel}
        onClose={() => setPickingModel(false)}
        choices={choices.data}
        loading={choices.loading}
        error={choices.error}
        onRetry={choices.refetch}
        selected={{ provider: model?.provider ?? null, model: model?.model ?? null }}
        onPick={setModel}
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  form: { gap: 14 },
  chipsPad: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
}));
