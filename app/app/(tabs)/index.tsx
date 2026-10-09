import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatView } from '@/components/chat/ChatView';
import { tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { useGateway } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';
import { Button, ErrorState, LoadingState } from '@/components/ui';

// Chat tab: opens the most recent conversation, or starts a new one.
export default function ChatTab() {
  const { rpc } = useGateway();
  const chat = useChat();
  const insets = useSafeAreaInsets();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loads the newest conversation (or starts one). Runs once the gateway is online.
  useEffect(() => {
    if (liveId || !rpc) return;
    let cancelled = false;
    (async () => {
      try {
        const recent = await rpc.call<{ session_id: string | null }>('session.most_recent');
        const id = recent.session_id ? await chat.attach(recent.session_id) : await chat.createSession();
        if (!cancelled) setLiveId(id);
      } catch (caught) {
        if (!cancelled) setError(messageOf(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveId, rpc, chat]);

  const retry = () => {
    setError(null);
    setLiveId(null);
  };

  const startNew = useCallback(async () => {
    setError(null);
    try {
      setLiveId(await chat.createSession());
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [chat]);

  const title = (liveId && chat.state.sessions[liveId]?.title) || 'Chat';

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 18, fontWeight: '600' }}>
            {title}
          </Text>
        </View>
        <Button label="Sessions" variant="secondary" compact onPress={() => router.push('/sessions')} />
        <Button label="New" variant="primary" compact onPress={() => void startNew()} />
      </View>
      {error ? (
        <View style={{ padding: 16 }}>
          <ErrorState message={error} onRetry={retry} />
        </View>
      ) : liveId ? (
        <ChatView key={liveId} liveId={liveId} keyboardOffset={0} />
      ) : (
        <LoadingState label="Opening your chat…" />
      )}
    </View>
  );
}
