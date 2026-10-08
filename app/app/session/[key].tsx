import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { confirmAction } from '@/components/control/confirm';
import {
  deleteSession,
  fetchExport,
  fetchSession,
  fetchTranscript,
  OFFLINE_MESSAGE,
  renameSession,
  shareExport,
} from '@/components/session/api';
import { CheckpointsSection } from '@/components/session/CheckpointsSection';
import { formatWhen } from '@/components/session/format';
import { RenameSheet } from '@/components/session/RenameSheet';
import { SessionDetails } from '@/components/session/SessionDetails';
import { TranscriptPreview } from '@/components/session/TranscriptPreview';
import type { StoredSession, TranscriptLine } from '@/components/session/types';
import { ErrorState, InlineNotice, LoadingState, Row, Screen, ScreenTitle, Section } from '@/components/ui';
import { useChat } from '@/lib/chat/ChatProvider';
import { messageOf, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// Lines of the transcript shown here. The full conversation opens in the chat screen.
const PREVIEW_LINES = 12;

// One saved chat, keyed by its stored session id. Shows the saved facts, a transcript
// preview, checkpoints, and the actions for the chat.
export default function SessionDetailScreen() {
  const params = useLocalSearchParams<{ key: string }>();
  const storedKey = String(params.key ?? '');
  const { http, rpc, rpcStatus } = useGateway();
  const { attach, closeSession, state } = useChat();

  const session = useGatewayQuery<StoredSession>(
    http && storedKey ? () => fetchSession(http, storedKey) : null,
    [http, storedKey],
  );
  const transcript = useGatewayQuery<TranscriptLine[]>(
    http && storedKey ? () => fetchTranscript(http, storedKey, PREVIEW_LINES) : null,
    [http, storedKey],
  );

  // Checkpoints need the live session id, so the stored chat is attached first. The socket
  // can reopen with a new connection, so the attach runs again when it does.
  const [liveId, setLiveId] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachTick, setAttachTick] = useState(0);
  useEffect(() => {
    if (!rpc || rpcStatus !== 'open' || !storedKey) return;
    let cancelled = false;
    attach(storedKey).then(
      (id) => {
        if (cancelled) return;
        setLiveId(id);
        setAttachError(null);
      },
      (caught) => {
        // A failed re-attach drops the old id, so checkpoints never act on a session that may be gone.
        if (cancelled) return;
        setLiveId(null);
        setAttachError(messageOf(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [rpc, rpcStatus, storedKey, attach, attachTick]);

  const running = liveId ? (state.sessions[liveId]?.running ?? false) : false;

  const [renameOpen, setRenameOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const rename = useAction(async (title: string) => {
    if (!http) throw new Error(OFFLINE_MESSAGE);
    await renameSession(http, storedKey, title);
    return true as const;
  });

  const saveRename = async () => {
    const done = await rename.run(draftTitle);
    if (done) {
      setRenameOpen(false);
      session.refetch();
    }
  };

  const openRename = () => {
    setDraftTitle(session.data?.title ?? '');
    rename.clearError();
    setRenameOpen(true);
  };

  const exportChat = useAction(async () => {
    if (!http) throw new Error(OFFLINE_MESSAGE);
    const text = await fetchExport(http, storedKey);
    await shareExport(text, session.data?.title || 'Hermes chat');
    return true as const;
  });

  const removeChat = useAction(async () => {
    if (!http) throw new Error(OFFLINE_MESSAGE);
    await deleteSession(http, storedKey);
    if (liveId) {
      try {
        await closeSession(liveId);
      } catch {
        // The stored chat is already gone, so a failed close of the live copy is not an error here.
      }
    }
    return true as const;
  });

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/sessions');
  };

  const confirmDelete = () => {
    confirmAction({
      title: 'Delete this chat?',
      body: 'The conversation and its transcript are removed from this gateway.',
      action: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const done = await removeChat.run();
        if (done) leave();
      },
    });
  };

  const refreshAll = () => {
    session.refetch();
    transcript.refetch();
  };

  const title = session.data?.title || 'Chat';
  const subtitle = session.data
    ? [formatWhen(session.data.startedAt), session.data.messageCount !== null ? `${session.data.messageCount} messages` : '']
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen refreshing={session.loading} onRefresh={refreshAll}>
        {!session.data && session.error ? <ErrorState message={session.error} onRetry={session.refetch} /> : null}
        {!session.data && !session.error ? <LoadingState label="Loading chat…" /> : null}

        {session.data ? (
          <>
            {session.error ? <InlineNotice tone="danger">{session.error}</InlineNotice> : null}
            <ScreenTitle title={session.data.title || 'Untitled chat'} subtitle={subtitle} />
            <SessionDetails session={session.data} />

            <Section label="Open">
              <Row
                title="Open chat"
                subtitle="Continue this conversation"
                onPress={() => router.push(`/chat/${encodeURIComponent(storedKey)}`)}
              />
              <Row title="Review changes" onPress={() => router.push('/review')} />
              <Row title="Artifacts" onPress={() => router.push('/artifacts')} last />
            </Section>

            <Section label="Manage">
              <Row title="Rename" onPress={openRename} />
              <Row
                title="Export chat"
                subtitle={exportChat.pending ? 'Preparing the export…' : 'Share the transcript'}
                onPress={() => void exportChat.run()}
                disabled={exportChat.pending}
              />
              <Row
                title="Delete chat"
                subtitle="Removes it from this gateway"
                destructive
                onPress={confirmDelete}
                disabled={removeChat.pending}
                last
              />
            </Section>
            {exportChat.error ? <InlineNotice tone="danger">{exportChat.error}</InlineNotice> : null}
            {removeChat.error ? <InlineNotice tone="danger">{removeChat.error}</InlineNotice> : null}

            <CheckpointsSection
              liveId={liveId}
              running={running}
              attachError={attachError}
              onRetryAttach={() => setAttachTick((n) => n + 1)}
            />

            <TranscriptPreview
              lines={transcript.data}
              loading={transcript.loading}
              error={transcript.error}
              onRetry={transcript.refetch}
              pageSize={PREVIEW_LINES}
            />
          </>
        ) : null}
      </Screen>

      <RenameSheet
        visible={renameOpen}
        value={draftTitle}
        onChangeText={setDraftTitle}
        pending={rename.pending}
        error={rename.error}
        onSave={() => void saveRename()}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
}
