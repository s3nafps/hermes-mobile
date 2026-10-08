import { unwrap, type GatewayHttp } from '@/lib/gateway';

import {
  itemOf,
  listOf,
  toAssignees,
  toAttachments,
  toBlueprints,
  toBoards,
  toColumns,
  toCronJob,
  toCronRun,
  toDeliveryTargets,
  toTaskDetail,
  toWorkerLog,
} from './normalize';
import type {
  Assignee,
  Blueprint,
  CronJob,
  CronRun,
  CronValues,
  DeliveryTarget,
  KanbanAttachment,
  KanbanBoardInfo,
  KanbanColumn,
  KanbanTaskDetail,
  TaskPatch,
  WorkerLog,
} from './types';

// Every call below reads its JSON through a normalizer in normalize.ts. The
// Cron and Kanban responses are untyped in the generated schema, so the
// normalizers are the only place that knows their field names. Field names
// and request bodies follow the dashboard's own client code.

const AUTHOR = 'mobile';
// The dashboard lists jobs from every profile, and writes to the job's own profile.
const ALL_PROFILES = 'all';
const DEFAULT_PROFILE = 'default';

// ---- Cron ------------------------------------------------------------------

export async function listCronJobs(http: GatewayHttp): Promise<CronJob[]> {
  const raw = unwrap(await http.GET('/api/cron/jobs', { params: { query: { profile: ALL_PROFILES } } }));
  return listOf(raw, 'jobs').map(toCronJob);
}

// The dashboard has no single-job read, so the editor finds the job in the full list.
export async function getCronJob(http: GatewayHttp, id: string): Promise<CronJob> {
  const found = (await listCronJobs(http)).find((job) => job.id === id);
  if (!found) throw new Error('This job no longer exists.');
  return found;
}

export async function listCronRuns(http: GatewayHttp, job: CronJob): Promise<CronRun[]> {
  const raw = unwrap(
    await http.GET('/api/cron/jobs/{job_id}/runs', {
      params: { path: { job_id: job.id }, query: { profile: job.profile, limit: 10 } },
    }),
  );
  return listOf(raw, 'runs').map(toCronRun);
}

export async function setCronJobEnabled(http: GatewayHttp, job: CronJob, enabled: boolean): Promise<void> {
  const params = { params: { path: { job_id: job.id }, query: { profile: job.profile } } };
  if (enabled) {
    unwrap(await http.POST('/api/cron/jobs/{job_id}/resume', params));
  } else {
    unwrap(await http.POST('/api/cron/jobs/{job_id}/pause', params));
  }
}

export async function triggerCronJob(http: GatewayHttp, job: CronJob): Promise<void> {
  unwrap(
    await http.POST('/api/cron/jobs/{job_id}/trigger', {
      params: { path: { job_id: job.id }, query: { profile: job.profile } },
    }),
  );
}

export async function deleteCronJob(http: GatewayHttp, job: CronJob): Promise<void> {
  unwrap(
    await http.DELETE('/api/cron/jobs/{job_id}', {
      params: { path: { job_id: job.id }, query: { profile: job.profile } },
    }),
  );
}

export async function createCronJob(http: GatewayHttp, values: CronValues): Promise<void> {
  unwrap(
    await http.POST('/api/cron/jobs', {
      params: { query: { profile: DEFAULT_PROFILE } },
      body: { ...values, no_agent: false },
    }),
  );
}

// The body is {updates}, and only the fields on this screen are sent.
export async function updateCronJob(http: GatewayHttp, job: CronJob, values: CronValues): Promise<void> {
  unwrap(
    await http.PUT('/api/cron/jobs/{job_id}', {
      params: { path: { job_id: job.id }, query: { profile: job.profile } },
      body: { updates: { ...values } },
    }),
  );
}

export async function listDeliveryTargets(http: GatewayHttp): Promise<DeliveryTarget[]> {
  return toDeliveryTargets(unwrap(await http.GET('/api/cron/delivery-targets')));
}

export async function listBlueprints(http: GatewayHttp): Promise<Blueprint[]> {
  return toBlueprints(unwrap(await http.GET('/api/cron/blueprints')));
}

// ---- Kanban board ----------------------------------------------------------

