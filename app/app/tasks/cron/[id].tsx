import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CronForm } from '@/components/tasks/CronForm';
import {
  deleteCronJob,
  getCronJob,
  listCronRuns,
  listDeliveryTargets,
  setCronJobEnabled,
  triggerCronJob,
  updateCronJob,
} from '@/components/tasks/api';
import { confirmFirst, formatWhen, labelFor, toneFor } from '@/components/tasks/format';
import type { CronJob, CronValues } from '@/components/tasks/types';
import { Badge, Button, ErrorState, InlineNotice, LoadingState, Row, Screen, Section, Toggle } from '@/components/ui';
import { useAction, useGatewayQuery, useHttp } from '@/lib/gateway';

export default function CronJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const http = useHttp();
  const job = useGatewayQuery(() => getCronJob(http, id), [http, id]);

  if (!job.data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cron job' }} />
        <Screen>
          {job.error ? <ErrorState message={job.error} onRetry={job.refetch} /> : <LoadingState label="Loading job" />}
        </Screen>
      </>
    );
  }

  return <CronEditor key={job.data.id} job={job.data} loadError={job.error} onChanged={job.refetch} />;
}

function valuesOf(job: CronJob): CronValues {
  return {
    name: job.name,
    prompt: job.prompt,
    schedule: job.schedule || job.scheduleLabel,
    deliver: job.deliver,
  };
}

function sameValues(a: CronValues, b: CronValues): boolean {
  return a.name === b.name && a.prompt === b.prompt && a.schedule === b.schedule && a.deliver === b.deliver;
}

type EditorProps = {
  job: CronJob;
  loadError: string | null;
  onChanged: () => void;
};

// The editor for one job. The form starts from the server copy, and Save sends only this screen's fields.
function CronEditor({ job, loadError, onChanged }: EditorProps) {
  const http = useHttp();
  const targets = useGatewayQuery(() => listDeliveryTargets(http), [http]);
  const runs = useGatewayQuery(() => listCronRuns(http, job), [http, job.id, job.profile], { pollMs: 30_000 });
  const [values, setValues] = useState<CronValues>(() => valuesOf(job));
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = useAction(async (payload: CronValues) => {
    await updateCronJob(http, job, payload);
    return true;
  });
  const toggle = useAction(async (enabled: boolean) => {
    await setCronJobEnabled(http, job, enabled);
    return true;
  });
  const trigger = useAction(async () => {
    await triggerCronJob(http, job);
    return true;
  });
  const remove = useAction(async () => {
    await deleteCronJob(http, job);
    return true;
  });

  const dirty = !sameValues(values, valuesOf(job));
  const runList = runs.data ?? [];

  function edit(next: CronValues) {
    setSaved(false);
    setValues(next);
  }

  async function onSave() {
    const payload: CronValues = {
      name: values.name.trim(),
      prompt: values.prompt.trim(),
      schedule: values.schedule.trim(),
      deliver: values.deliver,
    };
    if (!payload.name) {
      setProblem('Give the job a name.');
      return;
    }
    if (!payload.prompt) {
      setProblem('Add a prompt for the agent.');
      return;
    }
    if (!payload.schedule) {
      setProblem('Set a schedule.');
      return;
    }
    setProblem(null);
    const ok = await save.run(payload);
    if (ok) {
      setSaved(true);
      onChanged();
    }
  }

  async function onToggle(enabled: boolean) {
    const ok = await toggle.run(enabled);
    if (ok) onChanged();
  }

  async function onRunNow() {
    setNote(null);
    const ok = await trigger.run();
    if (ok) {
      setNote('Run requested. Results appear below when the run finishes.');
      runs.refetch();
    }
  }

  function onDelete() {
    confirmFirst(
      'Delete this job?',
      `"${job.name}" will stop running. This cannot be undone.`,
      'Delete',
      () => {
        void remove.run().then((ok) => {
          if (ok) router.back();
        });
      },
      true,
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: job.name }} />
      <Screen>
        {loadError ? <InlineNotice tone="danger">{loadError}</InlineNotice> : null}

        <Section>
          <Row
            title="Enabled"
            subtitle={job.enabled ? `Next run: ${formatWhen(job.nextRunAt, 'not scheduled')}` : 'Paused. It will not run until resumed.'}
            right={
              <Toggle label={`Enabled: ${job.name}`} value={job.enabled} onValueChange={(next) => void onToggle(next)} disabled={toggle.pending} />
            }
            last
          />
        </Section>
        {toggle.error ? <InlineNotice tone="danger">{toggle.error}</InlineNotice> : null}

        <CronForm values={values} onChange={edit} targets={targets.data} targetsError={targets.error} />
        {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
        {save.error ? <InlineNotice tone="danger">{save.error}</InlineNotice> : null}
        {saved ? <InlineNotice tone="info">Saved.</InlineNotice> : null}
        <Button label="Save changes" onPress={() => void onSave()} disabled={!dirty} loading={save.pending} />

        <Section label="Recent runs">
          {runs.error && !runs.data ? <Row title={runs.error} destructive last /> : null}
          {!runs.data && !runs.error ? <Row title="Loading runs" last /> : null}
          {runs.data && runs.data.length === 0 ? <Row title="No runs yet" subtitle="Runs appear here after the job fires." last /> : null}
          {runList.map((run, index) => (
            <Row
              key={`${run.id}-${index}`}
              title={formatWhen(run.startedAt, 'Start time unknown')}
              subtitle={run.error ?? (run.finishedAt ? `Finished ${formatWhen(run.finishedAt)}` : undefined)}
              right={<Badge label={labelFor(run.status, 'Unknown')} tone={toneFor(run.status)} />}
              last={index === runList.length - 1}
            />
          ))}
        </Section>
        {runs.error && runs.data ? <InlineNotice tone="danger">{runs.error}</InlineNotice> : null}

        {note ? <InlineNotice tone="info">{note}</InlineNotice> : null}
        {trigger.error ? <InlineNotice tone="danger">{trigger.error}</InlineNotice> : null}
        <Section label="Actions">
          <Row title="Run now" subtitle="Starts this job once." onPress={() => void onRunNow()} disabled={trigger.pending} />
          <Row title="Delete job" destructive onPress={onDelete} disabled={remove.pending} last />
        </Section>
      </Screen>
    </>
  );
}
