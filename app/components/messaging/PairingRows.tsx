import { StyleSheet, Text, View } from 'react-native';

import { Button, Row } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';

import { formatTimeLeft } from './time';
import type { ApprovedUser, PendingCode } from './types';

type PendingProps = {
  item: PendingCode;
  now: number;
  last: boolean;
  busy: boolean;
  onApprove: () => void;
};

// A code waiting for approval. The code is shown in monospace, with time left when known.
export function PendingRow({ item, now, last, busy, onApprove }: PendingProps) {
  const expired = item.expiresAt !== null && item.expiresAt <= now;
  const timeLeft = item.expiresAt === null ? null : formatTimeLeft(item.expiresAt, now);
  const subtitle = [item.platform ?? 'Unknown platform', timeLeft].filter(Boolean).join(' · ');
  return (
    <Row
      title={item.who ?? 'Waiting for approval'}
      subtitle={subtitle}
      last={last}
      right={
        <View style={styles.codeBlock}>
          <Text style={styles.code} selectable>
            {item.code}
          </Text>
          <Button
            label="Approve"
            compact
            disabled={!item.platform || expired || busy}
            onPress={onApprove}
          />
        </View>
      }
    />
  );
}

type ApprovedProps = {
  item: ApprovedUser;
  last: boolean;
  busy: boolean;
  onRevoke: () => void;
};

// A person who was approved. Revoking needs both the platform and the user id.
export function ApprovedRow({ item, last, busy, onRevoke }: ApprovedProps) {
  const parts = [
    item.platform,
    item.who && item.userId ? item.userId : null,
    item.approvedAt ? `Approved ${item.approvedAt}` : null,
  ].filter(Boolean);
  return (
    <Row
      title={item.who ?? item.userId ?? 'Unknown user'}
      subtitle={parts.length > 0 ? parts.join(' · ') : undefined}
      last={last}
      right={
        <Button
          label="Revoke"
          variant="danger"
          compact
          disabled={!item.platform || !item.userId || busy}
          onPress={onRevoke}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  codeBlock: { alignItems: 'flex-end', gap: 6 },
  code: { color: tokens.text, fontFamily: MONO, fontSize: 18, letterSpacing: 2 },
});
