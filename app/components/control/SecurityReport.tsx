import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { untyped } from '@/components/control/client';
import type { AuditStatus } from '@/components/control/types';
import { Badge, Button, Card, InlineNotice } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import { useGateway, useGatewayQuery } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';

const LINES_TO_SHOW = 400;
const POLL_WHILE_RUNNING_MS = 2000;

// Runs the host's security audit and shows its report. The server keeps the last audit
// log, so the most recent report is still here after the app or the server restarts.
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
  const lines = report?.lines ?? [];
  const running = report?.running === true;
  const counts = countSeverities(lines);

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heading}>Security report</Text>
          <Text style={styles.muted}>Runs the hermes security audit on the host.</Text>
        </View>
        <StatusBadge report={report} />
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

      {lines.length > 0 ? (
        <ScrollView style={styles.report} contentContainerStyle={{ padding: 12, gap: 2 }} nestedScrollEnabled>
          {lines.map((line, index) => (
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

// The audit writes one entry per finding, starting with its severity in capitals,
// for example "CRITICAL  PyJWT==2.13.0  GHSA-…". Matching capitals avoids
// counting ordinary words in the descriptions.
const SEVERITY = /\b(CRITICAL|HIGH|MEDIUM)\b/;

type SeverityCounts = { critical: number; high: number; medium: number };

function countSeverities(lines: string[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0 };
  for (const line of lines) {
    const match = SEVERITY.exec(line);
    if (!match) continue;
    if (match[1] === 'CRITICAL') counts.critical += 1;
    else if (match[1] === 'HIGH') counts.high += 1;
    else counts.medium += 1;
  }
  return counts;
}

function toneOf(line: string): string {
  const match = SEVERITY.exec(line);
  if (match?.[1] === 'CRITICAL' || match?.[1] === 'HIGH') return tokens.danger;
  if (match?.[1] === 'MEDIUM') return tokens.accent;
  return tokens.text;
}

// Exit 0 means the audit ran with nothing to report. Exit 1 means it reported findings.
function StatusBadge({ report }: { report: AuditStatus | undefined }) {
  if (!report) return <Badge label="No report" />;
  if (report.running) return <Badge label="Running" tone="accent" />;
  if (report.exit_code === null) return <Badge label="Finished" />;
  if (report.exit_code === 0) return <Badge label="Clean" tone="done" />;
  if (report.exit_code === 1) return <Badge label="Findings" tone="danger" />;
  return <Badge label={`Exit ${report.exit_code}`} tone="danger" />;
}

const styles = StyleSheet.create({
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
});
