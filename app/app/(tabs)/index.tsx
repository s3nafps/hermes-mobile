import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ChatScreen() {
  return (
    <PlaceholderScreen
      title="Chat"
      screens={[
        'Chat',
        'Approval sheet',
        'Agent question',
        'Turn failed',
        'Model and reasoning',
        'Sessions',
        'Session detail',
        'Voice mode',
        'Review changes',
        'Artifacts',
      ]}
    />
  );
}
