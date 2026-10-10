import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Field, InlineNotice, Sheet } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { unwrap, useAction, useGateway } from '@/lib/gateway';

import { NOT_CONNECTED } from './client';
import { confirmAction } from './confirm';
import type { EnvVarInfo } from './types';
import { themed } from '@/lib/theme';

const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

type Props = {
  visible: boolean;
  onClose: () => void;
  // The variable being edited. Null means a new key.
  name: string | null;
  info?: EnvVarInfo;
  onChanged: () => void;
};

// Sets or removes one API key. The stored value is never shown, only the redacted preview
// the gateway returns. Pass a new key on each open (through a React key) so the input starts empty.
export function KeySheet({ visible, onClose, name, info, onChanged }: Props) {
  const { http } = useGateway();
  const [newName, setNewName] = useState('');
  const [value, setValue] = useState('');

  const isNew = name === null;
  const keyName = (name ?? newName).trim().toUpperCase();
  const isSet = !!info?.is_set;

  const save = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    if (!NAME_PATTERN.test(keyName)) {
      throw new Error('Use capital letters, numbers and underscores, starting with a letter.');
    }
    // api_key is sent with its server default, an empty string.
    unwrap(await http.PUT('/api/env', { body: { key: keyName, value: value.trim(), api_key: '' } }));
    return true;
  });

  const remove = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    unwrap(await http.DELETE('/api/env', { body: { key: keyName } }));
    return true;
  });

  const onSave = async () => {
    if (await save.run()) {
      setValue('');
      onChanged();
      onClose();
    }
  };

  const onRemove = () =>
    confirmAction({
      title: `Remove ${keyName}?`,
      body: 'Tools that use this key stop working until you add it again.',
      action: 'Remove',
      destructive: true,
      onConfirm: async () => {
        if (await remove.run()) {
          onChanged();
          onClose();
        }
      },
    });

  const error = save.error ?? remove.error;

  return (
    <Sheet visible={visible} onClose={onClose} title={isNew ? 'Add an API key' : keyName}>
      {isNew ? (
        <Field
          label="Name"
          value={newName}
          onChangeText={setNewName}
          placeholder="EXAMPLE_API_KEY"
          autoCapitalize="characters"
        />
      ) : null}

      <Text style={styles.status}>
        {isSet ? `Stored as ${info?.redacted_value ?? 'a hidden value'}.` : isNew ? 'Enter the key value below.' : 'Not set.'}
      </Text>

      <Field
        label={isSet ? 'New value' : 'Value'}
        value={value}
        onChangeText={setValue}
        placeholder={isSet ? 'Enter a new value to replace it' : 'Paste the key'}
        secureTextEntry
        autoComplete="off"
      />

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <Button
        label="Save key"
        onPress={onSave}
        loading={save.pending}
        disabled={save.pending || remove.pending || !value.trim() || (isNew && !newName.trim())}
      />
      {isSet ? (
        <Button label="Remove key" variant="danger" onPress={onRemove} loading={remove.pending} disabled={save.pending || remove.pending} />
      ) : null}
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  status: { color: tokens.textMuted, fontSize: 13 },
}));
