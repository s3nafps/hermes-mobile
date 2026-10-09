import { useState } from 'react';
import { Text } from 'react-native';

import { confirmAction } from '@/components/control/confirm';
import {
  fetchModelOptions,
  friendlyError,
  MODEL_BUSY_MESSAGE,
  OFFLINE_MESSAGE,
  REASONING_BUSY_MESSAGE,
  setConfig,
} from '@/components/session/api';
import type { ModelOptions, ReasoningLevel } from '@/components/session/types';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Section,
  SectionLabel,
  Sheet,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// The gateway's levels, in its order. A session can report any of them, so each one has a chip.
const REASONING_OPTIONS: { value: ReasoningLevel; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' },
  { value: 'ultra', label: 'Ultra' },
];

function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return REASONING_OPTIONS.some((option) => option.value === value);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  liveId: string;
  model: string;
  provider: string;
  running: boolean;
  // The current reasoning level, as the chat session reports it.
  reasoning: string | null;
};

// Chooses the model and reasoning effort for one live chat. Both changes go through
// config.set on that session. The chat screen keys this sheet by liveId, so state resets per chat.
export function ModelSheet({ visible, onClose, liveId, model, provider, running, reasoning: reportedReasoning }: Props) {
  const { rpc } = useGateway();
  const options = useGatewayQuery<ModelOptions>(
    visible && rpc ? () => fetchModelOptions(rpc, liveId) : null,
    [visible, rpc, liveId],
  );

  const [pickedProvider, setPickedProvider] = useState<string | null>(null);
  const [pickedModel, setPickedModel] = useState<string | null>(null);
  // A level the user just chose shows at once. Otherwise the level the session reports is shown.
  const [pickedReasoning, setPickedReasoning] = useState<ReasoningLevel | null>(null);
  const reasoning = pickedReasoning ?? (isReasoningLevel(reportedReasoning) ? reportedReasoning : null);

  const providers = options.data?.providers ?? [];
  const currentModel = options.data?.model || model;
  const currentProvider = options.data?.provider || provider;
  const activeSlug = pickedProvider ?? currentProvider;
  const activeProvider = providers.find((item) => item.slug === activeSlug) ?? null;
  const unchanged = pickedModel === currentModel && activeSlug === currentProvider;

  const apply = useAction(async (chosen: string, confirmed: boolean) => {
    if (!rpc) throw new Error(OFFLINE_MESSAGE);
    try {
      return await setConfig(rpc, liveId, 'model', chosen, confirmed);
    } catch (caught) {
      throw friendlyError(caught, MODEL_BUSY_MESSAGE);
    }
  });

  // The gateway asks before an expensive model. The user confirms, then the change is sent again.
  const applyModel = async (chosen: string, confirmed = false): Promise<void> => {
    // The gateway resets a chat's reasoning level to its config value when the model changes. The level
    // in view is read before the switch, then sent again once the switch has gone through.
    const level = reasoning;
    const result = await apply.run(chosen, confirmed);
    if (!result) return;
    if (result.confirm_required && !confirmed) {
      confirmAction({
        title: 'Use this model?',
        body: result.confirm_message || 'This model may cost more to use. Use it anyway?',
        action: 'Use model',
        onConfirm: () => applyModel(chosen, true),
      });
      return;
    }
    setPickedModel(null);
    if (level) {
      const saved = await reasoningAction.run(level);
      if (saved) setPickedReasoning(saved);
    }
    options.refetch();
  };

  const reasoningAction = useAction(async (level: ReasoningLevel) => {
    if (!rpc) throw new Error(OFFLINE_MESSAGE);
    try {
      await setConfig(rpc, liveId, 'reasoning', level);
    } catch (caught) {
      throw friendlyError(caught, REASONING_BUSY_MESSAGE);
    }
    return level;
  });

  const chooseReasoning = async (level: ReasoningLevel) => {
    const saved = await reasoningAction.run(level);
    if (saved) setPickedReasoning(saved);
  };

  const close = () => {
    setPickedProvider(null);
    setPickedModel(null);
    apply.clearError();
    reasoningAction.clearError();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Model and reasoning">
      <Section label="Current">
        <Row
          title={currentModel || 'No model chosen'}
          subtitle={currentProvider ? `From ${currentProvider}` : undefined}
          last
        />
      </Section>

      {running ? <InlineNotice tone="info">Wait for the reply to finish before changing the model.</InlineNotice> : null}
      {options.loading && !options.data ? <LoadingState label="Loading models…" /> : null}
      {options.error ? <ErrorState message={options.error} onRetry={options.refetch} /> : null}
      {options.data && providers.length === 0 ? (
        <EmptyState title="No models yet" body="Connect a model provider on the gateway, then try again." />
      ) : null}

      {providers.length ? (
        <Section label="Provider">
          {providers.map((item, index) => (
            <Row
              key={item.slug}
              title={item.name}
              subtitle={item.authenticated ? `${item.models.length} models` : 'Not signed in on this gateway'}
              value={item.isCurrent ? 'In use' : undefined}
              onPress={() => {
                setPickedProvider(item.slug);
                setPickedModel(null);
              }}
              disabled={!item.authenticated}
              last={index === providers.length - 1}
            />
          ))}
        </Section>
      ) : null}

      {activeProvider && activeProvider.models.length ? (
        <Section label={`Models from ${activeProvider.name}`}>
          {activeProvider.models.map((name, index) => (
            <Row
              key={name}
              title={name}
              value={
                name === pickedModel ? 'Chosen' : activeProvider.isCurrent && name === currentModel ? 'In use' : undefined
              }
              onPress={() => setPickedModel(name)}
              disabled={running}
              last={index === activeProvider.models.length - 1}
            />
          ))}
        </Section>
      ) : null}
      {activeProvider && activeProvider.authenticated && !activeProvider.models.length ? (
        <InlineNotice tone="info">{`${activeProvider.name} lists no models on this gateway.`}</InlineNotice>
      ) : null}

      {apply.error ? <InlineNotice tone="danger">{apply.error}</InlineNotice> : null}
      {pickedModel ? (
        <Button
          label={`Use ${pickedModel}`}
          onPress={() => void applyModel(pickedModel)}
          disabled={running || unchanged}
          loading={apply.pending}
        />
      ) : null}

      <SectionLabel>Reasoning effort</SectionLabel>
      <Chip
        options={REASONING_OPTIONS}
        value={reasoning}
        onChange={(next) => {
          if (next) void chooseReasoning(next);
        }}
      />
      {reasoning === null ? (
        <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
          {reportedReasoning === null
            ? 'The current level is not reported yet. Choose one to set it.'
            : reportedReasoning === ''
              ? "This chat uses the model's default level. Choose one to change it."
              : `The gateway reports the level "${reportedReasoning}", which this app does not offer.`}
        </Text>
      ) : null}
      {reasoningAction.error ? <InlineNotice tone="danger">{reasoningAction.error}</InlineNotice> : null}
    </Sheet>
  );
}
