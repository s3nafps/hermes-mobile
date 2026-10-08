import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ControlScreen() {
  return (
    <PlaceholderScreen
      title="Control"
      screens={[
        'Control home',
        'Gateways',
        'Memory',
        'Skills and hub',
        'Tools and MCP',
        'Channels',
        'Pairing and access',
        'Webhooks',
        'Analytics',
        'Logs',
        'Config',
        'Security and keys',
        'Settings and system',
      ]}
    />
  );
}
