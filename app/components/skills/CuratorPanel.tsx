import { useState } from 'react';
import { View } from 'react-native';

import { requireHttp } from '@/components/bots/shared';
import {
  Button,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Section,
  Toggle,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { loadCurator, runCurator, setCuratorPaused } from './api';
import type { CuratorStatus } from './types';

// The curator reviews skills in the background. Status comes from the gateway as-is.
export function CuratorPanel() {
  const { http } = useGateway();
  const curator = useGatewayQuery<CuratorStatus>(async () => loadCurator(requireHttp(http)), [http]);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useAction(async () => {
    await runCurator(requireHttp(http));
    return true;
  });
  const pause = useAction(async (paused: boolean) => {
    await setCuratorPaused(requireHttp(http), paused);
    return paused;
  });

  const onRun = async () => {
    setNotice(null);
    if (!(await run.run())) return;
    setNotice('Review started. It runs in the background.');
    curator.refetch();
  };

  const onPause = async (paused: boolean) => {
    if (await pause.run(paused)) curator.refetch();
  };

  const data = curator.data;

  return (
    <>
      {curator.loading && !data ? <LoadingState label="Loading curator…" /> : null}
      {curator.error && !data ? <ErrorState message={curator.error} onRetry={curator.refetch} /> : null}
      {curator.error && data ? <InlineNotice tone="danger">{curator.error}</InlineNotice> : null}
      {run.error ? <InlineNotice tone="danger">{run.error}</InlineNotice> : null}
      {pause.error ? <InlineNotice tone="danger">{pause.error}</InlineNotice> : null}
      {notice ? <InlineNotice tone="info">{notice}</InlineNotice> : null}

      {data ? (
        <>
          {data.rows.length > 0 || data.paused !== null ? (
            <Section label="Status">
              {data.rows.map((row) => (
                <Row key={row.label} title={row.label} value={row.value} />
              ))}
              {data.paused !== null ? (
                <Row
                  title="Paused"
                  subtitle="A paused curator does not review skills."
                  last
                  right={
                    <Toggle
                      label="Pause the curator"
                      value={data.paused}
                      disabled={pause.pending}
                      onValueChange={(next) => void onPause(next)}
                    />
                  }
                />
              ) : null}
            </Section>
          ) : (
            <EmptyState title="No status yet" body="The gateway did not report curator details." />
          )}

          <View style={{ gap: 10 }}>
            <Button label="Run review now" onPress={() => void onRun()} loading={run.pending} />
          </View>
        </>
      ) : null}
    </>
  );
}
