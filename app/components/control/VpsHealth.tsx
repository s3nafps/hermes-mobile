import { StyleSheet, Text, View } from 'react-native';

import { lift, MONO, tokens } from '@/constants/tokens';

import { byteSize, percent } from './format';
import type { SystemStats } from './types';
import { themed } from '@/lib/theme';

// Warn well before a host runs out of memory or disk space. PressureBanners uses the same limits.
const WARN_AT = 80;
const DANGER_AT = 90;

const LEVEL_WORD = { normal: 'Normal', warning: 'Warning', critical: 'Critical' } as const;

type Props = {
  stats: SystemStats | null | undefined;
};

// Live health of the machine that runs Hermes: CPU, memory and disk as three tiles, plus uptime.
export function VpsHealth({ stats }: Props) {
  if (!stats) return null;

  const identity = [stats.hostname, stats.platform].filter(Boolean).join(' · ');

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>VPS health</Text>
          <Text numberOfLines={1} style={styles.muted}>
            {identity || 'Host details unavailable'}
          </Text>
        </View>
        {typeof stats.uptime_seconds === 'number' ? (
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>{`Up ${formatUptime(stats.uptime_seconds)}`}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tiles}>
        <Tile label="CPU" value={stats.cpu_percent} detail={cpuDetail(stats)} />
        <Tile label="Memory" value={stats.memory?.percent} detail={sizeDetail(stats.memory?.used, stats.memory?.total)} />
        <Tile label="Disk" value={stats.disk?.percent} detail={sizeDetail(stats.disk?.used, stats.disk?.total)} />
      </View>
    </View>
  );
}

function Tile({ label, value, detail }: { label: string; value: number | null | undefined; detail: string }) {
  const known = typeof value === 'number' && Number.isFinite(value);
  const amount = known ? Math.min(100, Math.max(0, value)) : 0;
  const level = amount >= DANGER_AT ? 'critical' : amount >= WARN_AT ? 'warning' : 'normal';

  const valueColor = !known ? tokens.textMuted : level === 'critical' ? tokens.danger : level === 'warning' ? tokens.warnText : tokens.text;
  const wordColor = level === 'critical' ? tokens.danger : level === 'warning' ? tokens.warnText : tokens.textMuted;
  const barColor = level === 'critical' ? tokens.danger : level === 'warning' ? tokens.warn : tokens.accent;

  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{percent(value)}</Text>
        {known ? <Text style={[styles.level, { color: wordColor }]}>{LEVEL_WORD[level]}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${amount}%`, backgroundColor: barColor }]} />
        <View style={[styles.tick, { left: `${WARN_AT}%` }]} />
        <View style={[styles.tick, { left: `${DANGER_AT}%` }]} />
      </View>
      <Text style={styles.detail} numberOfLines={2}>
        {detail}
      </Text>
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

const styles = themed(() => StyleSheet.create({
  section: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, gap: 2 },
  heading: { color: tokens.textMuted, fontSize: 13, fontWeight: '600' },
  muted: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
  pill: {
    backgroundColor: tokens.well,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillLabel: { color: tokens.textMuted, fontFamily: MONO, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 22,
    padding: 12,
    gap: 8,
    ...lift('card'),
  },
  tileLabel: { color: tokens.textMuted, fontSize: 12, fontWeight: '500' },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 },
  value: { fontFamily: MONO, fontSize: 20, fontWeight: '600' },
  level: { fontSize: 12, fontWeight: '600' },
  // The track is 4px. Tick marks at the warning and danger limits extend past it.
  track: { height: 4, borderRadius: 2, backgroundColor: tokens.well, marginVertical: 3 },
  fill: { height: 4, borderRadius: 2 },
  tick: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 1,
    backgroundColor: tokens.textMuted,
    opacity: 0.6,
  },
  detail: { color: tokens.textMuted, fontSize: 13, lineHeight: 17 },
}));
