import { messageOf } from './hooks';
import {
  addressHints,
  createGatewayHttp,
  GatewayHttpError,
  isPlainHttpPublic,
  normalizeBaseUrl,
  REQUEST_TIMEOUT_MS,
  toWebSocketUrl,
  unwrap,
  withDeadline,
} from './http';
import type { GatewayStatus } from './status';

export type StepId = 'address' | 'reach' | 'sign-in' | 'chat';
export type StepState = 'pending' | 'running' | 'ok' | 'warn' | 'fail' | 'skipped';

export type DiagnosisStep = {
  id: StepId;
  title: string;
  state: StepState;
  detail: string;
  hint?: string;
};

const TITLES: Record<StepId, string> = {
  address: 'Address',
  reach: 'Reach the gateway',
  'sign-in': 'Sign-in',
  chat: 'Chat channel',
};

const ORDER: StepId[] = ['address', 'reach', 'sign-in', 'chat'];

export function initialSteps(): DiagnosisStep[] {
  return ORDER.map((id) => ({ id, title: TITLES[id], state: 'pending', detail: '' }));
}

// Runs the four checks in order, and reports the list after each change. A failed step
// skips the rest, because they all depend on it.
export async function runDiagnosis(address: string, report: (steps: DiagnosisStep[]) => void): Promise<void> {
  let steps = initialSteps();
  const update = (id: StepId, patch: Partial<Omit<DiagnosisStep, 'id' | 'title'>>) => {
    steps = steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
    report(steps);
  };
  const skipFrom = (id: StepId) => {
    const from = ORDER.indexOf(id);
    for (const later of ORDER.slice(from + 1)) update(later, { state: 'skipped', detail: 'Skipped.' });
  };

  update('address', { state: 'running' });
  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(address);
  } catch (caught) {
    update('address', { state: 'fail', detail: messageOf(caught), hint: addressHints(address).join(' ') || undefined });
    skipFrom('address');
    return;
  }
  const hints = [...addressHints(address)];
  if (isPlainHttpPublic(address)) {
    hints.push('This address uses plain http on the internet. Your password and session travel unencrypted. Use Tailscale, a VPN, or an https address.');
  }
  update('address', { state: hints.length ? 'warn' : 'ok', detail: baseUrl, hint: hints.join(' ') || undefined });

  update('reach', { state: 'running', detail: 'Contacting the gateway…' });
  const started = Date.now();
  let status: GatewayStatus;
  try {
    const probe = createGatewayHttp(baseUrl);
    status = unwrap(await withDeadline((signal) => probe.GET('/api/status', { signal }))) as unknown as GatewayStatus;
  } catch (caught) {
    update('reach', { state: 'fail', detail: messageOf(caught), hint: reachHint(caught) });
    skipFrom('reach');
    return;
  }
  update('reach', { state: 'ok', detail: `Hermes ${status.version} answered in ${Date.now() - started} ms.` });

  update('sign-in', { state: 'running' });
  if (!status.auth_required) {
    update('sign-in', { state: 'ok', detail: 'This gateway is open. No password is needed.' });
  } else {
    try {
      unwrap(await withDeadline((signal) => createGatewayHttp(baseUrl).GET('/api/auth/me', { signal })));
      update('sign-in', { state: 'ok', detail: 'You are signed in.' });
    } catch (caught) {
      if (caught instanceof GatewayHttpError && caught.status === 401) {
        update('sign-in', {
          state: 'warn',
          detail: 'Sign-in required.',
          hint: 'Sign in on the connect screen with your dashboard username and password.',
        });
        skipFrom('sign-in');
        update('chat', { state: 'skipped', detail: 'Sign in first, then test again.' });
        return;
      }
      update('sign-in', { state: 'fail', detail: messageOf(caught) });
      skipFrom('sign-in');
      return;
    }
  }

  update('chat', { state: 'running', detail: 'Opening the chat channel…' });
  try {
    const url = await chatUrl(baseUrl, status.auth_required);
    await openSocket(url);
    update('chat', { state: 'ok', detail: 'The chat channel opened.' });
  } catch (caught) {
    update('chat', { state: 'fail', detail: messageOf(caught), hint: 'Try signing in again on the connect screen.' });
  }
}

function reachHint(caught: unknown): string {
  if (caught instanceof GatewayHttpError && caught.status === 404) {
    return 'The address answered, but it is not the dashboard. Check the port; the dashboard usually uses 9119.';
  }
  if (caught instanceof Error && caught.message.startsWith('No answer')) {
    return 'Nothing answered in time. Check that Hermes is running, that the port is open to this phone, and that the address is right.';
  }
  return 'The phone could not reach that address. Check the network, Tailscale, and the address and port.';
}

// Gated gateways hand out a single-use ticket after sign-in. Open ones use the token from their page.
async function chatUrl(baseUrl: string, authRequired: boolean): Promise<string> {
  if (authRequired) {
    const ticket = unwrap(
      await withDeadline((signal) => createGatewayHttp(baseUrl).POST('/api/auth/ws-ticket', { signal })),
    ) as unknown as { ticket: string };
    return toWebSocketUrl(baseUrl, '/api/ws', { ticket: ticket.ticket });
  }
  const html = await withDeadline((signal) =>
    fetch(baseUrl + '/', { credentials: 'include', signal }).then((response) => response.text()),
  );
  const match = /window\.__HERMES_SESSION_TOKEN__="([^"]+)"/.exec(html);
  if (!match) throw new Error('This gateway did not provide a connection token.');
  return toWebSocketUrl(baseUrl, '/api/ws', { token: match[1] });
}

// Opens the chat socket and closes it again, to prove the channel works.
function openSocket(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`The chat channel did not open within ${REQUEST_TIMEOUT_MS / 1000} seconds.`));
    }, REQUEST_TIMEOUT_MS);
    socket.onopen = () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    };
    socket.onclose = (close) => {
      clearTimeout(timer);
      if (close.code === 4401 || close.code === 4403) {
        reject(new Error('The gateway refused the sign-in for the chat channel.'));
        return;
      }
      reject(new Error('The chat channel closed before it opened.'));
    };
  });
}
