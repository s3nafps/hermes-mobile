import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lift, MONO, tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

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
        <View key={group.label} style={styles.section}>
          <View style={styles.header}>
            <Text style={styles.heading}>{group.label}</Text>
            <View style={styles.count}>
              <Text style={styles.countLabel}>{String(group.items.length)}</Text>
            </View>
          </View>

          <View style={styles.shadow}>
            <View style={styles.card}>
              {group.items.map((item, index) => (
                <SectionRow
                  key={item.slug}
                  title={item.title}
                  hint={item.hint}
                  value={summaries[item.slug]}
                  last={index === group.items.length - 1}
                  onPress={() => router.push(`/control/${item.slug}` as Href)}
                  testID={`control-section-${item.slug}`}
                />
              ))}
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

type RowProps = {
  title: string;
  hint: string;
  value?: string;
  last: boolean;
  onPress: () => void;
  testID: string;
};

// A row of at least 56px with a hairline between rows. The summary value sits in a pill.
function SectionRow({ title, hint, value, last, onPress, testID }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowHint} numberOfLines={2}>
          {hint}
        </Text>
      </View>
      {value ? (
        <View style={styles.valuePill}>
          <Text style={styles.valueLabel} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  heading: { color: tokens.textMuted, fontSize: 13, fontWeight: '600' },
  count: {
    backgroundColor: tokens.well,
    borderRadius: 999,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 1,
    alignItems: 'center',
  },
  countLabel: { color: tokens.textMuted, fontFamily: MONO, fontSize: 13 },
  // The shadow sits on an outer layer, because iOS drops a shadow from a view that clips its children.
  shadow: {
    borderRadius: 22,
    backgroundColor: tokens.surface,
    ...lift('card'),
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: tokens.surface,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  pressed: { backgroundColor: tokens.surfaceRaised },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: tokens.text, fontSize: 15 },
  rowHint: { color: tokens.textMuted, fontSize: 13 },
  valuePill: {
    backgroundColor: tokens.well,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '45%',
  },
  valueLabel: { color: tokens.textMuted, fontSize: 13 },
  chevron: { color: tokens.textMuted, fontSize: 20 },
}));
