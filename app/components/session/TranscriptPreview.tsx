import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { EmptyState, ErrorState, LoadingState, Section } from '@/components/ui';

import type { TranscriptLine } from './types';
import { themed } from '@/lib/theme';

type Props = {
  lines: TranscriptLine[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  // How many lines were requested. A full page means the chat may have more.
  pageSize: number;
};

// The first few messages of a saved chat. The full conversation opens in the chat screen.
export function TranscriptPreview({ lines, loading, error, onRetry, pageSize }: Props) {
  if (!lines) {
    if (error) return <ErrorState message={error} onRetry={onRetry} />;
    return loading ? <LoadingState label="Loading transcript…" /> : null;
  }
  if (lines.length === 0) {
    return <EmptyState title="No messages yet" body="Messages appear here after the first reply." />;
  }
  return (
    <View style={{ gap: 8 }}>
      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}
      <Section label="Transcript preview">
        {lines.map((line, index) => (
          <View
            key={index}
            style={[styles.line, index < lines.length - 1 && styles.lineDivider]}>
            <Text style={styles.speaker}>{line.speaker}</Text>
            <Text numberOfLines={4} style={styles.text}>
              {line.text}
            </Text>
          </View>
        ))}
      </Section>
      {lines.length >= pageSize ? (
        <Text style={styles.more}>Open the chat to read the rest.</Text>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  line: { paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  lineDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  speaker: { color: tokens.textMuted, fontSize: 13, fontWeight: '600' },
  text: { color: tokens.text, fontSize: 15, lineHeight: 21 },
  more: { color: tokens.textMuted, fontSize: 13 },
}));
