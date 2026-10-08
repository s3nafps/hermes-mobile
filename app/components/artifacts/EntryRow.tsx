import { formatBytes, formatTime } from '@/components/review/format';
import { Row } from '@/components/ui';

import { fileKind } from './fileKind';
import type { ManagedEntry } from './types';

// One folder or file in the artifact list: name, type and size, with the modified time at the right.
export function EntryRow({ entry, last, onPress }: { entry: ManagedEntry; last: boolean; onPress: () => void }) {
  const subtitle = entry.is_directory ? 'Folder' : `${fileKind(entry).label} · ${formatBytes(entry.size)}`;
  return (
    <Row
      title={entry.name}
      subtitle={subtitle}
      value={formatTime(entry.mtime)}
      onPress={onPress}
      last={last}
    />
  );
}
