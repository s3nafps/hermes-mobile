import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { confirmAction } from '@/components/control/confirm';
import { untyped } from '@/components/control/client';
import { cloneConfig, getPath, setPath } from '@/components/control/configPath';
import { KeySheet } from '@/components/control/KeySheet';
import { ListEditor } from '@/components/control/ListEditor';
import type { ConfigObject, EnvVarInfo, EnvVars } from '@/components/control/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { unwrap, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

const APPROVAL_MODES = [
  { value: 'manual', label: 'Manual', hint: 'Ask before running any dangerous command.' },
  { value: 'smart', label: 'Smart', hint: 'Ask only for commands that look risky.' },
  { value: 'off', label: 'Off', hint: 'Never ask. Commands run without approval.' },
] as const;

// Names that usually hold an API key or token. Only these are listed on this screen.
const KEY_NAME = /(KEY|TOKEN|SECRET|PASSWORD)/i;

type KeyTarget = { name: string | null } | null;

// Approval mode, command allowlist, deny patterns, API keys and secret managers.
export default function SecurityScreen() {
  const { http } = useGateway();
  const [keyTarget, setKeyTarget] = useState<KeyTarget>(null);

  const config = useGatewayQuery<ConfigObject>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ConfigObject>(await http.GET('/api/config'));
    },
    [http],
  );

  const env = useGatewayQuery<EnvVars>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      const data = untyped<EnvVars>(await http.GET('/api/env'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The gateway sent keys in an unexpected shape.');
      }
      return data;
    },
    [http],
  );

  // Writes the whole config with the given values changed, then keeps the local copy in step.
  const writeConfig = useAction(async (changes: [string, unknown][]) => {
    if (!http || !config.data) throw new Error('The gateway is not connected.');
    let next = cloneConfig(config.data);
    for (const [path, value] of changes) next = setPath(next, path, value);
    unwrap(await http.PUT('/api/config', { body: { config: next } }));
    config.setData(next);
    return true;
  });

  const approvals = getPath(config.data, 'approvals.mode');
  const mode = typeof approvals === 'string' ? approvals : null;
  const allowlist = stringList(getPath(config.data, 'command_allowlist'));
  const deny = stringList(getPath(config.data, 'approvals.deny'));
  const keys = Object.entries(env.data ?? {})
    .filter(([name]) => KEY_NAME.test(name))
    .sort(([a], [b]) => a.localeCompare(b));

  const chooseMode = (next: string) => {
    if (next === mode) return;
    const apply = () => void writeConfig.run([['approvals.mode', next]]);
    if (next === 'off') {
      confirmAction({
        title: 'Turn approvals off?',
        body: 'Commands run without asking. Only do this on a machine you trust.',
        action: 'Turn off',
        destructive: true,
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const loading = (config.loading && !config.data) || (env.loading && !env.data);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Security and keys' }} />
      <ScreenTitle title="Security and keys" subtitle="Approvals, allowlist, API keys and secret managers." />

      {writeConfig.error ? <InlineNotice tone="danger">{writeConfig.error}</InlineNotice> : null}

      {loading ? <LoadingState label="Loading security settings…" /> : null}
      {config.error && !config.data ? <ErrorState message={config.error} onRetry={config.refetch} /> : null}

      {config.data ? (
        <>
          <Section label="Approval mode">
            {APPROVAL_MODES.map((option, index) => {
              const active = option.value === mode;
              return (
                <Row
                  key={option.value}
                  title={option.label}
                  subtitle={option.hint}
                  last={index === APPROVAL_MODES.length - 1}
                  right={active ? <Badge label="Current" tone="running" /> : undefined}
                  onPress={active || writeConfig.pending ? undefined : () => chooseMode(option.value)}
                />
              );
            })}
          </Section>

          <ListEditor
            label="Command allowlist"
            items={allowlist}
            placeholder="for example: git status"
            emptyTitle="No commands allowed yet"
            emptyBody="Commands on this list run without asking."
            busy={writeConfig.pending}
            onSave={(next) => writeConfig.run([['command_allowlist', next]]).then((ok) => ok === true)}
          />

          <ListEditor
            label="Deny patterns"
            items={deny}
            placeholder="for example: rm -rf"
            emptyTitle="No deny patterns"
            emptyBody="Commands that match these patterns are always blocked."
            busy={writeConfig.pending}
            onSave={(next) => writeConfig.run([['approvals.deny', next]]).then((ok) => ok === true)}
          />
        </>
      ) : null}

      <Section label="API keys">
        {env.error && !env.data ? <ErrorState message={env.error} onRetry={env.refetch} /> : null}
        {env.data && keys.length === 0 ? (
          <EmptyState title="No API keys yet" body="Add a key below. Values are stored on the gateway." />
        ) : null}
        {keys.map(([name, info], index) => (
          <Row
            key={name}
            title={name}
            subtitle={keySubtitle(info)}
            last={index === keys.length - 1}
            right={<Badge label={info.is_set ? 'Set' : 'Not set'} tone={info.is_set ? 'done' : 'neutral'} />}
            onPress={() => setKeyTarget({ name })}
          />
        ))}
        <Row title="Add an API key" subtitle="Enter the name and value." last onPress={() => setKeyTarget({ name: null })} />
      </Section>

      <Section label="Secret managers">
        <ManagerRow
          title="Bitwarden"
          enabled={getPath(config.data, 'secrets.bitwarden.enabled') === true}
          detail={stringOrNull(getPath(config.data, 'secrets.bitwarden.server_url'))}
        />
        <ManagerRow
          title="1Password"
          enabled={getPath(config.data, 'secrets.onepassword.enabled') === true}
          detail={stringOrNull(getPath(config.data, 'secrets.onepassword.account'))}
          last
        />
      </Section>

      <Card>
        <Text style={styles.note}>
          Key values are never shown in full. Only the gateway&apos;s redacted preview is displayed.
        </Text>
      </Card>

      <KeySheet
        key={keyTarget?.name ?? 'new'}
        visible={keyTarget !== null}
        onClose={() => setKeyTarget(null)}
        name={keyTarget?.name ?? null}
        info={keyTarget?.name ? env.data?.[keyTarget.name] : undefined}
        onChanged={env.refetch}
      />
    </Screen>
  );
}

function ManagerRow({ title, enabled, detail, last }: { title: string; enabled: boolean; detail: string | null; last?: boolean }) {
  return (
    <Row
      title={title}
      subtitle={detail ?? 'Not configured'}
      last={last}
      right={<Badge label={enabled ? 'On' : 'Off'} tone={enabled ? 'running' : 'neutral'} />}
    />
  );
}

function keySubtitle(info: EnvVarInfo): string {
  if (!info.is_set) return info.description ?? 'Not set';
  return `Stored as ${info.redacted_value ?? 'a hidden value'}`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

const styles = StyleSheet.create({
  note: { color: tokens.textMuted, fontSize: 12, lineHeight: 18 },
});
