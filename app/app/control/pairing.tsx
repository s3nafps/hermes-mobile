import { Stack } from 'expo-router';
import { useState } from 'react';

import { NOT_CONNECTED } from '@/components/control/client';
import { confirmAction } from '@/components/control/confirm';
import { ApprovedRow, PendingRow } from '@/components/messaging/PairingRows';
import {
  approvePairing,
  clearPendingPairing,
  loadPairing,
  revokePairing,
} from '@/components/messaging/pairingApi';
import { useNow } from '@/components/messaging/time';
import type { ApprovedUser, PairingState, PendingCode } from '@/components/messaging/types';
import { Button, ErrorState, InlineNotice, LoadingState, Row, Screen, ScreenTitle, Section } from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

// Pending pairing codes and approved users. Codes are approved here, and access can be
// revoked or the waiting codes cleared.
export default function PairingScreen() {
  const { http } = useGateway();
  const now = useNow(15_000);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pairing = useGatewayQuery<PairingState>(
    async () => {
      if (!http) throw new Error(NOT_CONNECTED);
      return loadPairing(http);
    },
    [http],
    { pollMs: 15_000 },
  );

  const approve = useAction(async (platform: string, code: string) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await approvePairing(http, platform, code);
    return true;
  });

  const revoke = useAction(async (platform: string, userId: string) => {
    if (!http) throw new Error(NOT_CONNECTED);
    await revokePairing(http, platform, userId);
    return true;
  });

  const clear = useAction(async () => {
    if (!http) throw new Error(NOT_CONNECTED);
    await clearPendingPairing(http);
    return true;
  });

  const onApprove = async (item: PendingCode) => {
    if (!item.platform) return;
    setBusyKey(item.key);
    await approve.run(item.platform, item.code);
    setBusyKey(null);
    pairing.refetch();
  };

  const onRevoke = (item: ApprovedUser) => {
    const { platform, userId } = item;
    if (!platform || !userId) return;
    confirmAction({
      title: 'Revoke access?',
      body: `${item.who ?? userId} loses access to the agent on ${platform} until they are approved again.`,
      action: 'Revoke',
      destructive: true,
      onConfirm: async () => {
        setBusyKey(item.key);
        await revoke.run(platform, userId);
        setBusyKey(null);
        pairing.refetch();
      },
    });
  };

  const onClear = () =>
    confirmAction({
      title: 'Clear pending codes?',
      body: 'Codes that are waiting for approval stop working.',
      action: 'Clear codes',
      destructive: true,
      onConfirm: async () => {
        setBusyKey('clear');
        await clear.run();
        setBusyKey(null);
        pairing.refetch();
      },
    });

  const data = pairing.data;
  const writeError = approve.error ?? revoke.error ?? clear.error;
  const busy = busyKey !== null;

  return (
    <Screen refreshing={pairing.loading && !!data} onRefresh={pairing.refetch}>
      <Stack.Screen options={{ title: 'Pairing and access' }} />
      <ScreenTitle title="Pairing and access" subtitle="Approve people who message the agent, or remove their access." />

      {writeError ? <InlineNotice tone="danger">{writeError}</InlineNotice> : null}

      {!data && pairing.loading ? <LoadingState label="Loading pairing…" /> : null}
      {!data && pairing.error ? <ErrorState message={pairing.error} onRetry={pairing.refetch} /> : null}

      {data ? (
        <>
          <Section label="Pending codes">
            {data.pending.length === 0 ? (
              <Row title="Nothing waiting" subtitle="New pairing codes show up here." last />
            ) : (
              data.pending.map((item, index) => (
                <PendingRow
                  key={item.key}
                  item={item}
                  now={now}
                  last={index === data.pending.length - 1}
                  busy={busy}
                  onApprove={() => onApprove(item)}
                />
              ))
            )}
          </Section>

          {data.pending.length > 0 ? (
            <Button
              label="Clear pending codes"
              variant="danger"
              disabled={busy}
              loading={busyKey === 'clear'}
              onPress={onClear}
            />
          ) : null}

          <Section label="Approved users">
            {data.approved.length === 0 ? (
              <Row title="No approved users" subtitle="People you approve show up here." last />
            ) : (
              data.approved.map((item, index) => (
                <ApprovedRow
                  key={item.key}
                  item={item}
                  last={index === data.approved.length - 1}
                  busy={busy}
                  onRevoke={() => onRevoke(item)}
                />
              ))
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
