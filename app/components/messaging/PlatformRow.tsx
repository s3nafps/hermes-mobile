import { Text, View } from 'react-native';

import { Badge, Button, Toggle } from '@/components/ui';
import { tokens } from '@/constants/tokens';

import { rowStyles as s } from './rowStyles';
import type { MessagingPlatform, TestResult } from './types';

type Props = {
  platform: MessagingPlatform;
  last: boolean;
  busy: boolean;
  testing: boolean;
  result: TestResult | undefined;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
};

function statusOf(platform: MessagingPlatform): { label: string; tone: 'done' | 'accent' | 'neutral' } {
  if (platform.connected) return { label: 'Connected', tone: 'done' };
  if (platform.needsSetup) return { label: 'Needs setup', tone: 'accent' };
  if (platform.enabled) return { label: 'Not connected', tone: 'neutral' };
  return { label: 'Off', tone: 'neutral' };
}

// One messaging platform: its on or off switch, status, and a test button.
export function PlatformRow({ platform, last, busy, testing, result, onToggle, onTest }: Props) {
  const status = statusOf(platform);
  const hint = platform.description ?? (platform.needsSetup ? 'Needs setup before it can connect.' : null);
  return (
    <View style={[s.item, !last && s.divider]}>
      <View style={s.top}>
        <View style={s.text}>
          <Text style={s.name}>{platform.name}</Text>
          {hint ? <Text style={s.sub}>{hint}</Text> : null}
        </View>
        <Toggle
          label={`Turn ${platform.name} on or off`}
          value={platform.enabled}
          onValueChange={onToggle}
          disabled={busy}
        />
      </View>
      <View style={s.actions}>
        <Badge label={status.label} tone={status.tone} />
        <View style={s.spacer} />
        <Button label="Test" variant="secondary" compact loading={testing} disabled={busy} onPress={onTest} />
      </View>
      {result ? (
        <Text style={[s.result, { color: result.ok ? tokens.done : tokens.danger }]} selectable>
          {result.text}
        </Text>
      ) : null}
    </View>
  );
}
