import { Alert, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, InlineNotice, StatusDot } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway, unwrap, type GatewayStatus } from '@/lib/gateway';

import { NOT_CONNECTED } from './client';
import { themed } from '@/lib/theme';

type Props = {
  status: GatewayStatus | null;
  onChanged: () => void;
};

// Live gateway state from GET /api/status, plus Restart and Stop.
export function StatusCard({ status, onChanged }: Props) {
  const { http } = useGateway();

  const restart = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    unwrap(await http.POST('/api/gateway/restart'));
  });
  const stop = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    unwrap(await http.POST('/api/gateway/stop'));
  });

  const running = !!status?.gateway_running;
  const platforms = status ? Object.keys(status.gateway_platforms) : [];
  const busy = restart.pending || stop.pending;

  const confirmRestart = () =>
    Alert.alert(
      'Restart the gateway?',
      'Chat platforms reconnect after the restart. Messages may pause for a moment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: () => {
            void restart.run().then(() => onChanged());
          },
        },
      ],
    );

  const confirmStop = () =>
    Alert.alert(
      'Stop the gateway?',
      'Chat platforms stop receiving messages until you start the gateway again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            void stop.run().then(() => onChanged());
          },
        },
      ],
    );

  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.headline}>
        <StatusDot tone={running ? 'running' : 'neutral'} />
        <Text style={styles.headlineText}>{status ? (running ? 'Gateway running' : 'Gateway stopped') : 'Checking…'}</Text>
        {status?.gateway_state ? <Badge label={status.gateway_state} tone={running ? 'running' : 'neutral'} /> : null}
      </View>

      <View style={styles.facts}>
        <Fact label="Process ID" value={status?.gateway_pid ? String(status.gateway_pid) : '—'} />
        <Fact label="Platforms" value={platforms.length ? platforms.join(', ') : 'None'} />
        <Fact label="Active sessions" value={status ? String(status.active_sessions) : '—'} />
        <Fact label="Sign-in" value={status ? (status.auth_required ? 'Required' : 'Not required') : '—'} />
      </View>

      {restart.error || stop.error ? (
        <InlineNotice tone="danger">{restart.error ?? stop.error}</InlineNotice>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label="Restart"
            variant="secondary"
            onPress={confirmRestart}
            loading={restart.pending}
            disabled={!status || busy}
            testID="gateway-restart"
          />
        </View>
        <View style={styles.action}>
          <Button
            label="Stop"
            variant="danger"
            onPress={confirmStop}
            loading={stop.pending}
            disabled={!running || busy}
            testID="gateway-stop"
          />
        </View>
      </View>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headlineText: { color: tokens.text, fontSize: 17, fontWeight: '600', flex: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fact: { width: '45%', gap: 2 },
  factLabel: { color: tokens.textMuted, fontSize: 12 },
  factValue: { color: tokens.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
}));
