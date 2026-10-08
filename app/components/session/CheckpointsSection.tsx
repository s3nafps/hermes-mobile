import { useState } from 'react';
import { View } from 'react-native';

import { confirmAction } from '@/components/control/confirm';
import { fetchCheckpoints, OFFLINE_MESSAGE, restoreCheckpoint } from '@/components/session/api';
import {
  Button,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Section,
  SectionLabel,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import type { Checkpoint, CheckpointList } from './types';

type Props = {
  // The live session id from attach(). null while the chat is still opening.
  liveId: string | null;
  running: boolean;
  attachError: string | null;
  onRetryAttach: () => void;
};

// Restore points for one session, from rollback.list. Restoring rolls the session back,
// so every restore asks first.
export function CheckpointsSection({ liveId, running, attachError, onRetryAttach }: Props) {
  const { rpc } = useGateway();
  const [restored, setRestored] = useState(false);

  const list = useGatewayQuery<CheckpointList>(
    rpc && liveId ? () => fetchCheckpoints(rpc, liveId) : null,
    [rpc, liveId],
  );

  const restore = useAction(async (hash: string) => {
    if (!rpc || !liveId) throw new Error(OFFLINE_MESSAGE);
    await restoreCheckpoint(rpc, liveId, hash);
    return true as const;
  });

  const confirmRestore = (checkpoint: Checkpoint) => {
    confirmAction({
      title: 'Restore this checkpoint?',
      body: 'The session goes back to this point. Changes made after it may be lost.',
      action: 'Restore',
      destructive: true,
      onConfirm: async () => {
        setRestored(false);
        const done = await restore.run(checkpoint.hash);
        if (done) {
          setRestored(true);
          list.refetch();
        }
      },
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>Checkpoints</SectionLabel>
      {!liveId ? (
        attachError ? (
          <ErrorState message={attachError} onRetry={onRetryAttach} />
        ) : (
          <LoadingState label="Opening this chat…" />
        )
      ) : (
        <CheckpointBody
          list={list}
          running={running}
          restoreError={restore.error}
          restoring={restore.pending}
          restored={restored}
          onRestore={confirmRestore}
        />
      )}
    </View>
  );
}

type BodyProps = {
  list: { data: CheckpointList | undefined; error: string | null; loading: boolean; refetch: () => void };
  running: boolean;
  restoreError: string | null;
  restoring: boolean;
  restored: boolean;
  onRestore: (checkpoint: Checkpoint) => void;
};

function CheckpointBody({ list, running, restoreError, restoring, restored, onRestore }: BodyProps) {
  const data = list.data;
  if (!data) {
    if (list.error) return <ErrorState message={list.error} onRetry={list.refetch} />;
    return <LoadingState label="Loading checkpoints…" />;
  }
  if (!data.enabled) {
    return <InlineNotice tone="info">Checkpoints are turned off in this gateway.</InlineNotice>;
  }
  return (
    <View style={{ gap: 8 }}>
      {list.error ? <ErrorState message={list.error} onRetry={list.refetch} /> : null}
      {running ? <InlineNotice tone="info">A reply is running. Restores are refused until it finishes.</InlineNotice> : null}
      {restoreError ? <InlineNotice tone="danger">{restoreError}</InlineNotice> : null}
      {restored ? <InlineNotice tone="info">Checkpoint restored.</InlineNotice> : null}
      {data.checkpoints.length === 0 ? (
        <EmptyState title="No checkpoints yet" body="Checkpoints show here when the gateway saves them." />
      ) : (
        <Section>
          {data.checkpoints.map((checkpoint, index) => (
            <Row
              key={checkpoint.hash}
              title={checkpoint.message}
              subtitle={[checkpoint.when, checkpoint.hash.slice(0, 8)].filter(Boolean).join(' · ')}
              last={index === data.checkpoints.length - 1}
              right={
                <Button
                  label="Restore"
                  variant="secondary"
                  compact
                  disabled={restoring}
                  onPress={() => onRestore(checkpoint)}
                />
              }
            />
          ))}
        </Section>
      )}
    </View>
  );
}
