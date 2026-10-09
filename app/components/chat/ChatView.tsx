import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AttachmentChip } from '@/components/chat/AttachmentChip';
import { detachAttachment, pickDocument, pickPhoto, uploadAttachment, type PendingAttachment, type PickedFile } from '@/components/chat/attachments';
import { Markdown } from '@/components/chat/Markdown';
import { ModelSheet } from '@/components/chat/ModelSheet';
import { useKeyboardHeight } from '@/components/navigation/useKeyboardHeight';
import { Badge, Button, EmptyState, InlineNotice, LoadingState, Sheet, StatusDot } from '@/components/ui';
import { MONO, lift, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { livePrompts, type ChatItem } from '@/lib/chat/reducer';
import { useGateway } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';

const ATTACH_ICON = { ios: 'paperclip', android: 'attach_file', web: 'attach_file' } as const;
const DETAILS_ICON = { ios: 'info.circle', android: 'info', web: 'info' } as const;
const TOOL_ICON = { ios: 'gearshape', android: 'settings', web: 'settings' } as const;

// Right-hand space the composer leaves while the floating tab button sits above the keyboard:
// the button's inset (16), its width (52) and a gap (8). The button then never covers Send.
const FLOATING_BUTTON_GUTTER = 76;

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
  // True while the reader is at the bottom. Only then does a new message or token scroll the list.
  const nearBottom = useRef(true);
  const keyboardHeight = useKeyboardHeight();

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

  // Follows the conversation, unless the reader has scrolled up to look at earlier text.
  useEffect(() => {
    if (nearBottom.current) listRef.current?.scrollToEnd({ animated: true });
  }, [session?.items.length]);
  useEffect(() => {
    if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false });
  }, [session?.streaming]);

  if (!session) return <LoadingState label="Opening chat…" />;

  const data: ChatItem[] = session.streaming
    ? [...session.items, { kind: 'assistant', id: 'streaming', text: session.streaming, status: 'complete' }]
    : session.items;

  // The agent is blocked on a prompt this screen never showed, for example one raised during a drop.
  const missedAnswer = session.waiting && !livePrompts(chat.state.prompts, Date.now()).some((prompt) => prompt.liveId === liveId);
  const activity =
    session.thinking ||
    session.statusLine ||
    (missedAnswer ? 'Waiting for an answer you did not see. Stop to cancel.' : session.running ? 'Working…' : '');
  // The waiting banner replaces the plain activity line while the agent waits on an answer this screen missed.
  const waitingBanner = missedAnswer && !session.thinking && !session.statusLine;
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
    // Sending brings the reader back to the bottom, where the new message appears.
    nearBottom.current = true;
    setSending(true);
    setError(null);
    setDraft('');
    setPending([]);
    try {
      // A send the gateway rejected keeps its "Not sent" bubble and gives the draft and files back.
      // One that may have arrived keeps its bubble only, so the user does not send it twice.
      const outcome = await chat.submit(liveId, text, attachments);
      if (outcome === 'failed') {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <Pressable
          onPress={() => setModelOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose model and reasoning"
          style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 13, flexShrink: 1 }}>
            {session.model || 'Choose a model'}
          </Text>
          <Text style={{ color: tokens.atext, fontSize: 13, fontWeight: '600' }}>Change</Text>
        </Pressable>
        {storedKey ? (
          <Pressable
            onPress={() => router.push(`/session/${encodeURIComponent(storedKey)}`)}
            accessibilityRole="link"
            accessibilityLabel="Open chat details"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: tokens.line,
              backgroundColor: tokens.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SymbolView name={DETAILS_ICON} tintColor={tokens.text} size={20} />
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
        reasoning={session.reasoningEffort}
      />

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        }}
        onScrollBeginDrag={() => {
          // A drag means the reader is looking at earlier text, so stop following the reply.
          nearBottom.current = false;
        }}
        scrollEventThrottle={100}
        ListEmptyComponent={
          <EmptyState
            title="Start a conversation"
            body="Messages stay in this chat, so you can come back to them later."
          />
        }
        renderItem={({ item }) => (
          <ChatRow
            item={item}
            onLongPress={setActionItem}
            onCopy={(reply) => void copy(reply)}
            onRetry={(user) => void retry(user)}
            onDismiss={(user) => chat.dropItem(liveId, user.id)}
          />
        )}
      />

      {waitingBanner ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginHorizontal: 16,
            marginBottom: 8,
            paddingLeft: 16,
            paddingRight: 4,
            paddingVertical: 4,
            minHeight: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: tokens.warn,
            backgroundColor: tokens.surface,
          }}>
          <Text numberOfLines={2} style={{ color: tokens.warnText, fontSize: 13, flex: 1 }}>
            {activity}
          </Text>
          {session.running && !canStop ? (
            <Pressable
              onPress={() => void stop()}
              accessibilityRole="button"
              accessibilityLabel="Stop the reply"
              style={{
                minWidth: 44,
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: tokens.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: tokens.danger, fontSize: 13, fontWeight: '600' }}>Stop</Text>
            </Pressable>
          ) : null}
        </View>
      ) : activity ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
          <StatusDot tone={session.running ? 'running' : 'neutral'} />
          <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 13, flex: 1 }}>
            {activity}
          </Text>
          {session.running && !canStop ? (
            // The composer shows Queue while there is text, so Stop lives here, always in reach.
            <Pressable
              onPress={() => void stop()}
              accessibilityRole="button"
              accessibilityLabel="Stop the reply"
              style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
              <Text style={{ color: tokens.danger, fontSize: 13, fontWeight: '600' }}>Stop</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {session.queued ? (
        <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 13, paddingHorizontal: 16, paddingBottom: 6 }}>
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
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingRight: keyboardHeight > 0 ? FLOATING_BUTTON_GUTTER : 12,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          backgroundColor: tokens.bg,
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
          <Text style={{ color: tokens.danger, fontSize: 13, paddingHorizontal: 4 }}>Remove the file that could not be attached to send.</Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 6,
            minHeight: 62,
            padding: 9,
            borderRadius: 31,
            borderWidth: 1,
            borderColor: tokens.line,
            backgroundColor: tokens.surface,
            ...lift('float'),
          }}>
          <Pressable
            onPress={() => setAttachOpen(true)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo or file"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.well,
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
              paddingHorizontal: 8,
              paddingVertical: 10,
              color: tokens.text,
              fontSize: 16,
            }}
          />
          {canStop ? (
            <Pressable
              onPress={() => void stop()}
              accessibilityRole="button"
              accessibilityLabel="Stop the reply"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: tokens.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: tokens.danger, fontSize: 13, fontWeight: '600' }}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={{
                height: 44,
                minWidth: 44,
                paddingHorizontal: 18,
                borderRadius: 22,
                backgroundColor: tokens.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canSend ? 1 : 0.5,
              }}>
              <Text style={{ color: tokens.accentText, fontSize: 15, fontWeight: '600' }}>{session.running ? 'Queue' : 'Send'}</Text>
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
        {actionItem?.kind === 'user' && (actionItem.failed || actionItem.unknown) ? (
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
  onCopy: (item: ChatItem) => void;
  onRetry: (item: UserItem) => void;
  onDismiss: (item: UserItem) => void;
};

function ChatRow({ item, onLongPress, onCopy, onRetry, onDismiss }: RowProps) {
  switch (item.kind) {
    case 'user':
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '82%', gap: 6, alignItems: 'flex-end' }}>
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
              style={{
                backgroundColor: tokens.tint,
                borderWidth: 1,
                borderColor: item.failed ? tokens.danger : tokens.tint,
                borderRadius: 18,
                borderBottomRightRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: item.pending ? 0.7 : 1,
              }}>
              <Text style={{ color: tokens.text, fontSize: 15, lineHeight: 22 }}>{item.text}</Text>
            </Pressable>
          ) : null}
          {item.pending ? <Text style={{ color: tokens.textMuted, fontSize: 13 }}>Sending…</Text> : null}
          {item.failed || item.unknown ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Text style={{ color: item.failed ? tokens.danger : tokens.warnText, fontSize: 13, paddingLeft: 4 }}>
                {item.failed ? 'Not sent.' : 'Not sure it was sent.'}
              </Text>
              <Pressable
                onPress={() => onRetry(item)}
                accessibilityRole="button"
                accessibilityLabel="Send this message again"
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}>
                <Text style={{ color: tokens.atext, fontSize: 13, fontWeight: '600' }}>{item.failed ? 'Retry' : 'Send again'}</Text>
              </Pressable>
              {item.unknown ? (
                <Pressable
                  onPress={() => onDismiss(item)}
                  accessibilityRole="button"
                  accessibilityLabel="It was already sent. Remove this copy"
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}>
                  <Text style={{ color: tokens.textMuted, fontSize: 13, fontWeight: '600' }}>It was sent</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    case 'assistant':
      return (
        <View style={{ gap: 8 }}>
          <Pressable onLongPress={() => onLongPress(item)} delayLongPress={350} style={{ gap: 8 }}>
            <Markdown source={item.text} />
            {item.status === 'error' ? <Badge label="Failed" tone="danger" /> : null}
            {item.status === 'interrupted' ? <Badge label="Stopped" tone="accent" /> : null}
          </Pressable>
          {item.id === 'streaming' ? null : (
            <Pressable
              onPress={() => onCopy(item)}
              accessibilityRole="button"
              accessibilityLabel="Copy text"
              style={{
                alignSelf: 'flex-start',
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 18,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: tokens.line,
                backgroundColor: tokens.surface,
              }}>
              <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '600' }}>Copy</Text>
            </Pressable>
          )}
        </View>
      );
    case 'tool':
      return <ToolRow item={item} />;
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

