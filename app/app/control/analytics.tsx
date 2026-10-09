import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { untyped } from '@/components/control/client';
import { cacheHitRate, compactNumber, money, percent } from '@/components/control/format';
import { StatTile } from '@/components/control/StatTile';
import type { ModelAnalytics, UsageAnalytics } from '@/components/control/types';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
  Segmented,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useGateway, useGatewayQuery } from '@/lib/gateway';
import { themed } from '@/lib/theme';

type Range = '7' | '30' | '90';

const RANGES: { value: Range; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

// Token use, cache hit rate and cost from the gateway's usage records.
export default function AnalyticsScreen() {
  const { http } = useGateway();
  const [range, setRange] = useState<Range>('7');
  const days = Number(range);

  const usage = useGatewayQuery<UsageAnalytics>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      const data = untyped<UsageAnalytics>(await http.GET('/api/analytics/usage', { params: { query: { days } } }));
      if (!data?.totals) throw new Error('The gateway sent usage data in an unexpected shape.');
      return data;
    },
    [http, days],
  );

  const models = useGatewayQuery<ModelAnalytics>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      const data = untyped<ModelAnalytics>(await http.GET('/api/analytics/models', { params: { query: { days } } }));
      if (!Array.isArray(data?.models)) throw new Error('The gateway sent model data in an unexpected shape.');
      return data;
    },
    [http, days],
  );

  const totals = usage.data?.totals;
  const hitRate = totals ? cacheHitRate(totals.total_input, totals.total_cache_read) : null;
  const modelRows = models.data?.models ?? [];

  return (
    <Screen onRefresh={() => { usage.refetch(); models.refetch(); }} refreshing={usage.loading && !!usage.data}>
      <Stack.Screen options={{ title: 'Analytics' }} />
      <ScreenTitle title="Analytics" subtitle="Usage across all sessions." />

      <Segmented options={RANGES} value={range} onChange={setRange} />

      {usage.loading && !usage.data ? <LoadingState label="Loading usage…" /> : null}
      {usage.error && !usage.data ? <ErrorState message={usage.error} onRetry={usage.refetch} /> : null}

      {totals ? (
        <>
          <View style={styles.grid}>
            <StatTile label="Input tokens" value={compactNumber(totals.total_input)} />
            <StatTile label="Output tokens" value={compactNumber(totals.total_output)} />
            <StatTile label="Cache hit rate" value={percent(hitRate)} />
            <StatTile label="Estimated cost" value={money(totals.total_estimated_cost)} />
          </View>
          <Text style={styles.caption}>{`${compactNumber(totals.total_sessions)} sessions in the last ${days} days.`}</Text>
        </>
      ) : null}

      {models.loading && !models.data ? <LoadingState label="Loading models…" /> : null}
      {models.error ? <ErrorState message={models.error} onRetry={models.refetch} /> : null}

      {modelRows.length === 0 && models.data ? (
        <EmptyState title="No model usage yet" body={`Nothing was recorded in the last ${days} days.`} />
      ) : null}
      {modelRows.length > 0 ? (
        <Section label="By model">
          {modelRows.map((row, index) => {
            const hit = cacheHitRate(row.total_input, row.total_cache_read);
            return (
              <Row
                key={row.model}
                title={row.model}
                subtitle={`${compactNumber(row.total_input + row.total_output)} tokens · ${percent(hit)} cache hit · ${row.sessions} sessions`}
                value={money(row.total_estimated_cost)}
                last={index === modelRows.length - 1}
              />
            );
          })}
        </Section>
      ) : null}

      {totals ? (
        <Card>
          <Text style={styles.note}>
            Cache hit rate is cache reads divided by input plus cache reads. Costs are estimates from the gateway.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  caption: { color: tokens.textMuted, fontSize: 13, marginTop: -8 },
  note: { color: tokens.textMuted, fontSize: 12, lineHeight: 18 },
}));
