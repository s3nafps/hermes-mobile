import { StyleSheet, Text, View } from 'react-native';

import { Field, Segmented, Toggle } from '@/components/ui';
import { tokens } from '@/constants/tokens';

import { fieldLabel, titleCase } from './configPath';
import type { ConfigSchemaField } from './types';

type Props = {
  field: ConfigSchemaField;
  // The value to show. Secrets pass the typed replacement, never the stored value.
  value: unknown;
  // Secrets only: whether a value is stored. Never the value itself.
  secretSet?: boolean;
  onChange: (value: unknown) => void;
};

// One setting in the config form, shown with the control that fits its type.
export function ConfigField({ field, value, secretSet, onChange }: Props) {
  const label = fieldLabel(field.description);

  if (secretSet !== undefined) {
    return (
      <View style={styles.block}>
        <Field
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder={secretSet ? 'Enter a new value to replace it' : 'Enter a value'}
          secureTextEntry
          autoComplete="off"
        />
        <Text style={styles.hint}>{secretSet ? 'A value is set. It is hidden.' : 'No value is set.'}</Text>
      </View>
    );
  }

  if (field.type === 'boolean' || field.type === 'bool') {
    return (
      <View style={styles.toggleRow}>
        <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
        <Toggle value={value === true} onValueChange={onChange} label={label} />
      </View>
    );
  }

  if (field.type === 'select' && field.options?.length) {
    const options = field.options.map((option) => ({ value: option, label: titleCase(option) }));
    return (
      <View style={styles.block}>
        <Text style={styles.label}>{label}</Text>
        <Segmented options={options} value={String(value ?? '')} onChange={onChange} />
      </View>
    );
  }

  if (field.type === 'list') {
    const text = Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : '';
    return (
      <Field
        label={label}
        value={text}
        onChangeText={onChange}
        placeholder="One item per line"
        multiline
        autoCapitalize="none"
      />
    );
  }

  return (
    <Field
      label={label}
      value={value === undefined || value === null ? '' : String(value)}
      onChangeText={onChange}
      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  hint: { color: tokens.textMuted, fontSize: 12 },
  label: { color: tokens.textMuted, fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
});
