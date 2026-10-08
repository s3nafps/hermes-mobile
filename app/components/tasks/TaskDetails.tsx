import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Field, InlineNotice, SectionLabel } from '@/components/ui';
import { useAction, useHttp } from '@/lib/gateway';

import { updateTask } from './api';
import { confirmFirst, labelFor } from './format';
import type { Assignee, KanbanColumn, KanbanTaskDetail, TaskPatch } from './types';

type Props = {
  board: string | null;
  detail: KanbanTaskDetail;
  columns: KanbanColumn[];
  assignees: Assignee[];
  onSaved: () => void;
};

type Form = {
  title: string;
  body: string;
  assignee: string;
  priority: string;
  status: string;
  summary: string;
};

function formOf(detail: KanbanTaskDetail): Form {
  return {
    title: detail.title,
    body: detail.body ?? '',
    assignee: detail.assignee ?? '',
    priority: String(detail.priority),
    status: detail.status,
    summary: '',
  };
}

// Builds the smallest patch that changes the task. An error means the form is invalid.
function diffOf(form: Form, detail: KanbanTaskDetail): { patch: TaskPatch; error: string | null } {
  const patch: TaskPatch = {};
  const title = form.title.trim();
  if (!title) return { patch, error: 'A task needs a title.' };
  if (title !== detail.title) patch.title = title;

  const body = form.body.trim() === '' ? null : form.body;
  if (body !== (detail.body ?? null)) patch.body = body;

  const assignee = form.assignee.trim() === '' ? null : form.assignee.trim();
  if (assignee !== detail.assignee) patch.assignee = assignee;

  const priority = form.priority.trim() === '' ? Number.NaN : Number(form.priority);
  if (!Number.isInteger(priority)) return { patch, error: 'Priority must be a whole number.' };
  if (priority !== detail.priority) patch.priority = priority;

  if (form.status !== detail.status) {
    patch.status = form.status;
    if (form.status === 'done') {
      // The board stores this as the task's result, so it must be written before the task is done.
      const summary = form.summary.trim();
      if (!summary) return { patch, error: 'Add a completion summary before marking this task done.' };
      patch.result = summary;
      patch.summary = summary;
    }
  }
  return { patch, error: null };
}

// The editable fields of a task. Save sends only what changed.
export function TaskDetails({ board, detail, columns, assignees, onSaved }: Props) {
  const http = useHttp();
  const [form, setForm] = useState<Form>(() => formOf(detail));
  const [source, setSource] = useState(detail);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction(async (patch: TaskPatch) => {
    await updateTask(http, detail.id, board, patch);
    return true;
  });

  // The server copy wins after every refetch, such as after a save or an action.
  // Resetting during render (not in an effect) avoids a second pass of renders.
  if (source !== detail) {
    setSource(detail);
    setForm(formOf(detail));
  }

  const { patch, error } = diffOf(form, detail);
  const dirty = Object.keys(patch).length > 0;

  const statusNames = Array.from(new Set([...columns.map((column) => column.name), detail.status])).filter(Boolean);
  const knownAssignee = assignees.some((item) => item.name === form.assignee);

  async function submit(next: TaskPatch) {
    const ok = await save.run(next);
    if (ok) onSaved();
  }

  function onSave() {
    if (error) {
      setProblem(error);
      return;
    }
    setProblem(null);
    if (patch.status === 'done' || patch.status === 'blocked') {
      const label = labelFor(patch.status);
      confirmFirst(
        `Mark as ${label}?`,
        'This changes the status of the task for everyone on the board.',
        `Mark ${label}`,
        () => void submit(patch),
      );
      return;
    }
    void submit(patch);
  }

  return (
    <View style={styles.form}>
      <SectionLabel>Details</SectionLabel>
      <Field
        label="Title"
        value={form.title}
        onChangeText={(title) => setForm({ ...form, title })}
        autoCapitalize="sentences"
      />
      <Field
        label="Description"
        value={form.body}
        onChangeText={(body) => setForm({ ...form, body })}
        placeholder="Add details for whoever works on this"
        multiline
        autoCapitalize="sentences"
      />

      <View style={styles.group}>
        <SectionLabel>Status</SectionLabel>
        <Chip
          options={statusNames.map((name) => ({ value: name, label: labelFor(name) }))}
          value={form.status}
          onChange={(status) => {
            if (status) setForm({ ...form, status });
          }}
        />
      </View>

      {form.status === 'done' && detail.status !== 'done' ? (
        <Field
          label="Completion summary"
          value={form.summary}
          onChangeText={(summary) => setForm({ ...form, summary })}
          placeholder="What was done. Saved as the task result."
          multiline
          autoCapitalize="sentences"
        />
      ) : null}

      {assignees.length > 0 ? (
        <View style={styles.group}>
          <SectionLabel>Pick an assignee</SectionLabel>
          <Chip
            options={assignees.map((item) => ({ value: item.name, label: item.name }))}
            value={knownAssignee ? form.assignee : null}
            onChange={(assignee) => {
              if (assignee) setForm({ ...form, assignee });
            }}
          />
        </View>
      ) : null}
      <Field
        label="Assignee"
        value={form.assignee}
        onChangeText={(assignee) => setForm({ ...form, assignee })}
        placeholder="Profile name, or leave blank"
      />
      <Field
        label="Priority"
        value={form.priority}
        onChangeText={(priority) => setForm({ ...form, priority })}
        keyboardType="number-pad"
      />

      {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
      {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
      <Button label="Save changes" onPress={onSave} disabled={!dirty} loading={save.pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  group: { gap: 8 },
});
