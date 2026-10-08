import { router, type Href } from 'expo-router';

import { ControlSections, type SectionSlug } from '@/components/control/ControlSections';
import { untyped } from '@/components/control/client';
import { PressureBanners } from '@/components/control/PressureBanners';
import { StatusCard } from '@/components/control/StatusCard';
import type { ConfigObject, SystemStats, ThemesResponse } from '@/components/control/types';
import { Button, ErrorState, InlineNotice, LoadingState, Screen, ScreenTitle } from '@/components/ui';
import { useGateway, useGatewayQuery, type GatewayStatus } from '@/lib/gateway';

// Control home: the active gateway, its live state, host pressure, and links to each section.
export default function ControlScreen() {
  const gateway = useGateway();
  const { http, activeProfile } = gateway;

  const status = useGatewayQuery<GatewayStatus>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<GatewayStatus>(await http.GET('/api/status'));
    },
    [http],
    { pollMs: 5000 },
  );

  const stats = useGatewayQuery<SystemStats>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<SystemStats>(await http.GET('/api/system/stats'));
    },
    [http],
    { pollMs: 15000 },
  );

  const themes = useGatewayQuery<ThemesResponse>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ThemesResponse>(await http.GET('/api/dashboard/themes'));
    },
    [http],
  );

  const config = useGatewayQuery<ConfigObject>(
    async () => {
      if (!http) throw new Error('The gateway is not connected.');
      return untyped<ConfigObject>(await http.GET('/api/config'));
    },
    [http],
  );

  const current = status.data ?? gateway.status;
  const platformCount = current ? Object.keys(current.gateway_platforms).length : 0;
  const approvalMode = readApprovalMode(config.data);
  const themeLabel = themes.data?.themes.find((t) => t.name === themes.data?.active)?.label;

  const summaries: Partial<Record<SectionSlug, string>> = {
    gateways: `${gateway.profiles.length} saved`,
    channels: current ? (current.gateway_running ? `${platformCount} active` : 'Gateway stopped') : undefined,
    security: approvalMode ? `Approvals: ${approvalMode}` : undefined,
    config: current
      ? current.config_version < current.latest_config_version
        ? 'Migration pending'
        : `Version ${current.config_version}`
      : undefined,
    settings: themeLabel ? `Theme: ${themeLabel}` : undefined,
  };

  // Live polling already keeps this screen current, so pull-to-refresh only triggers a reload.
  const refresh = () => {
    status.refetch();
    stats.refetch();
  };

  return (
    <Screen onRefresh={refresh} bottomPadding={40}>
      <ScreenTitle
        title={activeProfile?.name ?? 'Control'}
        subtitle={activeProfile ? `${activeProfile.baseUrl}${current ? ` · Hermes ${current.version}` : ''}` : undefined}
        action={
          <Button
            label="Switch"
            variant="ghost"
            compact
            onPress={() => router.push('/control/gateways' as Href)}
          />
        }
      />

      {status.error && !current ? (
        <ErrorState message={status.error} onRetry={status.refetch} />
      ) : null}
      {status.error && current ? <InlineNotice tone="danger">{`Could not refresh status: ${status.error}`}</InlineNotice> : null}

      {!current && !status.error ? <LoadingState label="Checking the gateway…" /> : null}

      {current ? <StatusCard status={current} onChanged={status.refetch} /> : null}

      <PressureBanners stats={stats.data} />

      <ControlSections summaries={summaries} />
    </Screen>
  );
}

// Reads approvals.mode from the config. Returns null when the config is missing or unexpected.
function readApprovalMode(config: ConfigObject | undefined): string | null {
  const approvals = config?.approvals;
  if (!approvals || typeof approvals !== 'object') return null;
  const mode = (approvals as { mode?: unknown }).mode;
  return typeof mode === 'string' ? mode : null;
}
