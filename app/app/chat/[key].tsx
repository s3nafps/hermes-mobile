import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ChatView } from '@/components/chat/ChatView';
import { tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { messageOf } from '@/lib/gateway/hooks';
import { ErrorState, LoadingState } from '@/components/ui';

// Opens one saved conversation by its stored key, or a new one when the key is "new".
export default function ChatRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const chat = useChat();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = key === 'new' ? await chat.createSession() : await chat.attach(String(key));
        if (!cancelled) setLiveId(id);
      } catch (caught) {
        if (!cancelled) setError(messageOf(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
    // The chat context is stable for the life of the app, so only the key and retries matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const title = (liveId && chat.state.sessions[liveId]?.title) || 'Chat';

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Stack.Screen options={{ title: title || 'Chat' }} />
      {error ? (
        <View style={{ padding: 16 }}>
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : liveId ? (
        <ChatView liveId={liveId} />
      ) : (
        <LoadingState label="Opening chat…" />
      )}
    </View>
  );
}
