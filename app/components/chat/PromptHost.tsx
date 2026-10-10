import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineNotice } from '@/components/ui';
import { MONO, lift, tokens } from '@/constants/tokens';
import { useChat } from '@/lib/chat/ChatProvider';
import { livePrompts, type PendingPrompt } from '@/lib/chat/reducer';
import { PROMPT_WINDOW_MS } from '@/lib/chat/types';
import { useGateway } from '@/lib/gateway';
import { messageOf } from '@/lib/gateway/hooks';
import { themed } from '@/lib/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

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

const APPROVAL_ICON = { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' } as const;
const CLARIFY_ICON = { ios: 'questionmark.bubble', android: 'help', web: 'help' } as const;
const SECRET_ICON = { ios: 'key', android: 'key', web: 'key' } as const;

function ApprovalSheet({ prompt, now }: { prompt: PendingPrompt; now: number }) {
  const chat = useChat();
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const windowMs = PROMPT_WINDOW_MS.approval;
  const remainingMs = Math.max(0, windowMs - (now - prompt.receivedAt));
  const remaining = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs < 15_000;
  const cwd = chat.state.sessions[prompt.liveId]?.cwd ?? '';
  const choices = prompt.choices ?? ['once', 'session', 'always', 'deny'];
  // Deny and Approve once share the first row, with Deny on the left. The wider allows sit below.
  const firstRow = (['deny', 'once'] as const).filter((choice) => choices.includes(choice));
  const secondRow = choices.filter((choice) => choice !== 'deny' && choice !== 'once');

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
    <PromptCard
      icon={APPROVAL_ICON}
      title="Approval needed"
      timer={`Expires in ${remaining} s`}
      urgent={urgent}
      countdown={remainingMs / windowMs}>
      <Text style={styles.body}>{prompt.description || 'The agent wants to run a command.'}</Text>
      {prompt.command ? (
        <View style={styles.well}>
          <Text selectable style={styles.command}>
            {prompt.command}
          </Text>
          {cwd ? (
            <Text selectable style={styles.cwd}>
              {cwd}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.note, urgent ? { color: tokens.warnText } : null]}>Answer within {remaining}s or the gateway denies it.</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <View style={styles.stack}>
        {firstRow.length ? (
          <View style={styles.row}>
            {firstRow.map((choice) => (
              <PromptButton
                key={choice}
                label={CHOICE_LABEL[choice] ?? choice}
                variant={choice === 'deny' ? 'deny' : 'accent'}
                style={styles.grow}
                loading={pendingChoice === choice}
                disabled={pendingChoice !== null}
                onPress={() => void answer(choice)}
              />
            ))}
          </View>
        ) : null}
        {secondRow.length ? (
          <View style={styles.row}>
            {secondRow.map((choice) => (
              <PromptButton
                key={choice}
                label={CHOICE_LABEL[choice] ?? choice}
                variant="secondary"
                style={styles.grow}
                loading={pendingChoice === choice}
                disabled={pendingChoice !== null}
                onPress={() => void answer(choice)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </PromptCard>
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
    <PromptCard icon={CLARIFY_ICON} title="The agent has a question">
      <Text style={styles.question}>{prompt.question}</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {prompt.options?.length ? (
        <View style={styles.stack}>
          {prompt.options.map((option) => (
            <PromptButton key={option} label={option} variant="secondary" disabled={busy} onPress={() => void send(option)} />
          ))}
        </View>
      ) : null}
      <PromptField label="Your answer" value={text} onChangeText={setText} placeholder="Type an answer" />
      <PromptButton
        label="Send answer"
        variant="accent"
        disabled={!text.trim() || busy}
        loading={busy}
        onPress={() => void send(text.trim())}
      />
    </PromptCard>
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
    <PromptCard icon={SECRET_ICON} title={title}>
      <Text style={styles.body}>{body}</Text>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <PromptField label={mode === 'sudo' ? 'Password' : 'Value'} value={value} onChangeText={setValue} secureTextEntry />
      <PromptButton label="Send" variant="accent" disabled={!value || busy} loading={busy} onPress={() => void send(value)} />
      {mode === 'secret' ? (
        <PromptButton label="Skip" variant="ghost" disabled={busy} onPress={() => void send('')} />
      ) : null}
    </PromptCard>
  );
}

// The card every prompt shares. It rises from the bottom edge and cannot be dismissed, as before.
// A countdown bar runs along its top when the prompt has a window (fraction left, 0 to 1).
function PromptCard({
  icon,
  title,
  timer,
  urgent = false,
  countdown,
  children,
}: {
  icon: SymbolName;
  title: string;
  timer?: string;
  urgent?: boolean;
  countdown?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const barColor = urgent ? tokens.warn : tokens.accent;
  const fraction = countdown === undefined ? 0 : Math.max(0, Math.min(1, countdown));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => undefined}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <View style={styles.scrim} />
        <View style={[styles.shadow, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.card} accessibilityViewIsModal>
            {countdown !== undefined ? (
              <View style={[styles.bar, { width: `${fraction * 100}%`, backgroundColor: barColor }]} />
            ) : null}
            <View style={styles.header}>
              <View style={styles.iconWell}>
                <SymbolView name={icon} tintColor={tokens.atext} size={20} />
              </View>
              <Text numberOfLines={2} style={styles.title}>
                {title}
              </Text>
              {timer ? <Text style={[styles.timer, { color: urgent ? tokens.warnText : tokens.textMuted }]}>{timer}</Text> : null}
            </View>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ButtonVariant = 'accent' | 'secondary' | 'ghost' | 'deny';

// A 44px button in the card. Accent is the main action, secondary a second choice, deny and ghost are quiet.
function PromptButton({
  label,
  onPress,
  variant,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  const look = buttonLook(variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [styles.button, look.box, style, { opacity: inactive ? 0.5 : pressed ? 0.8 : 1 }]}>
      {loading ? <ActivityIndicator color={look.text} /> : <Text style={[styles.buttonLabel, { color: look.text }]}>{label}</Text>}
    </Pressable>
  );
}

function buttonLook(variant: ButtonVariant): { box: ViewStyle; text: string } {
  switch (variant) {
    case 'accent':
      return { box: { backgroundColor: tokens.accent }, text: tokens.accentText };
    case 'secondary':
      return { box: { backgroundColor: tokens.surfaceRaised, borderWidth: 1, borderColor: tokens.line }, text: tokens.text };
    case 'deny':
      return { box: {}, text: tokens.danger };
    case 'ghost':
      return { box: {}, text: tokens.atext };
  }
}

// A labelled text field in the card. Same props as before, with the card's look.
function PromptField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={tokens.textMuted}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={styles.input}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: tokens.bg, opacity: 0.6 },
  shadow: { marginHorizontal: 12, borderRadius: 22, ...lift('float') },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    overflow: 'hidden',
    padding: 18,
    gap: 14,
  },
  bar: { position: 'absolute', top: 0, left: 0, height: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.tint,
  },
  title: { flex: 1, color: tokens.text, fontSize: 17, fontWeight: '600' },
  timer: { fontFamily: MONO, fontSize: 13 },
  body: { color: tokens.text, fontSize: 15, lineHeight: 22 },
  question: { color: tokens.text, fontSize: 16, lineHeight: 22 },
  note: { color: tokens.textMuted, fontSize: 13, lineHeight: 19 },
  well: { backgroundColor: tokens.well, borderRadius: 14, padding: 12, gap: 6 },
  command: { color: tokens.text, fontFamily: MONO, fontSize: 13, lineHeight: 19 },
  cwd: { color: tokens.textMuted, fontFamily: MONO, fontSize: 13 },
  stack: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  button: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { color: tokens.textMuted, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: tokens.well,
    color: tokens.text,
    fontSize: 15,
  },
}));
