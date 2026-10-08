import { InlineNotice } from '@/components/ui';

import { percent } from './format';
import type { SystemStats } from './types';

// Warn well before a host runs out of memory or disk space.
const WARN_AT = 80;
const DANGER_AT = 90;

type Props = {
  stats: SystemStats | null | undefined;
};

// Shows a notice for each resource on the gateway host that is running high.
export function PressureBanners({ stats }: Props) {
  if (!stats) return null;
  const items = [
    { name: 'Memory', value: stats.memory?.percent, hint: 'Close unused sessions or restart the gateway.' },
    { name: 'Disk', value: stats.disk?.percent, hint: 'Free up space on the gateway host.' },
  ];
  return (
    <>
      {items.map((item) => {
        if (typeof item.value !== 'number' || item.value < WARN_AT) return null;
        const tone = item.value >= DANGER_AT ? 'danger' : 'warning';
        return (
          <InlineNotice key={item.name} tone={tone}>
            {`${item.name} is at ${percent(item.value)} on the gateway host. ${item.hint}`}
          </InlineNotice>
        );
      })}
    </>
  );
}
