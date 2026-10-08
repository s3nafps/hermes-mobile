import { Button, Field, InlineNotice, Sheet } from '@/components/ui';

type Props = {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  pending: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
};

// Asks for a new title for a saved chat. An empty title clears it.
export function RenameSheet({ visible, value, onChangeText, pending, error, onSave, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Rename chat">
      <Field
        label="Chat title"
        value={value}
        onChangeText={onChangeText}
        placeholder="Untitled chat"
        autoCapitalize="sentences"
        maxLength={200}
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      <InlineNotice tone="info">Leave the title empty to remove it.</InlineNotice>
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      <Button label="Save title" onPress={onSave} loading={pending} />
      <Button label="Cancel" variant="secondary" onPress={onClose} disabled={pending} />
    </Sheet>
  );
}