type ToolItem = Extract<ChatItem, { kind: 'tool' }>;

// One tool call as a card row. While it runs, its chip counts the seconds since the row appeared.
function ToolRow({ item }: { item: ToolItem }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (item.done) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [item.done]);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const status = item.done
    ? item.durationS !== undefined
      ? `Done · ${item.durationS.toFixed(1)}s`
      : 'Done'
    : `Running · ${elapsed}s`;

  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: tokens.line,
        backgroundColor: tokens.surface,
        ...lift('card'),
      }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.well, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name={TOOL_ICON} tintColor={tokens.textMuted} size={16} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: tokens.text, fontFamily: MONO, fontSize: 13 }} numberOfLines={1}>
          {item.name}
        </Text>
        {item.context ? (
          <Text style={{ color: tokens.textMuted, fontFamily: MONO, fontSize: 13 }} numberOfLines={2}>
            {item.context}
          </Text>
        ) : null}
        {item.summary ? (
          <Text style={{ color: tokens.text, fontSize: 13 }} numberOfLines={3}>
            {item.summary}
          </Text>
        ) : null}
        {item.risk ? <Badge label={`Risk: ${item.risk}`} tone="danger" /> : null}
      </View>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: item.done ? tokens.well : tokens.tint,
        }}>
        <Text numberOfLines={1} style={{ color: item.done ? tokens.textMuted : tokens.atext, fontFamily: MONO, fontSize: 13 }}>
          {status}
        </Text>
      </View>
    </View>
  );
}
