import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { untyped } from '@/components/control/client';
import type { LogsResponse } from '@/components/control/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenTitle,
  Segmented,
  Toggle,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useGateway, useGatewayQuery } from '@/lib/gateway';
import { themed } from '@/lib/theme';

type LogFile = 'agent' | 'errors' | 'gateway';
type Level = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type LineCount = '50' | '100' | '200' | '500';

const FILES: { value: LogFile; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'errors', label: 'Errors' },
  { value: 'gateway', label: 'Gateway' },
];

const LEVELS: { value: Level; label: string }[] = [
  { value: 'DEBUG', label: 'Debug' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
];

const LINES: { value: LineCount; label: string }[] = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '500', label: '500' },
];

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// Recent log lines from the gateway, with filters and an optional auto-refresh.
export default function LogsScreen() {
  const { http } = useGateway();
  const [file, setFile] = useState<LogFile>('agent');
  const [level, setLevel] = useState<Level | null>(null);
  const [lines, setLines] = useState<LineCount>('100');
  const [live, setLive] = useState(false);

  const logs = useGatewayQuery<LogsResponse>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      const data = untyped<LogsResponse>(
        await http.GET('/api/logs', { params: { query: { file, lines: Number(lines), level } } }),
      );
      if (!Array.isArray(data?.lines)) throw new Error('The gateway sent logs in an unexpected shape.');
      return data;
    },
    [http, file, level, lines],
    { pollMs: live ? 5000 : undefined },
  );

  const rows = logs.data?.lines ?? [];

  return (
    <Screen onRefresh={logs.refetch} refreshing={false}>
      <Stack.Screen options={{ title: 'Logs' }} />
      <ScreenTitle
        title="Logs"
        subtitle="Newest lines last."
        action={<Button label="Refresh" variant="secondary" compact onPress={logs.refetch} loading={logs.loading && !!logs.data} />}
      />

      <Card style={{ gap: 14 }}>
        <Segmented options={FILES} value={file} onChange={setFile} />
        <Chip options={LEVELS} value={level} onChange={setLevel} />
        <Segmented options={LINES} value={lines} onChange={setLines} />
        <View style={styles.liveRow}>
          <Text style={styles.liveLabel}>Refresh every 5 seconds</Text>
          <Toggle value={live} onValueChange={setLive} label="Refresh every 5 seconds" />
        </View>
      </Card>

      {logs.loading && !logs.data ? <LoadingState label="Loading logs…" /> : null}
      {logs.error ? <ErrorState message={logs.error} onRetry={logs.refetch} /> : null}

      {logs.data && rows.length === 0 ? (
        <EmptyState title="No log lines" body="Nothing matches these filters yet." />
      ) : null}

      {rows.length > 0 ? (
        <Card style={styles.logCard}>
          <ScrollView style={styles.logScroll} nestedScrollEnabled>
            <Text selectable style={styles.logText}>
              {rows.join('\n')}
            </Text>
          </ScrollView>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveLabel: { color: tokens.textMuted, fontSize: 13 },
  logCard: { padding: 0, overflow: 'hidden' },
  logScroll: { maxHeight: 460 },
  logText: {
    color: tokens.text,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
    padding: 12,
  },
}));
