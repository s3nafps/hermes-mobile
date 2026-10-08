import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { Badge, Button, Chip, EmptyState, ErrorState, Field, InlineNotice, LoadingState, SectionLabel } from '@/components/ui';
import { useAction, useGatewayQuery, useHttp } from '@/lib/gateway';

import { dispatchBoard, getBoard, listBoards } from './api';
import { labelFor } from './format';
import { kanbanNewHref, kanbanTaskHref } from './routes';
import { TaskCard } from './TaskCard';
import type { KanbanTask } from './types';
import { useRefetchOnFocus } from './useRefetchOnFocus';

// The Board tab: one section per status column, filtered on the device.
// Switching boards only changes which board this screen reads. It does not
// change the gateway's current board.
export function BoardTab() {
  const http = useHttp();
  const boards = useGatewayQuery(() => listBoards(http), [http]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const current = boards.data?.find((item) => item.current)?.slug ?? boards.data?.[0]?.slug ?? null;
  const slug = chosen ?? current;
  const board = useGatewayQuery(() => getBoard(http, slug), [http, slug], { pollMs: 20_000 });
  useRefetchOnFocus(board.refetch);
  const nudge = useAction(async () => {
    await dispatchBoard(http, slug);
    return true;
  });

  const columns = board.data ?? [];
  const allTasks = columns.flatMap((column) => column.tasks);
  // Empty string stands for "no assignee", so the list can show it as Unassigned.
  const assignees = Array.from(new Set(allTasks.map((task) => task.assignee ?? ''))).sort();
  const query = text.trim().toLowerCase();
  const filtering = query !== '' || assignee !== null;

  function visible(task: KanbanTask): boolean {
    if (assignee !== null && (task.assignee ?? '') !== assignee) return false;
    if (!query) return true;
    return [task.title, task.body ?? '', task.id].some((field) => field.toLowerCase().includes(query));
  }

  async function nudgeDispatcher() {
    setNote(null);
    const ok = await nudge.run();
    if (ok) {
      setNote('Dispatcher nudged.');
      board.refetch();
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button label="New task" compact onPress={() => router.push(kanbanNewHref(slug))} />
        <Button
          label="Nudge dispatcher"
          variant="secondary"
          compact
          loading={nudge.pending}
          onPress={() => void nudgeDispatcher()}
        />
      </View>

      {boards.data && boards.data.length > 1 ? (
        <View style={styles.group}>
          <SectionLabel>Board</SectionLabel>
          <Chip
            options={boards.data.map((item) => ({ value: item.slug, label: item.name }))}
            value={slug}
            onChange={(next) => {
              if (next) setChosen(next);
            }}
          />
        </View>
      ) : null}

      <Field
        label="Filter tasks"
        value={text}
        onChangeText={setText}
        placeholder="Title, body or ID"
        autoCapitalize="none"
        returnKeyType="search"
      />

      {assignees.length > 0 ? (
        <View style={styles.group}>
          <SectionLabel>Assignee</SectionLabel>
          <Chip
            options={assignees.map((name) => ({ value: name, label: name === '' ? 'Unassigned' : name }))}
            value={assignee}
            onChange={setAssignee}
          />
        </View>
      ) : null}

      {note ? <InlineNotice tone="info">{note}</InlineNotice> : null}
      {nudge.error ? <InlineNotice tone="danger">{nudge.error}</InlineNotice> : null}
      {board.error && !board.data ? <ErrorState message={board.error} onRetry={board.refetch} /> : null}
      {board.error && board.data ? <InlineNotice tone="danger">{board.error}</InlineNotice> : null}
      {!board.data && !board.error ? <LoadingState label="Loading board" /> : null}
      {board.data && allTasks.length === 0 ? (
        <EmptyState title="No tasks on this board yet" body="Create a task to get started." />
      ) : null}

      {columns.map((column) => {
        const shown = column.tasks.filter(visible);
        return (
          <View key={column.name || 'none'} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{labelFor(column.name, 'No status')}</Text>
              <Badge label={filtering ? `${shown.length} of ${column.tasks.length}` : String(column.tasks.length)} />
            </View>
            {shown.length === 0 ? (
              <Text style={styles.empty}>{filtering ? 'No matching tasks' : 'No tasks'}</Text>
            ) : null}
            {shown.map((task) => (
              <TaskCard key={task.id} task={task} onPress={() => router.push(kanbanTaskHref(task.id, slug))} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { gap: 8 },
  column: { gap: 10 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  columnTitle: { color: tokens.text, fontSize: 16, fontWeight: '600' },
  empty: { color: tokens.textMuted, fontSize: 13, paddingVertical: 4 },
});
