import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { NoWorkingFolder } from '@/components/review/NoWorkingFolder';
import { ReviewPanel, type DiffResult, type ListResult } from '@/components/review/ReviewPanel';
import { NOT_CONNECTED, fetchFileDiff, fetchLayout, fetchRepoStatus, fetchReviewList } from '@/components/review/api';
import type { GitLayout, RepoStatus, ReviewScope } from '@/components/review/types';
import { useWorkingFolder } from '@/components/review/useWorkingFolder';
import { EmptyState, ErrorState, LoadingState, Screen, ScreenTitle } from '@/components/ui';
import { useGateway, useGatewayQuery } from '@/lib/gateway';

// Refresh interval while the screen is open. The agent changes files during a turn.
const POLL_MS = 6000;

// Git review of the chat's working folder. Read only: commits and pushes happen on the desktop or in chat.
export default function ReviewScreen() {
  const { http } = useGateway();
  const cwd = useWorkingFolder();
  const [scope, setScope] = useState<ReviewScope>('uncommitted');
  const [selected, setSelected] = useState<string | null>(null);

  const status = useGatewayQuery<RepoStatus | null>(
    http && cwd ? () => fetchRepoStatus(http, cwd) : null,
    [http, cwd],
    { pollMs: POLL_MS },
  );
  const list = useGatewayQuery<ListResult>(
    http && cwd ? () => fetchReviewList(http, cwd, scope).then((data) => ({ ...data, scope })) : null,
    [http, cwd, scope],
    { pollMs: POLL_MS },
  );
  const diff = useGatewayQuery<DiffResult>(
    http && cwd && selected ? () => fetchFileDiff(http, cwd, selected, scope).then((text) => ({ file: selected, text })) : null,
    [http, cwd, selected, scope],
    { pollMs: selected ? POLL_MS : undefined },
  );
  const layout = useGatewayQuery<GitLayout>(http && cwd ? () => fetchLayout(http, cwd) : null, [http, cwd]);

  const refreshAll = () => {
    status.refetch();
    list.refetch();
    diff.refetch();
    layout.refetch();
  };

  let content: ReactNode;
  const repo = status.data;
  if (!http) {
    content = <ErrorState message={NOT_CONNECTED} />;
  } else if (!cwd) {
    content = <NoWorkingFolder />;
  } else if (repo === undefined) {
    content = status.error ? (
      <ErrorState message={status.error} onRetry={status.refetch} />
    ) : (
      <LoadingState label="Reading the repository…" />
    );
  } else if (repo === null) {
    content = <EmptyState title="Not a git repository" body={`${cwd} is not inside a git repository, so there is nothing to review.`} />;
  } else {
    content = (
      <ReviewPanel
        cwd={cwd}
        repo={repo}
        scope={scope}
        onScope={setScope}
        list={list}
        selected={selected}
        onSelect={setSelected}
        diff={diff}
        layout={layout}
      />
    );
  }

  return (
    <Screen onRefresh={refreshAll}>
      <Stack.Screen options={{ title: 'Review' }} />
      <ScreenTitle title="Review" subtitle="Changes in the chat's working folder" />
      {content}
    </Screen>
  );
}
