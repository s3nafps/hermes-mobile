import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field, InlineNotice, Row, Section, SectionLabel, Segmented } from '@/components/ui';
import { useAction, useHttp } from '@/lib/gateway';

import { addLink, removeLink } from './api';
import { confirmFirst } from './format';
import type { KanbanRef, KanbanTaskDetail } from './types';

type Props = {
  board: string | null;
  detail: KanbanTaskDetail;
  onChanged: () => void;
};

type Direction = 'parent' | 'child';

// Dependencies. "Depends on" lists parents, "Blocks" lists children.
export function TaskLinks({ board, detail, onChanged }: Props) {
  const http = useHttp();
  const [direction, setDirection] = useState<Direction>('parent');
  const [otherId, setOtherId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = useAction(async (parentId: string, childId: string) => {
    await addLink(http, board, parentId, childId);
    return true;
  });
  const remove = useAction(async (parentId: string, childId: string) => {
    await removeLink(http, board, parentId, childId);
    return true;
  });

  async function onAdd() {
    const other = otherId.trim();
    if (!other) {
      setProblem('Enter the ID of the other task.');
      return;
    }
    if (other === detail.id) {
      setProblem('A task cannot depend on itself.');
      return;
    }
    setProblem(null);
    const ok = direction === 'parent' ? await add.run(other, detail.id) : await add.run(detail.id, other);
    if (ok) {
      setOtherId('');
      onChanged();
    }
  }

  // A parent is the task this one depends on, so the link runs parent to child.
  function onRemove(ref: KanbanRef, isParent: boolean) {
    confirmFirst(
      'Remove this link?',
      'The two tasks will no longer depend on each other.',
      'Remove',
      () => {
        void (async () => {
          const ok = isParent ? await remove.run(ref.id, detail.id) : await remove.run(detail.id, ref.id);
          if (ok) onChanged();
        })();
      },
      true,
    );
  }

  const none = detail.parents.length === 0 && detail.children.length === 0;

  return (
    <View style={styles.wrap}>
      <SectionLabel>Dependencies</SectionLabel>
      {none ? (
        <Section>
          <Row title="Nothing linked yet" last />
        </Section>
      ) : null}
      {detail.parents.length > 0 ? (
        <Section label="Depends on">
          {detail.parents.map((ref, index) => (
            <Row
              key={ref.id}
              title={ref.title ?? ref.id}
              subtitle={ref.title ? ref.id : undefined}
              right={<Button label="Remove" variant="danger" compact onPress={() => onRemove(ref, true)} disabled={remove.pending} />}
              last={index === detail.parents.length - 1}
            />
          ))}
        </Section>
      ) : null}
      {detail.children.length > 0 ? (
        <Section label="Blocks">
          {detail.children.map((ref, index) => (
            <Row
              key={ref.id}
              title={ref.title ?? ref.id}
              subtitle={ref.title ? ref.id : undefined}
              right={<Button label="Remove" variant="danger" compact onPress={() => onRemove(ref, false)} disabled={remove.pending} />}
              last={index === detail.children.length - 1}
            />
          ))}
        </Section>
      ) : null}

      <View style={styles.form}>
        <Segmented
          options={[
            { value: 'parent', label: 'Depends on' },
            { value: 'child', label: 'Blocks' },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <Field
          label="Other task ID"
          value={otherId}
          onChangeText={setOtherId}
          placeholder="Paste the task ID"
        />
        {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
        {add.error ? <InlineNotice tone="danger">{add.error}</InlineNotice> : null}
        {remove.error ? <InlineNotice tone="danger">{remove.error}</InlineNotice> : null}
        <Button label="Add link" variant="secondary" onPress={() => void onAdd()} loading={add.pending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  form: { gap: 10 },
});
