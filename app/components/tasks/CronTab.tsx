import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ErrorState, InlineNotice, LoadingState } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { messageOf, useGatewayQuery, useHttp } from '@/lib/gateway';

import { confirmFirst } from './format';
import { CronJobCard } from './CronJobCard';
import { deleteCronJob, listCronJobs, listDeliveryTargets, setCronJobEnabled, triggerCronJob } from './api';
import { cronJobHref, cronNewHref } from './routes';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import type { CronJob } from './types';
import { themed } from '@/lib/theme';

type Notice = { tone: 'info' | 'danger'; text: string };

// The Cron tab: every job from the gateway, with the controls that act on it.
export function CronTab() {
  const http = useHttp();
  const jobs = useGatewayQuery(() => listCronJobs(http), [http], { pollMs: 30_000 });
  const targets = useGatewayQuery(() => listDeliveryTargets(http), [http]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useRefetchOnFocus(jobs.refetch);

  // Runs one write for a job, then reloads the list so the screen shows server state.
  async function act(job: CronJob, work: () => Promise<void>, done?: string) {
    setBusyId(job.id);
    setNotice(null);
    try {
      await work();
      if (done) setNotice({ tone: 'info', text: done });
    } catch (caught) {
      setNotice({ tone: 'danger', text: messageOf(caught) });
    } finally {
      setBusyId(null);
      jobs.refetch();
    }
  }

  function setEnabled(job: CronJob, enabled: boolean) {
    jobs.setData((jobs.data ?? []).map((item) => (item.id === job.id ? { ...item, enabled } : item)));
    void act(job, () => setCronJobEnabled(http, job, enabled));
  }

  function remove(job: CronJob) {
    confirmFirst(
      'Delete this job?',
      `"${job.name}" will stop running. This cannot be undone.`,
      'Delete',
      () => void act(job, () => deleteCronJob(http, job), `Deleted ${job.name}.`),
      true,
    );
  }

  function deliverLabel(deliver: string): string {
    return targets.data?.find((target) => target.value === deliver)?.label ?? deliver;
  }

  return (
    <View style={styles.list}>
      <View style={styles.actions}>
        <Button label="New job" compact onPress={() => router.push(cronNewHref())} />
      </View>
      {notice ? <InlineNotice tone={notice.tone === 'danger' ? 'danger' : 'info'}>{notice.text}</InlineNotice> : null}
      {jobs.error && !jobs.data ? <ErrorState message={jobs.error} onRetry={jobs.refetch} /> : null}
      {jobs.error && jobs.data ? <InlineNotice tone="danger">{jobs.error}</InlineNotice> : null}
      {!jobs.data && !jobs.error ? <LoadingState label="Loading cron jobs" /> : null}
      {jobs.data && jobs.data.length === 0 ? (
        <EmptyState
          title="No cron jobs yet"
          body="A job runs a prompt on a schedule and sends the result where you choose."
          action={<Button label="New job" onPress={() => router.push(cronNewHref())} />}
        />
      ) : null}
      {jobs.data?.map((job) => (
        <CronJobCard
          key={job.id}
          job={job}
          deliverLabel={deliverLabel(job.deliver)}
          busy={busyId === job.id}
          onOpen={() => router.push(cronJobHref(job.id))}
          onToggle={(enabled) => setEnabled(job, enabled)}
          onRunNow={() => void act(job, () => triggerCronJob(http, job), `Started ${job.name}.`)}
          onDelete={() => remove(job)}
        />
      ))}
      {targets.error ? <Text style={styles.hint}>Delivery names could not be loaded.</Text> : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  list: { gap: 12 },
  actions: { flexDirection: 'row' },
  hint: { color: tokens.textMuted, fontSize: 13 },
}));
