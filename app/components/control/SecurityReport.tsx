import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { untyped } from '@/components/control/client';
import type { AuditStatus } from '@/components/control/types';
import { Badge, Button, Card, InlineNotice } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
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

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heading}>Security report</Text>
          <Text style={styles.muted}>
            {latest.startedAt ? `Last run started ${latest.startedAt}` : 'Runs the hermes security audit on the host.'}
          </Text>
        </View>
        <StatusBadge report={report} counts={counts} />
      </View>

      {counts.critical + counts.high + counts.medium > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {counts.critical > 0 ? <Badge label={`${counts.critical} critical`} tone="danger" /> : null}
          {counts.high > 0 ? <Badge label={`${counts.high} high`} tone="danger" /> : null}
          {counts.medium > 0 ? <Badge label={`${counts.medium} medium`} tone="accent" /> : null}
        </View>
      ) : null}

      <Button
        label={running ? 'Audit running…' : 'Run security audit'}
        onPress={() => void run()}
        loading={starting}
        disabled={running || starting}
      />

      {actionError ? <InlineNotice tone="danger">{actionError}</InlineNotice> : null}
      {audit.error && !report ? <InlineNotice tone="danger">{audit.error}</InlineNotice> : null}

      {latest.entries.length > 0 ? (
        <ScrollView style={styles.report} contentContainerStyle={{ padding: 12, gap: 2 }} nestedScrollEnabled>
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
    </Card>
  );
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
  if (severity === 'MEDIUM' || severity === 'MODERATE') return tokens.accent;
  return tokens.text;
}

// The status comes from the findings first. The exit code only decides when nothing was
// listed: the server's audit exits 1 only for critical findings, so a clean exit can still
// hide high ones, and the counts must win.
function StatusBadge({ report, counts }: { report: AuditStatus | undefined; counts: SeverityCounts }) {
  if (!report) return <Badge label="No report" />;
  if (report.running) return <Badge label="Running" tone="accent" />;
  if (counts.critical + counts.high > 0) return <Badge label="Findings" tone="danger" />;
  if (counts.medium > 0) return <Badge label="Review" tone="accent" />;
  if (report.exit_code === null) return <Badge label="Saved report" />;
  if (report.exit_code === 0) return <Badge label="Clean" tone="done" />;
  if (report.exit_code === 1) return <Badge label="Findings" tone="danger" />;
  return <Badge label={`Exit ${report.exit_code}`} tone="danger" />;
}

const styles = themed(() => StyleSheet.create({
  heading: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '600',
  },
  muted: {
    color: tokens.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  report: {
    maxHeight: 300,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.bg,
  },
  line: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
  },
}));
