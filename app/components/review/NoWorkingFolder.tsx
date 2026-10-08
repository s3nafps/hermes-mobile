import { router } from 'expo-router';

import { Button, EmptyState } from '@/components/ui';

// Shown when no chat session has reported a working folder yet.
export function NoWorkingFolder() {
  return (
    <EmptyState
      title="No chat yet"
      body="This screen reads the working folder of your chat. Start a chat and its folder will show here."
      action={<Button label="Open chat" variant="secondary" compact onPress={() => router.navigate('/(tabs)')} />}
    />
  );
}
