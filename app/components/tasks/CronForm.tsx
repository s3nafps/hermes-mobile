import { StyleSheet, View } from 'react-native';

import { Badge, Field, InlineNotice, LoadingState, Row, Section } from '@/components/ui';

import type { CronValues, DeliveryTarget } from './types';

type Props = {
  values: CronValues;
  onChange: (next: CronValues) => void;
  targets: DeliveryTarget[] | undefined;
  targetsError: string | null;
};

// The fields shared by the new-job and edit-job screens.
export function CronForm({ values, onChange, targets, targetsError }: Props) {
  const setField = (key: keyof CronValues) => (text: string) => onChange({ ...values, [key]: text });

  return (
    <View style={styles.form}>
      <Field
        label="Name"
        value={values.name}
        onChangeText={setField('name')}
        placeholder="What this job is called"
        autoCapitalize="sentences"
      />
      <Field
        label="Prompt"
        value={values.prompt}
        onChangeText={setField('prompt')}
        placeholder="What the agent should do each time"
        multiline
        autoCapitalize="sentences"
      />
      <Field
        label="Schedule"
        value={values.schedule}
        onChangeText={setField('schedule')}
        placeholder="For example 0 9 * * * or every 2h"
      />
      <DeliveryPicker values={values} onChange={onChange} targets={targets} targetsError={targetsError} />
    </View>
  );
}

function DeliveryPicker({ values, onChange, targets, targetsError }: Props) {
  if (!targets && !targetsError) return <LoadingState label="Loading delivery options" />;

  const options = targets ?? [];
  // Keep a saved value on the list even if the server no longer offers it.
  const list = options.some((target) => target.value === values.deliver)
    ? options
    : [...options, { value: values.deliver, label: values.deliver, homeTargetSet: true }];

  return (
    <View style={styles.picker}>
      {targetsError ? <InlineNotice tone="danger">{targetsError}</InlineNotice> : null}
      <Section label="Deliver results to">
        {list.map((target, index) => {
          const selected = target.value === values.deliver;
          const blocked = !target.homeTargetSet && !selected;
          return (
            <Row
              key={target.value}
              title={target.label}
              subtitle={blocked ? 'Set a home channel for this platform first' : undefined}
              right={selected ? <Badge label="Selected" tone="accent" /> : undefined}
              onPress={blocked ? undefined : () => onChange({ ...values, deliver: target.value })}
              disabled={blocked}
              last={index === list.length - 1}
              testID={`deliver-${target.value}`}
            />
          );
        })}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  picker: { gap: 10 },
});
