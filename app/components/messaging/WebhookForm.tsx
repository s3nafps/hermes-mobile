import { useState } from 'react';

import { Button, Field, InlineNotice, Sheet } from '@/components/ui';

import type { WebhookDraft } from './types';

type Props = {
  visible: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: WebhookDraft) => void;
};

const EMPTY: Omit<WebhookDraft, 'events'> & { events: string } = {
  name: '',
  description: '',
  events: '',
  prompt: '',
  deliver: '',
  deliverChatId: '',
  secret: '',
};

// Sheet form for POST /api/webhooks. Only the name is required. The server checks the rest.
// The parent gives it a new key each time it opens, so every open starts from a blank form.
export function WebhookForm({ visible, pending, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState(EMPTY);

  const set = (key: keyof typeof EMPTY) => (text: string) => setValues((prev) => ({ ...prev, [key]: text }));

  const submit = () => {
    onSubmit({
      name: values.name.trim(),
      description: values.description,
      events: values.events.split(/[\s,]+/).filter(Boolean),
      prompt: values.prompt,
      deliver: values.deliver.trim() || 'log',
      deliverChatId: values.deliverChatId,
      secret: values.secret,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New webhook">
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <Field label="Name" value={values.name} onChangeText={set('name')} placeholder="for example: github-push" />
      <Field label="Description (optional)" value={values.description} onChangeText={set('description')} />
      <Field
        label="Events (optional)"
        value={values.events}
        onChangeText={set('events')}
        placeholder="for example: push, issues"
      />
      <Field
        label="Prompt (optional)"
        value={values.prompt}
        onChangeText={set('prompt')}
        placeholder="What the agent should do with each event"
        multiline
      />
      <Field label="Deliver to" value={values.deliver} onChangeText={set('deliver')} placeholder="log" />
      <Field label="Chat ID (optional)" value={values.deliverChatId} onChangeText={set('deliverChatId')} />
      <Field label="Secret (optional)" value={values.secret} onChangeText={set('secret')} secureTextEntry />
      <Button
        label="Create webhook"
        loading={pending}
        disabled={!values.name.trim() || pending}
        onPress={submit}
      />
      <Button label="Cancel" variant="secondary" disabled={pending} onPress={onClose} />
    </Sheet>
  );
}
