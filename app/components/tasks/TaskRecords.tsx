import { StyleSheet, Text, View } from 'react-native';

import { Card, InlineNotice, Row, Section, SectionLabel } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';

import { formatSize } from './format';
import type { KanbanAttachment, WorkerLog } from './types';
import { themed } from '@/lib/theme';

type AttachmentsProps = {
  attachments: KanbanAttachment[] | undefined;
  error: string | null;
};

// Lists the files attached to a task. Files are read-only on mobile.
export function TaskAttachments({ attachments, error }: AttachmentsProps) {
  const files = attachments ?? [];
  return (
    <View style={styles.wrap}>
      <SectionLabel>Attachments</SectionLabel>
      <Section>
        {error && !attachments ? <Row title={error} destructive last /> : null}
        {!attachments && !error ? <Row title="Loading attachments" last /> : null}
        {attachments && files.length === 0 ? <Row title="No attachments" last /> : null}
        {files.map((file, index) => (
          <Row
            key={file.id}
            title={file.name}
            subtitle={formatSize(file.size) || undefined}
            last={index === files.length - 1}
          />
        ))}
      </Section>
      {error && attachments ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
    </View>
  );
}

type LogProps = {
  log: WorkerLog | undefined;
  error: string | null;
};

// The worker's log for this task. The server returns the newest part of the file.
export function TaskLog({ log, error }: LogProps) {
  const lines = log ? log.text.split('\n') : [];
  return (
    <View style={styles.wrap}>
      <SectionLabel>{log && log.sizeBytes ? `Worker log · ${formatSize(log.sizeBytes)}` : 'Worker log'}</SectionLabel>
      {error && !log ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {!log && !error ? <Text style={styles.empty}>Loading the log</Text> : null}
      {log && log.text === '' ? <Text style={styles.empty}>No worker log yet.</Text> : null}
      {log && log.text !== '' ? (
        <Card>
          {log.truncated ? <Text style={styles.empty}>Showing the end of the log.</Text> : null}
          {lines.map((line, index) => (
            <Text key={index} style={styles.line} selectable>
              {line}
            </Text>
          ))}
        </Card>
      ) : null}
      {error && log ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { gap: 10 },
  empty: { color: tokens.textMuted, fontSize: 15 },
  line: { color: tokens.textMuted, fontFamily: MONO, fontSize: 13, lineHeight: 18 },
}));
