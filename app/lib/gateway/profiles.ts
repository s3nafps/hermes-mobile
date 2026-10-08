import { getItem, setItem } from './storage';

// A saved gateway. Only the address and a label are stored. Session cookies live
// in the platform cookie store, and passwords are never persisted.
export type GatewayProfile = {
  id: string;
  name: string;
  baseUrl: string;
};

type Stored = {
  profiles: GatewayProfile[];
  activeId: string | null;
};

const STORE_KEY = 'hermes.gateways.v1';

function emptyStore(): Stored {
  return { profiles: [], activeId: null };
}

export async function loadStored(): Promise<Stored> {
  try {
    const raw = await getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    };
  } catch {
    // A corrupt entry should not lock the user out. They can add the gateway again.
    return emptyStore();
  }
}

export async function saveStored(stored: Stored): Promise<void> {
  await setItem(STORE_KEY, JSON.stringify(stored));
}

export function newProfileId(): string {
  return `gw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
