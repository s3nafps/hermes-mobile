import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Field, Row, Section } from '@/components/ui';

import { confirmAction } from './confirm';
import { themed } from '@/lib/theme';

type Props = {
  label: string;
  items: string[];
  placeholder: string;
  emptyTitle: string;
  emptyBody: string;
  busy: boolean;
  // Saves the whole list. Resolves to true when the change was written.
  onSave: (next: string[]) => Promise<boolean>;
};

// Add and remove entries in a list setting, such as the command allowlist.
export function ListEditor({ label, items, placeholder, emptyTitle, emptyBody, busy, onSave }: Props) {
  const [draft, setDraft] = useState('');

  const add = async () => {
    const value = draft.trim();
    if (!value) return;
    if (items.includes(value)) {
      Alert.alert(label, 'That entry is already in the list.');
      return;
    }
    if (await onSave([...items, value])) setDraft('');
  };

  const remove = (value: string) =>
    confirmAction({
      title: 'Remove this entry?',
      body: value,
      action: 'Remove',
      destructive: true,
      onConfirm: () => onSave(items.filter((item) => item !== value)),
    });

  return (
    <View style={styles.wrap}>
      <Section label={label}>
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          items.map((item, index) => (
            <Row
              key={item}
              title={item}
              last={index === items.length - 1}
              right={<Button label="Remove" variant="danger" compact disabled={busy} onPress={() => remove(item)} />}
            />
          ))
        )}
      </Section>
      <Field label={`Add to ${label.toLowerCase()}`} value={draft} onChangeText={setDraft} placeholder={placeholder} />
      <Button label="Add" variant="secondary" compact onPress={add} disabled={busy || !draft.trim()} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { gap: 10 },
}));
