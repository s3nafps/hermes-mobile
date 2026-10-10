import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, InlineNotice, SectionLabel } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';
import { useAction, useHttp } from '@/lib/gateway';

import { addComment } from './api';
import { formatWhen } from './format';
import type { KanbanComment } from './types';
import { themed } from '@/lib/theme';

type Props = {
  board: string | null;
  taskId: string;
  comments: KanbanComment[];
  onChanged: () => void;
};

export function TaskComments({ board, taskId, comments, onChanged }: Props) {
  const http = useHttp();
  const [body, setBody] = useState('');
  const post = useAction(async (text: string) => {
    await addComment(http, taskId, board, text);
    return true;
  });

  async function onPost() {
    const text = body.trim();
    if (!text) return;
    const ok = await post.run(text);
    if (ok) {
      setBody('');
      onChanged();
    }
  }

  return (
    <View style={styles.wrap}>
      <SectionLabel>Comments</SectionLabel>
      {comments.length === 0 ? <Text style={styles.empty}>No comments yet.</Text> : null}
      {comments.map((comment) => (
        <Card key={comment.id} style={styles.comment}>
          <Text style={styles.meta}>
            {comment.author ?? 'Unknown author'} ·{' '}
            <Text style={styles.mono}>{formatWhen(comment.createdAt, 'time unknown')}</Text>
          </Text>
          <Text style={styles.body}>{comment.body}</Text>
        </Card>
      ))}
      <Field
        label="Add a comment"
        value={body}
        onChangeText={setBody}
        placeholder="Write a note for the team"
        multiline
        autoCapitalize="sentences"
      />
      {post.error ? <InlineNotice tone="danger">{post.error}</InlineNotice> : null}
      <Button
        label="Post comment"
        variant="secondary"
        onPress={() => void onPost()}
        disabled={!body.trim()}
        loading={post.pending}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { gap: 10 },
  empty: { color: tokens.textMuted, fontSize: 15 },
  comment: { gap: 4 },
  meta: { color: tokens.textMuted, fontSize: 13 },
  mono: { fontFamily: MONO },
  body: { color: tokens.text, fontSize: 15, lineHeight: 21 },
}));
