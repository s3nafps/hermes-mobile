import { Text, View } from 'react-native';

import { Badge, Button, Toggle } from '@/components/ui';

import { rowStyles as s } from './rowStyles';
import type { WebhookRoute } from './types';

type Props = {
  route: WebhookRoute;
  last: boolean;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
};

// One webhook route: its URL path, where its events are delivered, and its switch.
export function WebhookRow({ route, last, busy, onToggle, onDelete }: Props) {
  return (
    <View style={[s.item, !last && s.divider]}>
      <View style={s.top}>
        <View style={s.text}>
          <Text style={s.name}>{route.name}</Text>
          {route.description ? <Text style={s.sub}>{route.description}</Text> : null}
        </View>
        <Toggle
          label={`Turn ${route.name} on or off`}
          value={route.enabled}
          onValueChange={onToggle}
          disabled={busy}
        />
      </View>
      {route.route ? (
        <Text style={s.mono} selectable>
          {route.route}
        </Text>
      ) : null}
      <Text style={s.sub}>Delivers to: {route.deliver ?? 'target not listed'}</Text>
      {route.events.length > 0 ? <Text style={s.sub}>Events: {route.events.join(', ')}</Text> : null}
      <View style={s.actions}>
        <Badge label={route.enabled ? 'Enabled' : 'Disabled'} tone={route.enabled ? 'done' : 'neutral'} />
        <View style={s.spacer} />
        <Button label="Delete" variant="danger" compact disabled={busy} onPress={onDelete} />
      </View>
    </View>
  );
}
