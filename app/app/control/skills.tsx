import { Stack } from 'expo-router';
import { useState } from 'react';

import { CuratorPanel } from '@/components/skills/CuratorPanel';
import { HubSkills } from '@/components/skills/HubSkills';
import { InstalledSkills } from '@/components/skills/InstalledSkills';
import { Screen, ScreenTitle, Segmented } from '@/components/ui';

type Tab = 'installed' | 'hub' | 'curator';

const TABS: { value: Tab; label: string }[] = [
  { value: 'installed', label: 'Installed' },
  { value: 'hub', label: 'Hub' },
  { value: 'curator', label: 'Curator' },
];

// Installed skills, the skill hub, and the curator that keeps them tidy.
export default function SkillsScreen() {
  const [tab, setTab] = useState<Tab>('installed');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Skills' }} />
      <ScreenTitle title="Skills" subtitle="What the agent can do, and where new skills come from." />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'installed' ? <InstalledSkills /> : null}
      {tab === 'hub' ? <HubSkills /> : null}
      {tab === 'curator' ? <CuratorPanel /> : null}
    </Screen>
  );
}