export async function listBoards(http: GatewayHttp): Promise<KanbanBoardInfo[]> {
  return toBoards(unwrap(await http.GET('/api/plugins/kanban/boards')));
}

// A null board means the server's current board.
export async function getBoard(http: GatewayHttp, board: string | null): Promise<KanbanColumn[]> {
  return toColumns(unwrap(await http.GET('/api/plugins/kanban/board', { params: { query: { board } } })));
}

export async function dispatchBoard(http: GatewayHttp, board: string | null): Promise<void> {
  unwrap(await http.POST('/api/plugins/kanban/dispatch', { params: { query: { board } } }));
}

export async function listAssignees(http: GatewayHttp): Promise<Assignee[]> {
  return toAssignees(unwrap(await http.GET('/api/plugins/kanban/assignees')));
}

export type NewTask = {
  title: string;
  body: string | null;
  assignee: string | null;
  priority: number;
};

export async function createTask(http: GatewayHttp, board: string | null, task: NewTask): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks', {
      params: { query: { board } },
      body: { ...task, workspace_kind: 'scratch', triage: false, goal_mode: false },
    }),
  );
}

// ---- Kanban task -----------------------------------------------------------

export async function getTask(http: GatewayHttp, id: string, board: string | null): Promise<KanbanTaskDetail> {
  const raw = unwrap(
    await http.GET('/api/plugins/kanban/tasks/{task_id}', { params: { path: { task_id: id }, query: { board } } }),
  );
  return toTaskDetail(raw);
}

export async function updateTask(http: GatewayHttp, id: string, board: string | null, patch: TaskPatch): Promise<void> {
  unwrap(
    await http.PATCH('/api/plugins/kanban/tasks/{task_id}', {
      params: { path: { task_id: id }, query: { board } },
      body: patch,
    }),
  );
}

export async function addComment(http: GatewayHttp, id: string, board: string | null, body: string): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks/{task_id}/comments', {
      params: { path: { task_id: id }, query: { board } },
      body: { body, author: AUTHOR },
    }),
  );
}

export async function listAttachments(
  http: GatewayHttp,
  id: string,
  board: string | null,
): Promise<KanbanAttachment[]> {
  const raw = unwrap(
    await http.GET('/api/plugins/kanban/tasks/{task_id}/attachments', {
      params: { path: { task_id: id }, query: { board } },
    }),
  );
  return toAttachments(raw);
}

export async function getTaskLog(http: GatewayHttp, id: string, board: string | null): Promise<WorkerLog> {
  const raw = unwrap(
    await http.GET('/api/plugins/kanban/tasks/{task_id}/log', {
      params: { path: { task_id: id }, query: { board, tail: 2000 } },
    }),
  );
  return toWorkerLog(itemOf(raw, 'log'));
}

export async function addLink(http: GatewayHttp, board: string | null, parentId: string, childId: string): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/links', {
      params: { query: { board } },
      body: { parent_id: parentId, child_id: childId },
    }),
  );
}

export async function removeLink(http: GatewayHttp, board: string | null, parentId: string, childId: string): Promise<void> {
  unwrap(
    await http.DELETE('/api/plugins/kanban/links', {
      params: { query: { board, parent_id: parentId, child_id: childId } },
    }),
  );
}

export async function reclaimTask(http: GatewayHttp, id: string, board: string | null, reason: string | null): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks/{task_id}/reclaim', {
      params: { path: { task_id: id }, query: { board } },
      body: { reason },
    }),
  );
}

export async function specifyTask(http: GatewayHttp, id: string, board: string | null): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks/{task_id}/specify', {
      params: { path: { task_id: id }, query: { board } },
      body: { author: AUTHOR },
    }),
  );
}

export async function decomposeTask(http: GatewayHttp, id: string, board: string | null): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks/{task_id}/decompose', {
      params: { path: { task_id: id }, query: { board } },
      body: { author: AUTHOR },
    }),
  );
}

export async function reassignTask(
  http: GatewayHttp,
  id: string,
  board: string | null,
  profile: string,
  reclaimFirst: boolean,
): Promise<void> {
  unwrap(
    await http.POST('/api/plugins/kanban/tasks/{task_id}/reassign', {
      params: { path: { task_id: id }, query: { board } },
      body: { profile, reclaim_first: reclaimFirst, reason: null },
    }),
  );
}
