import { EmptyState, ErrorState, LoadingState, Row, Section, Sheet } from '@/components/ui';

import type { ModelChoice } from './types';

type Props = {
  visible: boolean;
  onClose: () => void;
  choices: ModelChoice[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selected: { provider: string | null; model: string | null };
  onPick: (choice: ModelChoice) => void;
};

// Lists the models the gateway offers, grouped by provider. Used by the new bot and bot screens.
export function ModelPicker({ visible, onClose, choices, loading, error, onRetry, selected, onPick }: Props) {
  const groups = groupByProvider(choices ?? []);
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose a model">
      {loading && !choices ? <LoadingState label="Loading models…" /> : null}
      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      {choices && choices.length === 0 && !loading ? (
        <EmptyState title="No models yet" body="Connect a model provider on the gateway, then try again." />
      ) : null}
      {groups.map((group) => (
        <Section key={group.provider} label={group.label}>
          {group.models.map((choice, index) => {
            const isSelected = selected.provider === choice.provider && selected.model === choice.model;
            return (
              <Row
                key={`${choice.provider}/${choice.model}`}
                title={choice.model}
                value={isSelected ? 'Selected' : undefined}
                onPress={() => {
                  onPick(choice);
                  onClose();
                }}
                last={index === group.models.length - 1}
              />
            );
          })}
        </Section>
      ))}
    </Sheet>
  );
}

function groupByProvider(choices: ModelChoice[]): { provider: string; label: string; models: ModelChoice[] }[] {
  const groups = new Map<string, { provider: string; label: string; models: ModelChoice[] }>();
  for (const choice of choices) {
    const group = groups.get(choice.provider) ?? { provider: choice.provider, label: choice.providerLabel, models: [] };
    group.models.push(choice);
    groups.set(choice.provider, group);
  }
  return [...groups.values()];
}
