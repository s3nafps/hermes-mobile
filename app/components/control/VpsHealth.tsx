import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { tokens } from '@/constants/tokens';

import { byteSize, percent } from './format';
import type { SystemStats } from './types';

type Props = {
  stats: SystemStats | null | undefined;
};

// Live health of the machine that runs Hermes: CPU, memory, disk, load and uptime.
export function VpsHealth({ stats }: Props) {
  if (!stats) return null;

  const identity = [stats.hostname, stats.platform_label].filter(Boolean).join(' · ');

  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heading}>VPS health</Text>
          <Text numberOfLines={1} style={styles.muted}>
            {identity || 'Host details unavailable'}
          </Text>
        </View>
        {typeof stats.uptime_seconds === 'number' ? (
          <Badge label={`Up ${formatUptime(stats.uptime_seconds)}`} />
        ) : null}
      </View>

      <Meter label="CPU" value={stats.cpu_percent} detail={cpuDetail(stats)} />
      <Meter label="Memory" value={stats.memory?.percent} detail={sizeDetail(stats.memory?.used, stats.memory?.total)} />
      <Meter label="Disk" value={stats.disk?.percent} detail={sizeDetail(stats.disk?.used, stats.disk?.total)} />
    </Card>
  );
}

function Meter({ label, value, detail }: { label: string; value: number | null | undefined; detail: string }) {
  const known = typeof value === 'number' && Number.isFinite(value);
  const amount = known ? Math.min(100, Math.max(0, value)) : 0;
  const color = !known ? tokens.textMuted : amount >= 90 ? tokens.danger : amount >= 80 ? tokens.accent : tokens.done;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.label, { color }]}>{percent(value)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${amount}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.muted}>{detail}</Text>
    </View>
  );
}

function cpuDetail(stats: SystemStats): string {
  const load = stats.load_avg?.map((value) => value.toFixed(2)).join(' · ');
  const cores = typeof stats.cpu_count === 'number' ? `${stats.cpu_count} CPUs` : null;
  const parts = [load ? `Load ${load}` : null, cores].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function sizeDetail(used: number | undefined, total: number | undefined): string {
  if (typeof used !== 'number' || typeof total !== 'number') return '—';
  return `${byteSize(used)} of ${byteSize(total)}`;
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  heading: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '600',
  },
  label: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '500',
  },
  muted: {
    color: tokens.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.bg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
