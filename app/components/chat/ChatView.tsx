import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AttachmentChip } from '@/components/chat/AttachmentChip';
import { detachAttachment, pickDocument, pickPhoto, uploadAttachment, type PendingAttachment, type PickedFile } from '@/components/chat/attachments';
import { Markdown } from '@/components/chat/Markdown';
import { ModelSheet } from '@/components/chat/ModelSheet';
import { Badge, Button, EmptyState, InlineNotice, LoadingState, Sheet, StatusDot } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import type { ChatItem } from '@/lib/chat/reducer';
import { useGateway } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';

const ATTACH_ICON = { ios: 'paperclip', android: 'attach_file', web: 'attach_file' } as const;

type UserItem = Extract<ChatItem, { kind: 'user' }>;

// A full conversation with one live session: history, the streaming reply,
// tool activity, and the composer. The session itself lives in ChatProvider.
// keyboardOffset is the height above the composer that the keyboard avoidance must
// clear. The stack route sits under a native header (88); a tab has none (0).
export function ChatView({ liveId, keyboardOffset = 88 }: { liveId: string; keyboardOffset?: number }) {
  const chat = useChat();
  const { rpc } = useGateway();
  const session = chat.state.sessions[liveId];
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [actionItem, setActionItem] = useState<ChatItem | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  // Uploads that finish after their chip was removed, or after this chat was left, are
  // detached when they arrive, so no photo stays queued on the session by accident.
  const alive = useRef(true);
  const dropped = useRef(new Set<string>());
  const pendingRef = useRef<PendingAttachment[]>([]);
  const rpcRef = useRef(rpc);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    rpcRef.current = rpc;
  }, [rpc]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const client = rpcRef.current;
      if (client) for (const item of pendingRef.current) void detachAttachment(client, liveId, item);
    };
  }, [liveId]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [session?.items.length, session?.streaming]);

  if (!session) return <LoadingState label="Opening chat…" />;

  const data: ChatItem[] = session.streaming
    ? [...session.items, { kind: 'assistant', id: 'streaming', text: session.streaming, status: 'complete' }]
    : session.items;

  const activity = session.thinking || session.statusLine || (session.running ? 'Working…' : '');
  const ready = pending.filter((item) => item.status === 'ready');
  const uploading = pending.some((item) => item.status === 'uploading');
  const failed = pending.some((item) => item.status === 'failed');
  const hasText = draft.trim().length > 0;
  const canStop = session.running && !hasText && pending.length === 0;
  const canSend = !sending && !uploading && !failed && (hasText || ready.length > 0);

  // Picks a photo or file, then uploads it straight away so the message can go out at once.
  const attach = async (pick: () => Promise<PickedFile | null>) => {
    setAttachOpen(false);
    setError(null);
    let file: PickedFile | null;
    try {
      file = await pick();
    } catch (caught) {
      setError(messageOf(caught));
      return;
    }
    if (!file) return;
    if (!rpc) {
      setError('Not connected to the gateway.');
      return;
    }
    const picked = file;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUri = picked.kind === 'image' ? picked.uri : undefined;
    setPending((list) => [...list, { key, name: picked.name, kind: picked.kind, previewUri, status: 'uploading' }]);
    try {
      const uploaded = await uploadAttachment(rpc, liveId, picked);
      if (dropped.current.delete(key) || !alive.current) {
        // Removed or left while uploading: take the image back off the session.
        void detachAttachment(rpc, liveId, { key, name: picked.name, kind: picked.kind, status: 'ready', ...uploaded });
        return;
      }
      setPending((list) => list.map((item) => (item.key === key ? { ...item, status: 'ready', ...uploaded } : item)));
    } catch (caught) {
      setPending((list) =>
        list.map((item) => (item.key === key ? { ...item, status: 'failed', error: messageOf(caught) } : item)),
      );
    }
  };

  const removeAttachment = (item: PendingAttachment) => {
    setPending((list) => list.filter((entry) => entry.key !== item.key));
    if (item.status === 'uploading') {
      // The upload is still running, so its result is detached when it arrives.
      dropped.current.add(item.key);
    } else if (rpc) {
      void detachAttachment(rpc, liveId, item);
    }
  };

  const send = async () => {
    if (!canSend) return;
    const text = draft.trim();
    const attachments = ready.map(({ name, kind, refText, previewUri }) => ({ name, kind, refText, previewUri }));
    setSending(true);
    setError(null);
    setDraft('');
    setPending([]);
    try {
      // A rejected send keeps its "Not sent" bubble and gives the draft and files back.
      const sent = await chat.submit(liveId, text, attachments);
      if (!sent) {
        setDraft(text);
        setPending(ready);
      }
    } catch (caught) {
      setError(messageOf(caught));
      setDraft(text);
      setPending(ready);
    } finally {
      setSending(false);
    }
  };

  // Sends a failed message again. The failed bubble goes first, so the chat does not show it twice.
  const retry = async (item: UserItem) => {
    setActionItem(null);
    setError(null);
    chat.dropItem(liveId, item.id);
    await chat.submit(liveId, item.text, item.attachments ?? []);
  };

  const copy = async (item: ChatItem | null) => {
    setActionItem(null);
    if (item && (item.kind === 'user' || item.kind === 'assistant' || item.kind === 'notice')) {
      await Clipboard.setStringAsync(item.text);
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

  const storedKey = session.storedKey;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={keyboardOffset}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
        <Pressable
          onPress={() => setModelOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose model and reasoning"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 13, flexShrink: 1 }}>
            {session.model || 'Choose a model'}
          </Text>
          <Text style={{ color: tokens.accent, fontSize: 13 }}>Change</Text>
        </Pressable>
        {storedKey ? (
          <Pressable
            onPress={() => router.push(`/session/${encodeURIComponent(storedKey)}`)}
            accessibilityRole="link"
            accessibilityLabel="Open chat details"
            style={{ paddingVertical: 4 }}>
            <Text style={{ color: tokens.accent, fontSize: 13, fontWeight: '600' }}>Details</Text>
          </Pressable>
        ) : null}
      </View>
      <ModelSheet
        key={liveId}
        visible={modelOpen}
        onClose={() => setModelOpen(false)}
        liveId={liveId}
        model={session.model}
        provider={session.provider}
        running={session.running}
        reasoning={session.reasoningEffort || null}
      />

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
        renderItem={({ item }) => <ChatRow item={item} onLongPress={setActionItem} onRetry={(user) => void retry(user)} />}
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
          gap: 8,
          padding: 10,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          borderTopWidth: 1,
          borderTopColor: tokens.line,
          backgroundColor: tokens.surface,
        }}>
        {pending.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {pending.map((item) => (
              <AttachmentChip
                key={item.key}
                name={item.name}
                kind={item.kind}
                previewUri={item.previewUri}
                status={item.status}
                error={item.error}
                onRemove={() => removeAttachment(item)}
              />
            ))}
          </ScrollView>
        ) : null}
        {failed ? (
          <Text style={{ color: tokens.danger, fontSize: 12 }}>Remove the file that could not be attached to send.</Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Pressable
            onPress={() => setAttachOpen(true)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo or file"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#3A4150',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.bg,
              opacity: sending ? 0.5 : 1,
            }}>
            <SymbolView name={ATTACH_ICON} tintColor={tokens.textMuted} size={22} />
          </Pressable>
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
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={{
                height: 44,
                paddingHorizontal: 18,
                borderRadius: 14,
                backgroundColor: tokens.accent,
                justifyContent: 'center',
                opacity: canSend ? 1 : 0.5,
              }}>
              <Text style={{ color: tokens.accentText, fontWeight: '600' }}>{session.running ? 'Queue' : 'Send'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach">
        <Button label="Photo library" onPress={() => void attach(pickPhoto)} />
        <Button label="Document" variant="secondary" onPress={() => void attach(pickDocument)} />
        <Button label="Cancel" variant="ghost" onPress={() => setAttachOpen(false)} />
      </Sheet>

      <Sheet visible={actionItem !== null} onClose={() => setActionItem(null)} title="Message">
        <Button label="Copy text" variant="secondary" onPress={() => void copy(actionItem)} />
        {actionItem?.kind === 'user' && actionItem.failed ? (
          <Button label="Send again" onPress={() => void retry(actionItem)} />
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={() => setActionItem(null)} />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

type RowProps = {
  item: ChatItem;
  onLongPress: (item: ChatItem) => void;
  onRetry: (item: UserItem) => void;
};

function ChatRow({ item, onLongPress, onRetry }: RowProps) {
  switch (item.kind) {
    case 'user':
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '84%', gap: 6, alignItems: 'flex-end' }}>
          {item.attachments?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              {item.attachments.map((attachment, index) => (
                <AttachmentChip
                  key={`${attachment.name}-${index}`}
                  name={attachment.name}
                  kind={attachment.kind}
                  previewUri={attachment.previewUri}
                />
              ))}
            </View>
          ) : null}
          {item.text ? (
            <Pressable
              onLongPress={() => onLongPress(item)}
              delayLongPress={350}
              accessibilityHint="Long press for copy and other actions"
              style={{ backgroundColor: tokens.surfaceRaised, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: tokens.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
            </Pressable>
          ) : null}
          {item.failed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: tokens.danger, fontSize: 12 }}>Not sent.</Text>
              <Pressable onPress={() => onRetry(item)} accessibilityRole="button" accessibilityLabel="Send this message again" hitSlop={8}>
                <Text style={{ color: tokens.accent, fontSize: 12, fontWeight: '600' }}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    case 'assistant':
      return (
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={350} style={{ maxWidth: '96%', gap: 6 }}>
          <Markdown source={item.text} />
          {item.status === 'error' ? <Badge label="Failed" tone="danger" /> : null}
          {item.status === 'interrupted' ? <Badge label="Stopped" tone="accent" /> : null}
        </Pressable>
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
