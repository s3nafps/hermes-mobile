import { untyped } from '@/components/control/client';
import { unwrap, type GatewayHttp } from '@/lib/gateway';

import { firstText, isRecord, nonNull, recordsUnder, type Raw } from './read';
import { expiryOf, whenText } from './time';
import type { ApprovedUser, PairingState, PendingCode } from './types';

// GET /api/pairing returns {} in the generated schema. The reader accepts the lists
// under pending / approved (or their common variants) and skips entries it cannot read.

const PENDING_KEYS = ['pending', 'pending_codes', 'codes'];
const APPROVED_KEYS = ['approved', 'approved_users', 'users'];

function userName(raw: Raw): string | null {
  return firstText(raw, ['user_name', 'username', 'display_name', 'name']);
}

function userId(raw: Raw): string | null {
  return firstText(raw, ['user_id', 'user', 'sender_id', 'id']);
}

function toPending(raw: Raw, now: number): PendingCode | null {
  const code = firstText(raw, ['code', 'pairing_code']);
  if (!code) return null;
  const platform = firstText(raw, ['platform', 'platform_id', 'source']);
  return {
    key: `${platform ?? 'unknown'}:${code}`,
    platform,
    code,
    who: userName(raw) ?? userId(raw),
    expiresAt: expiryOf(raw, now),
  };
}

function toApproved(raw: Raw, index: number): ApprovedUser {
  const platform = firstText(raw, ['platform', 'platform_id', 'source']);
  const id = userId(raw);
  return {
    key: `${platform ?? 'unknown'}:${id ?? index}`,
    platform,
    userId: id,
    who: userName(raw),
    approvedAt: whenText(raw.approved_at ?? raw.created_at ?? raw.approved_on),
  };
}

export async function loadPairing(http: GatewayHttp): Promise<PairingState> {
  const raw = untyped<unknown>(await http.GET('/api/pairing'));
  // Only an object can hold both lists. A bare array is ambiguous, so it is ignored.
  const root: Raw = isRecord(raw) ? raw : {};
  const now = Date.now();
  return {
    pending: recordsUnder(root, PENDING_KEYS)
      .map((entry) => toPending(entry, now))
      .filter(nonNull),
    approved: recordsUnder(root, APPROVED_KEYS).map(toApproved),
  };
}

export async function approvePairing(http: GatewayHttp, platform: string, code: string): Promise<void> {
  unwrap(await http.POST('/api/pairing/approve', { body: { platform, code } }));
}

export async function revokePairing(http: GatewayHttp, platform: string, userId: string): Promise<void> {
  unwrap(await http.POST('/api/pairing/revoke', { body: { platform, user_id: userId } }));
}

export async function clearPendingPairing(http: GatewayHttp): Promise<void> {
  unwrap(await http.POST('/api/pairing/clear-pending'));
}
