import { useState } from 'react';

import { requireHttp } from '@/components/bots/shared';
import {
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Section,
  Toggle,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { listInstalled, toggleSkill } from './api';
import { SkillSheet } from './SkillSheet';
import type { InstalledSkill } from './types';

// Skills the agent has. The switch turns a skill on or off. Tapping the row opens its SKILL.md.
export function InstalledSkills() {
  const { http } = useGateway();
  const installed = useGatewayQuery<InstalledSkill[]>(async () => listInstalled(requireHttp(http)), [http]);
  const [open, setOpen] = useState<InstalledSkill | null>(null);

  const toggle = useAction(async (name: string, enabled: boolean) => {
    await toggleSkill(requireHttp(http), name, enabled);
    return true;
  });

  const onToggle = async (skill: InstalledSkill, enabled: boolean) => {
    if (installed.data) {
      installed.setData(installed.data.map((item) => (item.name === skill.name ? { ...item, enabled } : item)));
    }
    await toggle.run(skill.name, enabled);
    // Reload either way, so a failed change shows the server's real state.
    installed.refetch();
  };

  const data = installed.data;

  return (
    <>
      {installed.loading && !data ? <LoadingState label="Loading skills…" /> : null}
      {installed.error && !data ? <ErrorState message={installed.error} onRetry={installed.refetch} /> : null}
      {installed.error && data ? <InlineNotice tone="danger">{installed.error}</InlineNotice> : null}
      {toggle.error ? <InlineNotice tone="danger">{toggle.error}</InlineNotice> : null}

      {data && data.length === 0 ? (
        <EmptyState title="No skills installed" body="Browse the Hub tab to add skills." />
      ) : null}

      {data && data.length > 0 ? (
        <Section label={`Installed (${data.length})`}>
          {data.map((skill, index) => (
            <Row
              key={skill.name}
              title={skill.name}
              subtitle={skill.description || skill.category || undefined}
              onPress={() => setOpen(skill)}
              last={index === data.length - 1}
              right={
                <Toggle
                  label={`Turn ${skill.name} ${skill.enabled ? 'off' : 'on'}`}
                  value={skill.enabled}
                  onValueChange={(next) => void onToggle(skill, next)}
                />
              }
            />
          ))}
        </Section>
      ) : null}

      <SkillSheet skill={open} onClose={() => setOpen(null)} onSaved={installed.refetch} />
    </>
  );
}
