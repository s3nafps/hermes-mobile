import { useMemo } from 'react';

import { useChat } from '@/lib/chat/ChatProvider';

// The working folder for the review and artifact screens: the first chat session that
// has reported a cwd. Null when no chat has been opened yet.
export function useWorkingFolder(): string | null {
  const { state } = useChat();
  return useMemo(() => {
    const session = Object.values(state.sessions).find((s) => s.cwd.trim() !== '');
    return session ? session.cwd : null;
  }, [state.sessions]);
}
