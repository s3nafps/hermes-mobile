import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Toggle } from '@/components/ui';
import { tokens } from '@/constants/tokens';

import { formatWhen, labelFor, toneFor } from './format';
import type { CronJob } from './types';

type Props = {
  job: CronJob;
  deliverLabel: string;
  busy: boolean;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onRunNow: () => void;
  onDelete: () => void;
};

export function CronJobCard({ job, deliverLabel, busy, onOpen, onToggle, onRunNow, onDelete }: Props) {
  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${job.name}`}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={2}>
            {job.name}
          </Text>
          {job.lastStatus ? (
            <Badge label={labelFor(job.lastStatus)} tone={toneFor(job.lastStatus)} />
          ) : (
            <Badge label="Not run yet" />
          )}
        </View>
        <Text style={styles.meta}>{job.scheduleLabel || 'No schedule'}</Text>
        <Text style={styles.meta}>Delivers to {deliverLabel}</Text>
        <Text style={styles.meta}>Last run: {formatWhen(job.lastRunAt, 'never')}</Text>
        <Text style={styles.meta}>
          Next run: {job.enabled ? formatWhen(job.nextRunAt, 'not scheduled') : 'paused'}
        </Text>
        {job.lastError ? (
          <Text style={styles.error} numberOfLines={3}>
            {job.lastError}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.footer}>
        <Toggle
          label={`${job.enabled ? 'Pause' : 'Resume'} ${job.name}`}
          value={job.enabled}
          onValueChange={onToggle}
          disabled={busy}
        />
        <Text style={styles.meta}>{job.enabled ? 'On' : 'Paused'}</Text>
        <View style={styles.spacer} />
        <Button label="Run now" variant="secondary" compact onPress={onRunNow} disabled={busy} />
        <Button label="Delete" variant="danger" compact onPress={onDelete} disabled={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  body: { gap: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, color: tokens.text, fontSize: 16, fontWeight: '600' },
  meta: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  spacer: { flexGrow: 1 },
});
