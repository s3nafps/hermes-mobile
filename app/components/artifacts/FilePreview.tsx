import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes, formatTime } from '@/components/review/format';
import { ErrorState, InlineNotice, LoadingState } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import type { GatewayQuery } from '@/lib/gateway/hooks';

import { MAX_PREVIEW_BYTES, MAX_PREVIEW_LINES, fileKind } from './fileKind';
import type { FilePreviewData, ManagedEntry } from './types';
import { themed } from '@/lib/theme';

// Contents of the file sheet. Images and other binary files show only their name, type and size.
export function FilePreview({ entry, preview }: { entry: ManagedEntry; preview: GatewayQuery<FilePreviewData> }) {
  const kind = fileKind(entry);
  const details = (
    <View style={styles.details}>
      <Text style={styles.detail}>Type: {kind.label}</Text>
      <Text style={styles.detail}>Size: {formatBytes(entry.size)}</Text>
      <Text style={styles.detail}>Modified: {formatTime(entry.mtime)}</Text>
    </View>
  );

  if (!kind.previewable) {
    return (
      <View style={styles.stack}>
        {details}
        <InlineNotice tone="info">Only text files can be previewed here.</InlineNotice>
      </View>
    );
  }
  if (entry.size !== null && entry.size > MAX_PREVIEW_BYTES) {
    return (
      <View style={styles.stack}>
        {details}
        <InlineNotice tone="warning">This file is too large to preview here.</InlineNotice>
      </View>
    );
  }
  if (preview.error) return <ErrorState message={preview.error} onRetry={preview.refetch} />;
  // A preview from an earlier file can still be in state while this one loads. Only show the matching path.
  if (!preview.data || preview.data.path !== entry.path) return <LoadingState label="Loading file…" />;
  if (preview.data.text === null) {
    return (
      <View style={styles.stack}>
        {details}
        <InlineNotice tone="info">This file is not plain text, so its contents are not shown.</InlineNotice>
      </View>
    );
  }

  const lines = preview.data.text.replace(/\r/g, '').split('\n');
  return (
    <View style={styles.stack}>
      {details}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text selectable style={styles.code}>
          {lines.slice(0, MAX_PREVIEW_LINES).join('\n')}
        </Text>
      </ScrollView>
      {lines.length > MAX_PREVIEW_LINES ? (
        <Text style={styles.note}>
          Showing the first {MAX_PREVIEW_LINES} of {lines.length} lines.
        </Text>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  stack: { gap: 12 },
  details: { gap: 4 },
  detail: { color: tokens.textMuted, fontSize: 13 },
  code: { color: tokens.text, fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  note: { color: tokens.textMuted, fontSize: 13 },
}));
