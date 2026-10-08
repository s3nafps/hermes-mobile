import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, InlineNotice, Row, Section, Sheet, Toggle } from '@/components/ui';
import { useAction, useHttp } from '@/lib/gateway';

import { decomposeTask, reassignTask, reclaimTask, specifyTask } from './api';
import { confirmFirst } from './format';
import type { Assignee, KanbanTaskDetail } from './types';

type Props = {
  board: string | null;
  detail: KanbanTaskDetail;
  assignees: Assignee[];
  onChanged: () => void;
};

// Status actions that the server runs on a task. Reclaim and reassign-with-stop
// interrupt a worker, so both ask first.
export function TaskActions({ board, detail, assignees, onChanged }: Props) {
  const http = useHttp();
  const [note, setNote] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [stopFirst, setStopFirst] = useState(false);

  const reclaim = useAction(async () => {
    await reclaimTask(http, detail.id, board, null);
    return true;
  });
  const specify = useAction(async () => {
    await specifyTask(http, detail.id, board);
    return true;
  });
  const decompose = useAction(async () => {
    await decomposeTask(http, detail.id, board);
    return true;
  });
  const reassign = useAction(async (name: string, reclaimFirst: boolean) => {
    await reassignTask(http, detail.id, board, name, reclaimFirst);
    return true;
  });

  async function doReclaim() {
    setNote(null);
    const ok = await reclaim.run();
    if (ok) {
      setNote('Task reclaimed.');
      onChanged();
    }
  }

  async function doSpecify() {
    setNote(null);
    const ok = await specify.run();
    if (ok) {
      setNote('Specify step requested.');
      onChanged();
    }
  }

  async function doDecompose() {
    setNote(null);
    const ok = await decompose.run();
    if (ok) {
      setNote('Decompose step requested.');
      onChanged();
    }
  }

  async function doReassign() {
    if (!profile) return;
    const ok = await reassign.run(profile, stopFirst);
    if (ok) {
      setSheetOpen(false);
      setProfile(null);
      setStopFirst(false);
      setNote(`Reassigned to ${profile}.`);
      onChanged();
    }
  }

  function askReassign() {
    if (!profile) return;
    if (stopFirst) {
      confirmFirst(
        'Stop current work?',
        'The current worker will stop before the task moves to the new profile.',
        'Reassign',
        () => void doReassign(),
        true,
      );
      return;
    }
    void doReassign();
  }

  return (
    <View style={styles.wrap}>
      <Section label="Actions">
        <Row
          title="Reclaim"
          subtitle="Takes the task back from its current worker."
          destructive
          disabled={reclaim.pending}
          onPress={() =>
            confirmFirst(
              'Reclaim this task?',
              'The current worker loses its claim on the task.',
              'Reclaim',
              () => void doReclaim(),
              true,
            )
          }
        />
        <Row
          title="Specify"
          subtitle="Runs the specify step on this task."
          disabled={specify.pending}
          onPress={() => void doSpecify()}
        />
        <Row
          title="Decompose"
          subtitle="Splits this task into smaller tasks."
          disabled={decompose.pending}
          onPress={() => void doDecompose()}
        />
        <Row
          title="Reassign"
          subtitle="Gives the task to another profile."
          onPress={() => setSheetOpen(true)}
          last
        />
      </Section>

      {note ? <InlineNotice tone="info">{note}</InlineNotice> : null}
      {reclaim.error ? <InlineNotice tone="danger">{reclaim.error}</InlineNotice> : null}
      {specify.error ? <InlineNotice tone="danger">{specify.error}</InlineNotice> : null}
      {decompose.error ? <InlineNotice tone="danger">{decompose.error}</InlineNotice> : null}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Reassign task">
        {assignees.length === 0 ? (
          <InlineNotice>No profiles were found on this gateway.</InlineNotice>
        ) : (
          <Chip
            options={assignees.map((item) => ({ value: item.name, label: item.name }))}
            value={profile}
            onChange={setProfile}
          />
        )}
        <Row
          title="Stop current work first"
          subtitle="Turn on to stop the worker before the task moves."
          right={<Toggle label="Stop current work first" value={stopFirst} onValueChange={setStopFirst} />}
          last
        />
        {reassign.error ? <InlineNotice tone="danger">{reassign.error}</InlineNotice> : null}
        <Button
          label="Reassign"
          onPress={askReassign}
          disabled={!profile}
          loading={reassign.pending}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
});
