import { router, type Href } from 'expo-router';

import { Row, Section } from '@/components/ui';

// Every Control section and its route. Memory, skills, tools, channels, pairing and
// webhooks are built by other screens. This list only links to them.
export type SectionSlug =
  | 'gateways'
  | 'channels'
  | 'pairing'
  | 'webhooks'
  | 'memory'
  | 'skills'
  | 'tools'
  | 'analytics'
  | 'logs'
  | 'config'
  | 'security'
  | 'settings';

type SectionDef = { slug: SectionSlug; title: string; hint: string };

type Group = { label: string; items: SectionDef[] };

const GROUPS: Group[] = [
  {
    label: 'Connections',
    items: [
      { slug: 'gateways', title: 'Gateways', hint: 'Saved gateways' },
      { slug: 'channels', title: 'Channels', hint: 'Chat platforms' },
      { slug: 'pairing', title: 'Pairing and access', hint: 'Who can talk to the agent' },
      { slug: 'webhooks', title: 'Webhooks', hint: 'Incoming triggers' },
    ],
  },
  {
    label: 'Agent',
    items: [
      { slug: 'memory', title: 'Memory', hint: 'What the agent remembers' },
      { slug: 'skills', title: 'Skills', hint: 'Installed skills and hub' },
      { slug: 'tools', title: 'Tools and MCP', hint: 'Toolsets and MCP servers' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { slug: 'analytics', title: 'Analytics', hint: 'Tokens, cache and cost' },
      { slug: 'logs', title: 'Logs', hint: 'Agent and gateway logs' },
    ],
  },
  {
    label: 'System',
    items: [
      { slug: 'config', title: 'Config', hint: 'Gateway settings' },
      { slug: 'security', title: 'Security and keys', hint: 'Approvals, allowlist and API keys' },
      { slug: 'settings', title: 'Settings and system', hint: 'Theme, updates and sign out' },
    ],
  },
];

type Props = {
  // Live state for a section, such as a count or a mode. Sections without one show their hint.
  summaries: Partial<Record<SectionSlug, string>>;
};

export function ControlSections({ summaries }: Props) {
  return (
    <>
      {GROUPS.map((group) => (
        <Section key={group.label} label={group.label}>
          {group.items.map((item, index) => (
            <Row
              key={item.slug}
              title={item.title}
              subtitle={item.hint}
              value={summaries[item.slug]}
              last={index === group.items.length - 1}
              onPress={() => router.push(`/control/${item.slug}` as Href)}
              testID={`control-section-${item.slug}`}
            />
          ))}
        </Section>
      ))}
    </>
  );
}
