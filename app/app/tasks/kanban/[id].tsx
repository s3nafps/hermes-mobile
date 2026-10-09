import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { TaskActions } from '@/components/tasks/TaskActions';
import { TaskComments } from '@/components/tasks/TaskComments';
import { TaskDetails } from '@/components/tasks/TaskDetails';
import { TaskLinks } from '@/components/tasks/TaskLinks';
import { TaskAttachments, TaskLog } from '@/components/tasks/TaskRecords';
import {
  getBoard,
  getTask,
  getTaskLog,
  listAssignees,
  listAttachments,
} from '@/components/tasks/api';
import { formatWhen, labelFor, toneFor } from '@/components/tasks/format';
import { Badge, Card, ErrorState, InlineNotice, LoadingState, Screen } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useGatewayQuery, useHttp } from '@/lib/gateway';
import { themed } from '@/lib/theme';

// The task drawer. Every section reads the same board, taken from the ?board= query.
export default function KanbanTaskScreen() {
  const { id, board } = useLocalSearchParams<{ id: string; board?: string }>();
  const slug = board || null;
  const http = useHttp();
  const detail = useGatewayQuery(() => getTask(http, id, slug), [http, id, slug]);
  const columns = useGatewayQuery(() => getBoard(http, slug), [http, slug]);
  const assignees = useGatewayQuery(() => listAssignees(http), [http]);
  const attachments = useGatewayQuery(() => listAttachments(http, id, slug), [http, id, slug]);
  const log = useGatewayQuery(() => getTaskLog(http, id, slug), [http, id, slug]);

  function reload() {
    detail.refetch();
    attachments.refetch();
    log.refetch();
  }

  if (!detail.data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Task' }} />
        <Screen>
          {detail.error ? <ErrorState message={detail.error} onRetry={detail.refetch} /> : <LoadingState label="Loading task" />}
        </Screen>
      </>
    );
  }

  const task = detail.data;

  return (
    <>
      <Stack.Screen options={{ title: task.title }} />
      <Screen>
        {detail.error ? <InlineNotice tone="danger">{detail.error}</InlineNotice> : null}

        <View style={styles.header}>
          <Badge label={labelFor(task.status, 'No status')} tone={toneFor(task.status)} />
          <Text style={styles.meta}>
            Created {formatWhen(task.createdAt, 'time unknown')}
            {task.completedAt ? ` · Completed ${formatWhen(task.completedAt)}` : ''}
          </Text>
          <Text style={styles.meta} selectable>
            ID {task.id}
          </Text>
        </View>

        {task.blockReason ? <InlineNotice tone="warning">Blocked: {task.blockReason}</InlineNotice> : null}
        {task.result ? (
          <Card>
            <Text style={styles.label}>Result</Text>
            <Text style={styles.body}>{task.result}</Text>
          </Card>
        ) : null}

        <TaskDetails
          board={slug}
          detail={task}
          columns={columns.data ?? []}
          assignees={assignees.data ?? []}
          onSaved={reload}
        />
        <TaskActions board={slug} detail={task} assignees={assignees.data ?? []} onChanged={reload} />
        <TaskLinks board={slug} detail={task} onChanged={reload} />
        <TaskComments board={slug} taskId={task.id} comments={task.comments} onChanged={reload} />
        <TaskAttachments attachments={attachments.data} error={attachments.error} />
        <TaskLog log={log.data} error={log.error} />
      </Screen>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  header: { gap: 6, alignItems: 'flex-start' },
  meta: { color: tokens.textMuted, fontSize: 13 },
  label: { color: tokens.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  body: { color: tokens.text, fontSize: 14, lineHeight: 20 },
}));
