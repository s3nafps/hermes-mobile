import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { livePrompts, type Notice, type PendingPrompt } from '@/lib/chat/reducer';
import { PROMPT_WINDOW_MS, type ApprovalChoice } from '@/lib/chat/types';
import { messageOf, useLiveScreen } from '@/lib/gateway/hooks';
import { Button, Card, EmptyState, InlineNotice, Screen, ScreenTitle, Segmented, Section, Row } from '@/components/ui';

type Tab = 'needs' | 'updates';

// Everything waiting for the user: approvals and questions from the agent, plus
// results from background work and failed turns.
export default function InboxScreen() {
  const chat = useChat();
  const [tab, setTab] = useState<Tab>('needs');
  const [now, setNow] = useState(() => Date.now());
  // The clock only ticks while this tab is on screen, so the inbox does not re-render in the background.
  const live = useLiveScreen();
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const prompts = livePrompts(chat.state.prompts, now);
  const notices = chat.state.notices;

  return (
    <Screen>
      <ScreenTitle title="Inbox" subtitle={prompts.length ? `${prompts.length} waiting for you` : 'Nothing waiting'} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'needs', label: `Needs you${prompts.length ? ` · ${prompts.length}` : ''}` },
          { value: 'updates', label: `Updates${notices.length ? ` · ${notices.length}` : ''}` },
        ]}
      />

      {tab === 'needs' ? (
        prompts.length ? (
          <View style={{ gap: 12 }}>
            {prompts.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} now={now} />
            ))}
          </View>
        ) : (
          <EmptyState title="All clear" body="Approvals and questions from the agent show up here." />
        )
      ) : notices.length ? (
        <Section>
          {notices.map((notice, index) => (
            <NoticeRow key={notice.id} notice={notice} last={index === notices.length - 1} />
          ))}
        </Section>
      ) : (
        <EmptyState title="No updates" body="Background results and failed replies show up here." />
      )}
    </Screen>
  );
}

function PromptCard({ prompt, now }: { prompt: PendingPrompt; now: number }) {
  const chat = useChat();
  const session = chat.state.sessions[prompt.liveId];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = Math.max(0, Math.ceil((PROMPT_WINDOW_MS[prompt.kind] - (now - prompt.receivedAt)) / 1000));
  const where = session?.title || session?.cwd || 'chat';

  const answer = async (choice: ApprovalChoice) => {
    setBusy(choice);
    setError(null);
    try {
      const outcome = await chat.answerApproval(prompt, choice);
      if (outcome === 'expired') setError('This request had already expired.');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  };

  const openChat = () => {
    if (session?.storedKey) router.push(`/chat/${encodeURIComponent(session.storedKey)}`);
  };

  if (prompt.kind === 'approval') {
    const choices = prompt.choices ?? ['once', 'deny'];
    return (
      <Card tone="accent" style={{ gap: 10 }}>
        <Text style={{ color: tokens.accent, fontSize: 12, fontWeight: '600' }}>APPROVAL · {secondsLeft}s left</Text>
        <Text style={{ color: tokens.text, fontFamily: MONO, fontSize: 13, lineHeight: 19 }}>{prompt.command}</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{where}</Text>
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {choices.includes('deny') ? (
            <Button label="Deny" variant="danger" compact disabled={!!busy} loading={busy === 'deny'} onPress={() => void answer('deny')} />
          ) : null}
          {choices.includes('once') ? (
            <Button label="Approve once" compact disabled={!!busy} loading={busy === 'once'} onPress={() => void answer('once')} />
          ) : null}
        </View>
      </Card>
    );
  }

  const title =
    prompt.kind === 'clarify'
      ? prompt.question
      : prompt.kind === 'sudo'
        ? 'Password needed for an administrator command'
        : prompt.prompt || 'A secret is needed';

  return (
    <Card tone="accent" style={{ gap: 10 }}>
      <Text style={{ color: tokens.accent, fontSize: 12, fontWeight: '600' }}>
        {prompt.kind === 'clarify' ? 'QUESTION' : prompt.kind === 'sudo' ? 'PASSWORD' : 'SECRET'} · {secondsLeft}s left
      </Text>
      <Text style={{ color: tokens.text, fontSize: 15, lineHeight: 21 }}>{title}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{where}</Text>
      <Button label="Answer" variant="secondary" compact onPress={openChat} disabled={!session?.storedKey} />
    </Card>
  );
}

function NoticeRow({ notice, last }: { notice: Notice; last: boolean }) {
  const chat = useChat();
  return (
    <Row
      title={notice.text}
      subtitle={new Date(notice.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      last={last}
      onPress={notice.storedKey ? () => router.push(`/chat/${encodeURIComponent(notice.storedKey as string)}`) : undefined}
      right={
        <Text accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => chat.dismissNotice(notice.id)} style={{ color: tokens.textMuted, fontSize: 13, paddingLeft: 8 }}>
          Dismiss
        </Text>
      }
    />
  );
}
