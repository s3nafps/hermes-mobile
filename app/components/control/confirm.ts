import { Alert } from 'react-native';

type ConfirmOptions = {
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
  onConfirm: () => unknown;
};

// Asks before a destructive or hard-to-undo change. Nothing runs unless the user confirms.
export function confirmAction({ title, body, action, destructive, onConfirm }: ConfirmOptions): void {
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: action,
      style: destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
