import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import type { ChatItem } from '@/lib/chat/reducer';
import { messageOf } from '@/lib/gateway/hooks';
import { Badge, EmptyState, InlineNotice, LoadingState, StatusDot } from '@/components/ui';

// A full conversation with one live session: history, the streaming reply,
// tool activity, and the composer. The session itself lives in ChatProvider.
export function ChatView({ liveId }: { liveId: string }) {
  const chat = useChat();
  const session = chat.state.sessions[liveId];
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [session?.items.length, session?.streaming]);

  if (!session) return <LoadingState label="Opening chat…" />;

  const data: ChatItem[] = session.streaming
    ? [...session.items, { kind: 'assistant', id: 'streaming', text: session.streaming, status: 'complete' }]
    : session.items;

  const activity = session.thinking || session.statusLine || (session.running ? 'Working…' : '');
  const canStop = session.running && !draft.trim();

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    try {
      await chat.submit(liveId, text);
    } catch (caught) {
      setError(messageOf(caught));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const stop = async () => {
    setError(null);
    try {
      await chat.interrupt(liveId);
    } catch (caught) {
      setError(messageOf(caught));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title="Start a conversation"
            body="Messages stay in this chat, so you can come back to them later."
          />
        }
        renderItem={({ item }) => <ChatRow item={item} />}
      />

      {activity ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
          <StatusDot tone={session.running ? 'running' : 'neutral'} />
          <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 13, flex: 1 }}>
            {activity}
          </Text>
        </View>
      ) : null}

      {session.queued ? (
        <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 }}>
          Queued next: {session.queued}
        </Text>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <InlineNotice tone="danger">{error}</InlineNotice>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          padding: 10,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          borderTopWidth: 1,
          borderTopColor: tokens.line,
          backgroundColor: tokens.surface,
        }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Message Hermes"
          placeholderTextColor={tokens.textMuted}
          accessibilityLabel="Message"
          style={{
            flex: 1,
            maxHeight: 140,
            minHeight: 44,
            borderWidth: 1,
            borderColor: '#3A4150',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: tokens.text,
            backgroundColor: tokens.bg,
            fontSize: 16,
          }}
        />
        {canStop ? (
          <Pressable
            onPress={() => void stop()}
            accessibilityRole="button"
            accessibilityLabel="Stop the reply"
            style={{ height: 44, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: tokens.danger, justifyContent: 'center' }}>
            <Text style={{ color: tokens.danger, fontWeight: '600' }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={{
              height: 44,
              paddingHorizontal: 18,
              borderRadius: 14,
              backgroundColor: tokens.accent,
              justifyContent: 'center',
              opacity: !draft.trim() || sending ? 0.5 : 1,
            }}>
            <Text style={{ color: tokens.accentText, fontWeight: '600' }}>{session.running ? 'Queue' : 'Send'}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatRow({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '84%', gap: 4 }}>
          <View style={{ backgroundColor: tokens.surfaceRaised, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text selectable style={{ color: tokens.text, fontSize: 15, lineHeight: 21 }}>
              {item.text}
            </Text>
          </View>
          {item.failed ? <Text style={{ color: tokens.danger, fontSize: 12 }}>Not sent. Check the connection and try again.</Text> : null}
        </View>
      );
    case 'assistant':
      return (
        <View style={{ maxWidth: '96%', gap: 6 }}>
          <MessageText text={item.text} />
          {item.status === 'error' ? <Badge label="Failed" tone="danger" /> : null}
          {item.status === 'interrupted' ? <Badge label="Stopped" tone="accent" /> : null}
        </View>
      );
    case 'tool':
      return (
        <View style={{ backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.line, borderRadius: 12, padding: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusDot tone={item.done ? 'done' : 'running'} />
            <Text style={{ color: tokens.text, fontFamily: MONO, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>
              {item.done ? (item.durationS !== undefined ? `Done · ${item.durationS.toFixed(1)}s` : 'Done') : 'Running'}
            </Text>
          </View>
          {item.context ? (
            <Text style={{ color: tokens.textMuted, fontFamily: MONO, fontSize: 12 }} numberOfLines={2}>
              {item.context}
            </Text>
          ) : null}
          {item.summary ? <Text style={{ color: tokens.text, fontSize: 12 }} numberOfLines={3}>{item.summary}</Text> : null}
          {item.risk ? <Badge label={`Risk: ${item.risk}`} tone="danger" /> : null}
        </View>
      );
    case 'notice':
      return (
        <Text style={{ color: item.tone === 'error' ? tokens.danger : tokens.textMuted, fontSize: 13, textAlign: 'center' }}>
          {item.text}
        </Text>
      );
    default:
      return null;
  }
}

// Renders plain text, with fenced code blocks set in monospace.
function MessageText({ text }: { text: string }) {
  const parts = text.split('```');
  return (
    <View style={{ gap: 8 }}>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const code = part.replace(/^[\w-]*\n/, '').replace(/\n$/, '');
          return (
            <View key={index} style={{ backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.line, borderRadius: 10, padding: 10 }}>
              <Text selectable style={{ color: tokens.text, fontFamily: MONO, fontSize: 13, lineHeight: 19 }}>
                {code}
              </Text>
            </View>
          );
        }
        const body = part.trim();
        if (!body) return null;
        return (
          <Text key={index} selectable style={{ color: tokens.text, fontSize: 15, lineHeight: 22 }}>
            {body}
          </Text>
        );
      })}
    </View>
  );
}
