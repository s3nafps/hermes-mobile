import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { confirmAction } from '@/components/control/confirm';
import { untyped } from '@/components/control/client';
import type { ThemesResponse, UpdateCheck } from '@/components/control/types';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  InlineNotice,
  LoadingState,
  Row,
  Screen,
  ScreenTitle,
  Section,
  Sheet,
} from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { unwrap, useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const MAX_OUTPUT = 4000;

// App-level settings: the gateway in use, the dashboard theme, updates, maintenance and sign out.
export default function SettingsScreen() {
  const { http, activeProfile, status, signOut } = useGateway();
  const [themePicking, setThemePicking] = useState(false);
  const [checks, setChecks] = useState(0);
  const [doctorText, setDoctorText] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);

  const themes = useGatewayQuery<ThemesResponse>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ThemesResponse>(await http.GET('/api/dashboard/themes'));
    },
    [http],
  );

  // Runs the update check once on open. Each press of "Check for updates" asks the gateway to re-check.
  const update = useGatewayQuery<UpdateCheck>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<UpdateCheck>(await http.GET('/api/hermes/update/check', { params: { query: { force: checks > 0 } } }));
    },
    [http, checks],
  );

  const setTheme = useAction(async (name: string) => {
    if (!http) throw new Error('The gateway is not connected.');
    unwrap(await http.PUT('/api/dashboard/theme', { body: { name } }));
    return true;
  });

  const doctor = useAction(async () => {
    if (!http) throw new Error('The gateway is not connected.');
    return untyped<unknown>(await http.POST('/api/ops/doctor'));
  });

  const backup = useAction(async () => {
    if (!http) throw new Error('The gateway is not connected.');
    return untyped<{ path?: unknown } | null>(await http.POST('/api/ops/backup', { body: {} }));
  });

  const chooseTheme = async (name: string) => {
    if (await setTheme.run(name)) {
      themes.refetch();
      setThemePicking(false);
    }
  };

  const runDoctor = async () => {
    const result = await doctor.run();
    if (result === undefined) return;
    const text = JSON.stringify(result, null, 2) ?? 'The gateway returned no output.';
    setDoctorText(text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…` : text);
  };

  const runBackup = async () => {
    const result = await backup.run();
    if (result === undefined) return;
    setBackupNote(typeof result?.path === 'string' ? `Backup saved to ${result.path}` : 'Backup created.');
  };

  const confirmSignOut = () =>
    confirmAction({
      title: 'Sign out?',
      body: 'You will need to sign in again to use this gateway.',
      action: 'Sign out',
      destructive: true,
      onConfirm: () => {
        signOut().catch(() => Alert.alert('Sign out', 'Could not sign out. Try again.'));
      },
    });

  const activeTheme = themes.data?.themes.find((t) => t.name === themes.data?.active);
  const themeValue = activeTheme ? activeTheme.label : themes.error ? 'Unavailable' : '…';
  const check = update.data;
  const checkSummary = !check
    ? undefined
    : check.update_available
      ? `${check.behind ?? '?'} commit(s) behind`
      : check.behind === 0
        ? 'Up to date'
        : 'Unknown';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScreenTitle title="Settings and system" subtitle="This app and the gateway behind it." />

      <Section label="This app">
        <Row title="App version" value={Constants.expoConfig?.version ?? '—'} last />
      </Section>

      <Section label="Gateway">
        <Row title="Connected to" subtitle={activeProfile?.baseUrl} value={activeProfile?.name} />
        <Row title="Hermes version" value={status?.version} />
        <Row
          title="Dashboard theme"
          subtitle="Applies to the gateway dashboard"
          value={themeValue}
          onPress={themes.data ? () => setThemePicking(true) : undefined}
          last
        />
      </Section>

      {themes.error && !themes.data ? <ErrorState message={themes.error} onRetry={themes.refetch} /> : null}

      <Section label="Updates">
        {update.loading && !update.data ? <LoadingState label="Checking for updates…" /> : null}
        {update.error && !update.data ? <InlineNotice tone="danger">{`Could not check for updates. ${update.error}`}</InlineNotice> : null}
        {check ? (
          <>
            <Row title="Installed version" value={check.current_version ?? '—'} />
            <Row title="Status" subtitle={check.message ?? check.update_command ?? undefined} value={checkSummary} />
          </>
        ) : null}
        <Row title="Check for updates" subtitle="Asks the gateway to look again" onPress={() => setChecks((n) => n + 1)} last />
      </Section>

      <Section label="Maintenance">
        <Row
          title="Run doctor"
          subtitle="Checks the gateway setup"
          right={<Button label="Run" variant="secondary" compact loading={doctor.pending} disabled={doctor.pending} onPress={runDoctor} />}
        />
        <Row
          title="Create backup"
          subtitle="Saves a copy of the Hermes home folder"
          last
          right={<Button label="Back up" variant="secondary" compact loading={backup.pending} disabled={backup.pending} onPress={runBackup} />}
        />
      </Section>

      {doctor.error ? <InlineNotice tone="danger">{doctor.error}</InlineNotice> : null}
      {backup.error ? <InlineNotice tone="danger">{backup.error}</InlineNotice> : null}
      {backupNote ? <InlineNotice tone="info">{backupNote}</InlineNotice> : null}
      {doctorText ? (
        <Card>
          <Text selectable style={styles.output}>
            {doctorText}
          </Text>
        </Card>
      ) : null}

      <Section label="Account">
        <Row title="Sign out" subtitle="Ends this app's session with the gateway" destructive last onPress={confirmSignOut} />
      </Section>

      <Sheet visible={themePicking} onClose={() => setThemePicking(false)} title="Dashboard theme">
        {setTheme.error ? <InlineNotice tone="danger">{setTheme.error}</InlineNotice> : null}
        {(themes.data?.themes ?? []).map((theme) => {
          const active = theme.name === themes.data?.active;
          return (
            <Row
              key={theme.name}
              title={theme.label}
              subtitle={theme.description}
              right={active ? <Badge label="Current" tone="running" /> : undefined}
              disabled={setTheme.pending}
              onPress={active ? undefined : () => void chooseTheme(theme.name)}
            />
          );
        })}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  output: { color: tokens.text, fontFamily: MONO, fontSize: 12, lineHeight: 17 },
});
