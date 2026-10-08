import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { requireHttp } from '@/components/bots/shared';
import { Button, ErrorState, Field, InlineNotice, LoadingState, Sheet } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { getSkillContent, saveSkillContent } from './api';
import type { InstalledSkill } from './types';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type Props = {
  skill: InstalledSkill | null;
  onClose: () => void;
  onSaved: () => void;
};

// The SKILL.md text for one skill. It opens read-only. Edit replaces the whole file on save.
export function SkillSheet({ skill, onClose, onSaved }: Props) {
  const { http } = useGateway();
  const name = skill?.name ?? null;
  const content = useGatewayQuery<string>(
    name ? async () => getSkillContent(requireHttp(http), name) : null,
    [http, name],
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const save = useAction(async () => {
    if (!name || draft === null) throw new Error('Nothing to save.');
    await saveSkillContent(requireHttp(http), name, draft);
    return draft;
  });

  const close = () => {
    setEditing(false);
    setDraft(null);
    onClose();
  };

  const onSave = async () => {
    const saved = await save.run();
    if (saved === undefined) return;
    content.setData(saved);
    setEditing(false);
    setDraft(null);
    onSaved();
  };

  const text = content.data ?? '';

  return (
    <Sheet visible={skill !== null} onClose={close} title={skill?.name ?? 'Skill'}>
      {content.loading && content.data === undefined ? <LoadingState label="Loading skill…" /> : null}
      {content.error && content.data === undefined ? (
        <ErrorState message={content.error} onRetry={content.refetch} />
      ) : null}

      {content.data !== undefined && !editing ? (
        <>
          <Text selectable style={styles.code}>
            {text || 'This skill has no content yet.'}
          </Text>
          <Button label="Edit" variant="secondary" onPress={() => setEditing(true)} />
        </>
      ) : null}

      {content.data !== undefined && editing ? (
        <>
          <Field
            label="SKILL.md"
            value={draft ?? text}
            onChangeText={setDraft}
            multiline
            style={styles.editor}
          />
          {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
          <Button
            label="Save skill"
            onPress={() => void onSave()}
            disabled={draft === null || draft === text}
            loading={save.pending}
          />
          <Button
            label="Discard changes"
            variant="secondary"
            onPress={() => {
              setEditing(false);
              setDraft(null);
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  code: { color: tokens.text, fontFamily: MONO, fontSize: 13, lineHeight: 19 },
  editor: { minHeight: 260, fontFamily: MONO, fontSize: 13 },
});
