import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CronForm } from '@/components/tasks/CronForm';
import { createCronJob, listBlueprints, listDeliveryTargets } from '@/components/tasks/api';
import type { CronValues } from '@/components/tasks/types';
import { Button, Chip, InlineNotice, Screen, SectionLabel } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGatewayQuery, useHttp } from '@/lib/gateway';
import { themed } from '@/lib/theme';

const EMPTY: CronValues = { name: '', prompt: '', schedule: '', deliver: 'local' };

export default function NewCronJobScreen() {
  const http = useHttp();
  const targets = useGatewayQuery(() => listDeliveryTargets(http), [http]);
  const blueprints = useGatewayQuery(() => listBlueprints(http), [http]);
  const [values, setValues] = useState<CronValues>(EMPTY);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction(async (payload: CronValues) => {
    await createCronJob(http, payload);
    return true;
  });

  const blueprintList = blueprints.data ?? [];
  const chosen = blueprintList.find((item) => item.id === picked) ?? null;

  // A blueprint fills in only the fields it supplies. With no name supplied, its own name is used.
  function applyBlueprint(id: string | null) {
    setPicked(id);
    const blueprint = blueprintList.find((item) => item.id === id);
    if (!blueprint) return;
    setValues((current) => ({
      name: blueprint.prefill.name ?? (current.name || blueprint.name),
      prompt: blueprint.prefill.prompt ?? current.prompt,
      schedule: blueprint.prefill.schedule ?? current.schedule,
      deliver: blueprint.prefill.deliver ?? current.deliver,
    }));
  }

  async function submit() {
    const payload: CronValues = {
      name: values.name.trim(),
      prompt: values.prompt.trim(),
      schedule: values.schedule.trim(),
      deliver: values.deliver,
    };
    if (!payload.name) {
      setProblem('Give the job a name.');
      return;
    }
    if (!payload.prompt) {
      setProblem('Add a prompt for the agent.');
      return;
    }
    if (!payload.schedule) {
      setProblem('Set a schedule.');
      return;
    }
    setProblem(null);
    const ok = await save.run(payload);
    if (ok) router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New job' }} />
      <Screen>
        {blueprints.error ? <InlineNotice tone="danger">{blueprints.error}</InlineNotice> : null}
        {blueprintList.length > 0 ? (
          <View style={styles.blueprints}>
            <SectionLabel>Start from a blueprint</SectionLabel>
            <Chip
              options={blueprintList.map((item) => ({ value: item.id, label: item.name }))}
              value={picked}
              onChange={applyBlueprint}
            />
            {chosen?.description ? <Text style={styles.hint}>{chosen.description}</Text> : null}
          </View>
        ) : null}
        <CronForm values={values} onChange={setValues} targets={targets.data} targetsError={targets.error} />
        {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
        {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
        <Button label="Create job" onPress={() => void submit()} loading={save.pending} />
      </Screen>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  blueprints: { gap: 8 },
  hint: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
}));
