import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  InlineNotice,
  LoadingState,
  Section,
  Segmented,
} from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import type { GatewayQuery } from '@/lib/gateway/hooks';

import { BranchCard } from './BranchCard';
import { ChangedFileRow } from './ChangedFileRow';
import { DiffView } from './DiffView';
import { GitLayoutSections } from './GitLayoutSections';
import type { GitLayout, RepoStatus, ReviewList, ReviewScope } from './types';
import { themed } from '@/lib/theme';

export type ListResult = ReviewList & { scope: ReviewScope };
export type DiffResult = { file: string; text: string };

const SCOPES: { value: ReviewScope; label: string }[] = [
  { value: 'uncommitted', label: 'Uncommitted' },
  { value: 'branch', label: 'Branch' },
];

type Props = {
  cwd: string;
  repo: RepoStatus;
  scope: ReviewScope;
  onScope: (scope: ReviewScope) => void;
  list: GatewayQuery<ListResult>;
  selected: string | null;
  onSelect: (path: string | null) => void;
  diff: GatewayQuery<DiffResult>;
  layout: GatewayQuery<GitLayout>;
};

// The body of the review screen once the working folder is a git repository.
export function ReviewPanel({ cwd, repo, scope, onScope, list, selected, onSelect, diff, layout }: Props) {
  // Data from the previous scope or file stays on screen until its replacement arrives.
  // These checks keep the screen from showing a stale list or diff under a new label.
  const current = list.data?.scope === scope ? list.data : undefined;
  const files = current?.files ?? [];
  const base = current?.base ?? null;
  const shownDiff = selected !== null && diff.data?.file === selected ? diff.data : undefined;

  return (
    <>
      <BranchCard repo={repo} cwd={cwd} />
      <Segmented
        options={SCOPES}
        value={scope}
        onChange={(next) => {
          onScope(next);
          onSelect(null);
        }}
      />
      {list.error ? <InlineNotice tone="danger">{list.error}</InlineNotice> : null}
      {!current && !list.error ? <LoadingState label="Loading changes…" /> : null}
      {current && files.length === 0 ? <EmptyChanges scope={scope} base={base} /> : null}
      {files.length > 0 ? (
        <Section label={scope === 'branch' ? `Changes against ${base ?? 'base'}` : 'Uncommitted changes'}>
          {files.map((file, index) => (
            <ChangedFileRow
              key={file.path}
              file={file}
              scope={scope}
              selected={file.path === selected}
              last={index === files.length - 1}
              onPress={() => onSelect(file.path === selected ? null : file.path)}
            />
          ))}
        </Section>
      ) : null}
      {selected ? (
        <Card>
          <View style={styles.diffHeader}>
            <Text style={styles.diffPath} numberOfLines={2}>
              {selected}
            </Text>
            <Button label="Close" variant="ghost" compact onPress={() => onSelect(null)} />
          </View>
          {shownDiff ? (
            <DiffView diff={shownDiff.text} />
          ) : diff.error ? (
            <InlineNotice tone="danger">{diff.error}</InlineNotice>
          ) : (
            <LoadingState label="Loading diff…" />
          )}
        </Card>
      ) : null}
      <InlineNotice tone="info">Commits and pushes happen on the desktop or in chat.</InlineNotice>
      {layout.data ? <GitLayoutSections layout={layout.data} /> : null}
      {layout.error ? <InlineNotice tone="danger">{layout.error}</InlineNotice> : null}
    </>
  );
}

function EmptyChanges({ scope, base }: { scope: ReviewScope; base: string | null }) {
  if (scope === 'uncommitted') {
    return <EmptyState title="Nothing to review" body="The working folder has no uncommitted changes." />;
  }
  if (!base) {
    return <EmptyState title="No base branch found" body="This repository has no default branch to compare against." />;
  }
  return <EmptyState title="No changes on this branch" body={`Nothing differs from ${base}.`} />;
}

const styles = themed(() => StyleSheet.create({
  diffHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diffPath: { flex: 1, color: tokens.text, fontFamily: MONO, fontSize: 13 },
}));
