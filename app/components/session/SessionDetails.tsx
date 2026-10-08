import { Row, Section } from '@/components/ui';

import { formatWhen } from './format';
import type { StoredSession } from './types';

// The saved facts about one chat: model, start time and message count.
export function SessionDetails({ session }: { session: StoredSession }) {
  return (
    <Section label="Details">
      <Row title="Model" value={session.model || 'Not recorded'} />
      <Row title="Started" value={formatWhen(session.startedAt) || 'Unknown'} />
      <Row
        title="Messages"
        value={session.messageCount === null ? 'Unknown' : String(session.messageCount)}
        last
      />
    </Section>
  );
}
