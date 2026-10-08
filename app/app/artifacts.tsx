import { Stack } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { listFolder, loadPreview } from '@/components/artifacts/api';
import { EntryRow } from '@/components/artifacts/EntryRow';
import { FilePreview } from '@/components/artifacts/FilePreview';
import { canLoadPreview, sortEntries } from '@/components/artifacts/fileKind';
import type { FilePreviewData, FolderResult, ManagedEntry } from '@/components/artifacts/types';
import { NOT_CONNECTED } from '@/components/review/api';
import { NoWorkingFolder } from '@/components/review/NoWorkingFolder';
import { useWorkingFolder } from '@/components/review/useWorkingFolder';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Screen,
  ScreenTitle,
  Section,
  Sheet,
} from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import { useGateway, useGatewayQuery } from '@/lib/gateway';

// Refresh interval while the screen is open. The agent writes files during a turn.
const POLL_MS = 10000;

// The parent of a path, never above the root. Keeps folder navigation inside the working folder.
function parentWithin(path: string, root: string): string {
  const cut = path.lastIndexOf('/');
  const parent = cut > 0 ? path.slice(0, cut) : root;
  return parent === root || parent.startsWith(root + '/') ? parent : root;
}

// Files in the chat's working folder. Tap a folder to open it, or a text file to read it.
export default function ArtifactsScreen() {
  const { http } = useGateway();
  const cwd = useWorkingFolder();
  const [subdir, setSubdir] = useState<{ root: string; path: string } | null>(null);
  const [opened, setOpened] = useState<ManagedEntry | null>(null);

  // A subfolder only applies while it belongs to the current working folder.
  const current = cwd && subdir && subdir.root === cwd ? subdir.path : cwd;
  const atRoot = current === cwd;

  const listing = useGatewayQuery<FolderResult>(
    http && current ? () => listFolder(http, current) : null,
    [http, current],
    { pollMs: POLL_MS },
  );
  // Rows only come from the folder that was asked for. Otherwise opening a folder would
  // briefly show the one before it.
  const shown = listing.data && listing.data.requested === current ? listing.data : undefined;
  const rows = useMemo(() => sortEntries(shown?.entries ?? []), [shown]);

  const preview = useGatewayQuery<FilePreviewData>(
    http && opened && canLoadPreview(opened) ? () => loadPreview(http, opened) : null,
    [http, opened?.path],
  );

  let content: ReactNode;
  if (!http) {
    content = <ErrorState message={NOT_CONNECTED} />;
  } else if (!cwd || !current) {
    content = <NoWorkingFolder />;
  } else if (shown === undefined) {
    content = listing.error ? (
      <ErrorState message={listing.error} onRetry={listing.refetch} />
    ) : (
      <LoadingState label="Reading the folder…" />
    );
  } else {
    content = (
      <>
        <Card style={{ gap: 8 }}>
          <Text style={styles.label}>Folder</Text>
          <Text style={styles.folder} numberOfLines={1} ellipsizeMode="head">
            {current}
          </Text>
          {atRoot ? null : (
            <Button
              label="Up one folder"
              variant="secondary"
              compact
              onPress={() => setSubdir({ root: cwd, path: parentWithin(current, cwd) })}
            />
          )}
        </Card>
        {listing.error ? <InlineNotice tone="danger">{listing.error}</InlineNotice> : null}
        {rows.length === 0 ? (
          <EmptyState
            title={atRoot ? 'No files yet' : 'This folder is empty'}
            body={atRoot ? 'Files written in this folder will show here.' : undefined}
          />
        ) : (
          <Section label={atRoot ? 'Files' : 'Contents'}>
            {rows.map((entry, index) => (
              <EntryRow
                key={entry.path}
                entry={entry}
                last={index === rows.length - 1}
                onPress={() => (entry.is_directory ? setSubdir({ root: cwd, path: entry.path }) : setOpened(entry))}
              />
            ))}
          </Section>
        )}
        <InlineNotice tone="info">
          Lists every file in this folder. The gateway does not mark which files the agent wrote.
        </InlineNotice>
      </>
    );
  }

  return (
    <Screen onRefresh={listing.refetch}>
      <Stack.Screen options={{ title: 'Artifacts' }} />
      <ScreenTitle title="Artifacts" subtitle="Files in the chat's working folder" />
      {content}
      <Sheet visible={opened !== null} onClose={() => setOpened(null)} title={opened?.name ?? 'File'}>
        {opened ? <FilePreview entry={opened} preview={preview} /> : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: tokens.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  folder: { color: tokens.text, fontFamily: MONO, fontSize: 13 },
});
