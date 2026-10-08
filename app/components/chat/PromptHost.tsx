import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MONO, tokens } from '@/constants/tokens';
import { useGateway } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';
import { useChat } from '@/lib/chat/ChatProvider';
import { livePrompts, type PendingPrompt } from '@/lib/chat/reducer';
import { PROMPT_WINDOW_MS } from '@/lib/chat/types';
import { Button, Field, InlineNotice, Sheet } from '@/components/ui';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Shows the oldest open prompt from the agent (approval, question, password, secret)
// on top of whatever screen the user is on. The gateway waits for the answer.
export function PromptHost() {
  const { phase } = useGateway();
  const { state } = useChat();
  const now = useNow(1000);
  const prompt = livePrompts(state.prompts, now)[0];
  if (phase !== 'online' || !prompt) return null;
  return <PromptSheet key={prompt.id} prompt={prompt} now={now} />;
}

function PromptSheet({ prompt, now }: { prompt: PendingPrompt; now: number }) {
  switch (prompt.kind) {
    case 'approval':
      return <ApprovalSheet prompt={prompt} now={now} />;
    case 'clarify':
      return <ClarifySheet prompt={prompt} />;
    case 'sudo':
      return <SecretSheet prompt={prompt} mode="sudo" />;
    case 'secret':
      return <SecretSheet prompt={prompt} mode="secret" />;
    default:
      return null;
  }
}

const CHOICE_LABEL: Record<string, string> = {
  once: 'Approve once',
  session: 'For this session',
  always: 'Always allow',
  deny: 'Deny',
};

function ApprovalSheet({ prompt, now }: { prompt: PendingPrompt; now: number }) {
  const chat = useChat();
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const remaining = Math.max(0, Math.ceil((PROMPT_WINDOW_MS.approval - (now - prompt.receivedAt)) / 1000));
  const choices = prompt.choices ?? ['once', 'session', 'always', 'deny'];

  const answer = async (choice: 'once' | 'session' | 'always' | 'deny') => {
    setPendingChoice(choice);
    setError(null);
    try {
      const outcome = await chat.answerApproval(prompt, choice);
      if (outcome === 'expired') setError('This request had already expired on the gateway.');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPendingChoice(null);
    }
  };

  return (
    <Sheet visible onClose={() => undefined} title="Approval needed">
      <Text style={{ color: tokens.textMuted, fontSize: 13, lineHeight: 19 }}>
        {prompt.description || 'The agent wants to run a command.'}
      </Text>
      {prompt.command ? (
        <View style={{ backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.line, borderRadius: 12, padding: 12 }}>
          <Text selectable style={{ color: tokens.text, fontFamily: MONO, fontSize: 13, lineHeight: 19 }}>
            {prompt.command}
          </Text>
        </View>
      ) : null}
      <Text style={{ color: tokens.accent, fontSize: 13 }}>Answer within {remaining}s or the gateway denies it.</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <View style={{ gap: 8 }}>
        {choices.map((choice) => (
          <Button
            key={choice}
            label={CHOICE_LABEL[choice] ?? choice}
            variant={choice === 'deny' ? 'danger' : choice === 'once' ? 'primary' : 'secondary'}
            loading={pendingChoice === choice}
            disabled={pendingChoice !== null}
            onPress={() => void answer(choice)}
          />
        ))}
      </View>
    </Sheet>
  );
}

function ClarifySheet({ prompt }: { prompt: PendingPrompt }) {
  const chat = useChat();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (answer: string) => {
    setBusy(true);
    setError(null);
    try {
      await chat.answerClarify(prompt, answer);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={() => undefined} title="The agent has a question">
      <Text style={{ color: tokens.text, fontSize: 16, lineHeight: 22 }}>{prompt.question}</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {prompt.options?.length ? (
        <View style={{ gap: 8 }}>
          {prompt.options.map((option) => (
            <Button key={option} label={option} variant="secondary" disabled={busy} onPress={() => void send(option)} />
          ))}
        </View>
      ) : null}
      <Field label="Your answer" value={text} onChangeText={setText} placeholder="Type an answer" />
      <Button label="Send answer" disabled={!text.trim() || busy} loading={busy} onPress={() => void send(text.trim())} />
    </Sheet>
  );
}

function SecretSheet({ prompt, mode }: { prompt: PendingPrompt; mode: 'sudo' | 'secret' }) {
  const chat = useChat();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const title = mode === 'sudo' ? 'Password needed' : 'Secret needed';
  const body =
    mode === 'sudo'
      ? 'The agent needs your password to run an administrator command.'
      : prompt.prompt || `Enter the value for ${prompt.envVar || 'this secret'}.`;

  const send = async (secret: string) => {
    setBusy(true);
    setError(null);
    try {
      const outcome = mode === 'sudo' ? await chat.answerSudo(prompt, secret) : await chat.answerSecret(prompt, secret);
      if (outcome === 'expired') setError('The gateway had already stopped waiting for this.');
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={() => undefined} title={title}>
      <Text style={{ color: tokens.textMuted, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <Field label={mode === 'sudo' ? 'Password' : 'Value'} value={value} onChangeText={setValue} secureTextEntry />
      <Button label="Send" disabled={!value || busy} loading={busy} onPress={() => void send(value)} />
      {mode === 'secret' ? (
        <Button label="Skip" variant="ghost" disabled={busy} onPress={() => void send('')} />
      ) : null}
    </Sheet>
  );
}
