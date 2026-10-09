import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { tokens } from '@/constants/tokens';

import type { KanbanTask } from './types';
import { themed } from '@/lib/theme';

type Props = {
  task: KanbanTask;
  onPress: () => void;
};

// One task on the board: title, who it is assigned to, and its priority.
export function TaskCard({ task, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={task.title}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{task.assignee ?? 'Unassigned'}</Text>
          <Text style={styles.metaText}>Priority {task.priority}</Text>
          {task.commentCount > 0 ? (
            <Text style={styles.metaText}>
              {task.commentCount} {task.commentCount === 1 ? 'comment' : 'comments'}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { gap: 6 },
  title: { color: tokens.text, fontSize: 15, fontWeight: '600' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { color: tokens.textMuted, fontSize: 13 },
}));
