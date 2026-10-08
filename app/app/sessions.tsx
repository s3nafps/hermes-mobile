import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { useGateway } from '@/lib/gateway';
import { useAction, useGatewayQuery } from '@/lib/gateway/hooks';
import { Button, EmptyState, ErrorState, LoadingState, Row, Screen, Section } from '@/components/ui';

type SessionRow = {
  id: string;
  title: string;
  preview: string;
  started_at: number;
  message_count: number;
  source: string;
};

function when(epochSeconds: number): string {
  if (!epochSeconds) return '';
  const date = new Date(epochSeconds * 1000);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Saved conversations, newest first. Tap to open, long-press to delete.
export default function SessionsScreen() {
  const { rpc } = useGateway();
  const [query, setQuery] = useState('');
  const list = useGatewayQuery<{ sessions: SessionRow[] }>(
    rpc ? () => rpc.call<{ sessions: SessionRow[] }>('session.list', { limit: 200 }) : null,
    [rpc],
  );
  const remove = useAction(async (id: string) => {
    if (!rpc) throw new Error('Not connected to the gateway.');
    await rpc.call('session.delete', { session_id: id });
  });

  // Reload when the screen comes back into focus, so renames and new messages show up.
  const { refetch } = list;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const sessions = useMemo(() => {
    const all = list.data?.sessions ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => `${s.title} ${s.preview}`.toLowerCase().includes(q));
  }, [list.data, query]);

  const confirmDelete = (session: SessionRow) => {
    Alert.alert('Delete this chat?', 'The conversation and its transcript are removed from this gateway.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const done = await remove.run(session.id);
          if (done !== undefined) list.refetch();
          else if (remove.error) Alert.alert('Could not delete', remove.error);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sessions', headerRight: () => <Button label="New" compact variant="ghost" onPress={() => router.push('/chat/new')} /> }} />
      <Screen refreshing={list.loading} onRefresh={list.refetch}>
        <View style={{ gap: 12 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={tokens.textMuted}
            accessibilityLabel="Search chats"
            autoCapitalize="none"
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: tokens.line,
              borderRadius: 12,
              backgroundColor: tokens.surface,
              color: tokens.text,
              paddingHorizontal: 14,
              fontSize: 15,
            }}
          />
          {list.error ? <ErrorState message={list.error} onRetry={list.refetch} /> : null}
          {!list.data && list.loading ? <LoadingState label="Loading chats…" /> : null}
          {list.data && sessions.length === 0 ? (
            <EmptyState
              title={query ? 'No chats match' : 'No chats yet'}
              body={query ? 'Try a different search.' : 'Start a new chat and it will appear here after your first message.'}
            />
          ) : null}
          {sessions.length ? (
            <Section>
              {sessions.map((session, index) => (
                <Row
                  key={session.id}
                  testID={`session-${session.id}`}
                  title={session.title || session.preview || 'Untitled chat'}
                  subtitle={session.preview && session.title ? session.preview : `${session.message_count} messages · ${session.source || 'app'}`}
                  value={when(session.started_at)}
                  last={index === sessions.length - 1}
                  onPress={() => router.push(`/chat/${encodeURIComponent(session.id)}`)}
                  right={
                    <Text
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${session.title || 'chat'}`}
                      onPress={() => confirmDelete(session)}
                      style={{ color: tokens.danger, fontSize: 13, paddingLeft: 8 }}>
                      Delete
                    </Text>
                  }
                />
              ))}
            </Section>
          ) : null}
        </View>
      </Screen>
    </>
  );
}
