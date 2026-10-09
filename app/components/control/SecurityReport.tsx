import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { untyped } from '@/components/control/client';
import type { AuditStatus } from '@/components/control/types';
import { Button, InlineNotice } from '@/components/ui';
import { lift, MONO, tokens } from '@/constants/tokens';
import { useGateway, useGatewayQuery } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';
import { themed } from '@/lib/theme';

const LINES_TO_SHOW = 400;
const POLL_WHILE_RUNNING_MS = 2000;

// The audit log is never truncated, so one tail can hold several runs. Each run opens
// with a header line, and only the lines after the newest header belong to the latest run.
const RUN_HEADER = /^=+ security-audit started (.+?) =+$/;

// The audit prints each finding's severity in capitals. GitHub advisories use MODERATE
// for what the audit calls medium.
const SEVERITY = /\b(CRITICAL|HIGH|MODERATE|MEDIUM)\b/;

// Runs the host's security audit and shows the latest report. The server keeps the audit
// log between runs, so the most recent report is still here after a reload or restart.
export function SecurityReport() {
  const { http } = useGateway();
  const [watching, setWatching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const now = useMinuteClock();

  const audit = useGatewayQuery<AuditStatus>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      const status = untyped<AuditStatus>(
        await http.GET('/api/actions/{name}/status', {
          params: { path: { name: 'security-audit' }, query: { lines: LINES_TO_SHOW } },
        }),
      );
      // Keep polling only while the audit process is alive.
      setWatching(status.running);
      return status;
    },
    [http],
    { pollMs: watching ? POLL_WHILE_RUNNING_MS : undefined },
  );

  const run = async () => {
    if (!http) return;
    setActionError(null);
    setStarting(true);
    try {
      untyped(await http.POST('/api/ops/security-audit'));
      setWatching(true);
      audit.refetch();
    } catch (caught) {
      setActionError(messageOf(caught));
    } finally {
      setStarting(false);
    }
  };

  const report = audit.data;
  const running = report?.running === true;
  const latest = latestRun(report?.lines ?? []);
  const counts = countSeverities(latest.entries);
  const since = latest.startedAt ? timeSince(latest.startedAt, now) : null;
  const status = statusOf(report, counts);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Security report</Text>
          <Text style={styles.muted}>
            {latest.startedAt
              ? `Last run started ${latest.startedAt}${since ? ` · ${since}` : ''}`
              : 'Runs the hermes security audit on the host.'}
          </Text>
        </View>
        <Pill label={status.label} tone={status.tone} />
      </View>

      {counts.critical + counts.high + counts.medium > 0 ? (
        <View style={styles.counts}>
          {counts.critical > 0 ? <Pill label={`${counts.critical} critical`} tone="danger" /> : null}
          {counts.high > 0 ? <Pill label={`${counts.high} high`} tone="danger" /> : null}
          {counts.medium > 0 ? <Pill label={`${counts.medium} medium`} tone="warn" /> : null}
        </View>
      ) : null}

      <Button
        label={running ? 'Audit running…' : 'Run security audit'}
        onPress={() => void run()}
        loading={starting}
        disabled={running || starting}
        style={styles.run}
      />

      {actionError ? <InlineNotice tone="danger">{actionError}</InlineNotice> : null}
      {audit.error && !report ? <InlineNotice tone="danger">{audit.error}</InlineNotice> : null}

      {latest.entries.length > 0 ? (
        <ScrollView style={styles.report} contentContainerStyle={styles.reportContent} nestedScrollEnabled>
          {latest.entries.map((line, index) => (
            <Text key={index} selectable style={[styles.line, { color: toneOf(line) }]}>
              {line || ' '}
            </Text>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.muted}>
          {running ? 'Waiting for the first lines…' : 'No report yet. Run the audit to check this server for risky settings.'}
        </Text>
      )}
    </View>
  );
}

type PillTone = 'done' | 'danger' | 'warn' | 'accent' | 'neutral';

function Pill({ label, tone }: { label: string; tone: PillTone }) {
  const { color, background } = pillColors(tone);
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function pillColors(tone: PillTone): { color: string; background: string } {
  switch (tone) {
    case 'done':
      return { color: tokens.done, background: fade(tokens.done, 0.14) };
    case 'danger':
      return { color: tokens.danger, background: fade(tokens.danger, 0.14) };
    case 'warn':
      return { color: tokens.warnText, background: fade(tokens.warn, 0.14) };
    case 'accent':
      return { color: tokens.atext, background: tokens.tint };
    default:
      return { color: tokens.textMuted, background: tokens.well };
  }
}

// Returns the lines of the newest run. Without a header in the tail, every line is shown.
function latestRun(lines: string[]): { startedAt: string | null; entries: string[] } {
  let start = -1;
  let startedAt: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const match = RUN_HEADER.exec(lines[i].trim());
    if (match) {
      start = i;
      startedAt = match[1];
    }
  }
  return { startedAt, entries: start >= 0 ? lines.slice(start + 1) : lines };
}

type SeverityCounts = { critical: number; high: number; medium: number };

function countSeverities(lines: string[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0 };
  for (const line of lines) {
    const severity = SEVERITY.exec(line)?.[1];
    if (severity === 'CRITICAL') counts.critical += 1;
    else if (severity === 'HIGH') counts.high += 1;
    else if (severity === 'MEDIUM' || severity === 'MODERATE') counts.medium += 1;
  }
  return counts;
}

function toneOf(line: string): string {
  const severity = SEVERITY.exec(line)?.[1];
  if (severity === 'CRITICAL' || severity === 'HIGH') return tokens.danger;
  if (severity === 'MEDIUM' || severity === 'MODERATE') return tokens.warnText;
  return tokens.text;
}

// The status comes from the findings first. The exit code only decides when nothing was
// listed: the server's audit exits 1 only for critical findings, so a clean exit can still
// hide high ones, and the counts must win.
function statusOf(
  report: AuditStatus | undefined,
  counts: SeverityCounts,
): { label: string; tone: PillTone } {
  if (!report) return { label: 'No report', tone: 'neutral' };
  if (report.running) return { label: 'Running', tone: 'accent' };
  if (counts.critical + counts.high > 0) return { label: 'Findings', tone: 'danger' };
  if (counts.medium > 0) return { label: 'Review', tone: 'warn' };
  if (report.exit_code === null) return { label: 'Saved report', tone: 'neutral' };
  if (report.exit_code === 0) return { label: 'Clean', tone: 'done' };
  if (report.exit_code === 1) return { label: 'Findings', tone: 'danger' };
  return { label: `Exit ${report.exit_code}`, tone: 'danger' };
}

// A clock that ticks once a minute. The time since the last audit only needs that precision.
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// "3 h ago" style text for the audit's start time. Returns null when the header's timestamp
// does not parse as a date, so the subtitle keeps the raw start time instead.
function timeSince(startedAt: string, now: number): string | null {
  const then = Date.parse(startedAt);
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
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
    gap: 14,
    ...lift('card'),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  heading: { color: tokens.text, fontSize: 17, fontWeight: '600' },
  muted: { color: tokens.textMuted, fontSize: 13, lineHeight: 18 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  run: { minHeight: 44, borderRadius: 14 },
  report: {
    maxHeight: 300,
    borderRadius: 14,
    backgroundColor: tokens.well,
  },
  reportContent: { padding: 12, gap: 2 },
  line: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
  },
}));
