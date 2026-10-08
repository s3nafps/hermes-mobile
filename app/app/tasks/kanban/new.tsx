import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createTask, listAssignees, type NewTask } from '@/components/tasks/api';
import { Button, Chip, Field, InlineNotice, Screen, SectionLabel } from '@/components/ui';
import { useAction, useGatewayQuery, useHttp } from '@/lib/gateway';

// Creates a task on the board the user was viewing (the ?board= query).
export default function NewTaskScreen() {
  const { board } = useLocalSearchParams<{ board?: string }>();
  const slug = board || null;
  const http = useHttp();
  const assignees = useGatewayQuery(() => listAssignees(http), [http]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('0');
  const [problem, setProblem] = useState<string | null>(null);
  const create = useAction(async (task: NewTask) => {
    await createTask(http, slug, task);
    return true;
  });

  async function submit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setProblem('Give the task a title.');
      return;
    }
    const cleanPriority = priority.trim() === '' ? 0 : Number(priority);
    if (!Number.isInteger(cleanPriority)) {
      setProblem('Priority must be a whole number.');
      return;
    }
    setProblem(null);
    const ok = await create.run({
      title: cleanTitle,
      body: body.trim() === '' ? null : body,
      assignee: assignee.trim() === '' ? null : assignee.trim(),
      priority: cleanPriority,
    });
    if (ok) router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New task' }} />
      <Screen>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="What needs doing" autoCapitalize="sentences" />
        <Field
          label="Description"
          value={body}
          onChangeText={setBody}
          placeholder="Optional details"
          multiline
          autoCapitalize="sentences"
        />

        {assignees.data && assignees.data.length > 0 ? (
          <View style={styles.group}>
            <SectionLabel>Pick an assignee</SectionLabel>
            <Chip
              options={assignees.data.map((item) => ({ value: item.name, label: item.name }))}
              value={assignees.data.some((item) => item.name === assignee) ? assignee : null}
              onChange={(next) => {
                if (next) setAssignee(next);
              }}
            />
          </View>
        ) : null}
        <Field
          label="Assignee"
          value={assignee}
          onChangeText={setAssignee}
          placeholder="Profile name, or leave blank"
        />
        {assignees.error ? <InlineNotice tone="danger">{assignees.error}</InlineNotice> : null}

        <Field label="Priority" value={priority} onChangeText={setPriority} keyboardType="number-pad" />

        {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
        {create.error ? <InlineNotice tone="danger">{create.error}</InlineNotice> : null}
        <Button label="Create task" onPress={() => void submit()} loading={create.pending} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
});
