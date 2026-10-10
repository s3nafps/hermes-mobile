import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, InlineNotice } from '@/components/ui';
import { lift, MONO, tokens } from '@/constants/tokens';
import { useAction, useGateway, unwrap, type GatewayStatus } from '@/lib/gateway';

import { NOT_CONNECTED } from './client';
import { themed } from '@/lib/theme';

type Props = {
  status: GatewayStatus | null;
  onChanged: () => void;
};

// Live gateway state from GET /api/status, plus Restart and Stop.
export function StatusCard({ status, onChanged }: Props) {
  const { http, activeProfile } = useGateway();
  const age = useStatusAge(status);

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
    <View style={styles.card}>
      <View style={styles.hero}>
        <View style={styles.heroMain}>
          <View style={styles.headline}>
            <Halo color={running ? tokens.done : tokens.textMuted} />
            <Text style={styles.headlineText}>{status ? (running ? 'Gateway running' : 'Gateway stopped') : 'Checking…'}</Text>
            {status?.gateway_state ? (
              <Pill label={status.gateway_state} tone={running ? 'done' : 'neutral'} />
            ) : null}
          </View>
          {activeProfile ? (
            <Text style={styles.gatewayName} numberOfLines={1}>
              {activeProfile.name}
            </Text>
          ) : null}
        </View>
        {age !== null ? <Text style={styles.freshness}>{freshnessLabel(age)}</Text> : null}
      </View>

      <View style={styles.facts}>
        <Fact label="Process ID" value={status?.gateway_pid ? String(status.gateway_pid) : '—'} />
        <Fact label="Platforms" value={platforms.length ? platforms.join(', ') : 'None'} />
        <Fact label="Active sessions" value={status ? String(status.active_sessions) : '—'} />
        <Fact label="Sign-in" value={status ? (status.auth_required ? 'Required' : 'Not required') : '—'} />
      </View>

      <View style={styles.actionBlock}>
        {restart.error || stop.error ? (
          <InlineNotice tone="danger">{restart.error ?? stop.error}</InlineNotice>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Restart"
            variant="danger"
            onPress={confirmRestart}
            loading={restart.pending}
            disabled={!status || busy}
            testID="gateway-restart"
            style={styles.restart}
          />
          <Button
            label="Stop"
            variant="danger"
            onPress={confirmStop}
            loading={stop.pending}
            disabled={!running || busy}
            testID="gateway-stop"
            style={styles.stop}
          />
        </View>
      </View>
    </View>
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

// Status dot with a 4px halo at low strength.
function Halo({ color }: { color: string }) {
  return (
    <View style={[styles.halo, { backgroundColor: fade(color, 0.18) }]}>
      <View style={[styles.haloDot, { backgroundColor: color }]} />
    </View>
  );
}

type PillTone = 'done' | 'neutral';

function Pill({ label, tone }: { label: string; tone: PillTone }) {
  const color = tone === 'done' ? tokens.done : tokens.textMuted;
  const background = tone === 'done' ? fade(tokens.done, 0.14) : tokens.well;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

// Seconds since the status last changed. The count moves once a second, so the label stays
// honest between polls. Returns null until there is a status to measure.
function useStatusAge(status: GatewayStatus | null): number | null {
  const seenAt = useRef<number | null>(null);
  const [age, setAge] = useState<number | null>(null);

  // Each poll returns a new status object, so each one restarts the count.
  useEffect(() => {
    seenAt.current = status ? Date.now() : null;
  }, [status]);

  useEffect(() => {
    const id = setInterval(() => {
      const at = seenAt.current;
      setAge(at === null ? null : Math.max(0, Math.round((Date.now() - at) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return status ? age : null;
}

function freshnessLabel(seconds: number): string {
  if (seconds < 3) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds} s ago`;
  return `Updated ${Math.floor(seconds / 60)} min ago`;
}

// Fades a #RRGGBB token for a tinted fill. Tokens are hex, so this derives the tint from them.
function fade(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 22,
    padding: 18,
    gap: 16,
    ...lift('card'),
  },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroMain: { flex: 1, gap: 4 },
  headline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  headlineText: { color: tokens.text, fontSize: 17, fontWeight: '600' },
  gatewayName: { color: tokens.textMuted, fontSize: 15 },
  freshness: { color: tokens.textMuted, fontFamily: MONO, fontSize: 13, paddingTop: 3 },
  halo: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  haloDot: { width: 8, height: 8, borderRadius: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  fact: { width: '45%', gap: 2 },
  factLabel: { color: tokens.textMuted, fontSize: 13 },
  factValue: { color: tokens.text, fontSize: 15 },
  actionBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.line,
    paddingTop: 16,
    gap: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Restart is the one risky action that keeps a danger outline. Stop stays a plain danger label.
  restart: { flex: 1, minHeight: 44, borderRadius: 14 },
  stop: { minHeight: 44, borderRadius: 14, borderColor: 'transparent', paddingHorizontal: 16 },
}));
