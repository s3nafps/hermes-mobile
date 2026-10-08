import { useState } from 'react';

import { BoardTab } from '@/components/tasks/BoardTab';
import { CronTab } from '@/components/tasks/CronTab';
import { EmptyState, Screen, ScreenTitle, Segmented } from '@/components/ui';

type Tab = 'cron' | 'board' | 'goals';

const TABS: { value: Tab; label: string }[] = [
  { value: 'cron', label: 'Cron' },
  { value: 'board', label: 'Board' },
  { value: 'goals', label: 'Goals' },
];

export default function TasksScreen() {
  const [tab, setTab] = useState<Tab>('cron');

  return (
    <Screen>
      <ScreenTitle title="Tasks" />
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'cron' ? <CronTab /> : null}
      {tab === 'board' ? <BoardTab /> : null}
      {tab === 'goals' ? <EmptyState title="Goals are not available on this gateway version." /> : null}
    </Screen>
  );
}
