import type {
  Assignee,
  Blueprint,
  CronJob,
  CronRun,
  DeliveryTarget,
  KanbanAttachment,
  KanbanBoardInfo,
  KanbanColumn,
  KanbanComment,
  KanbanRef,
  KanbanTask,
  KanbanTaskDetail,
  WorkerLog,
} from './types';

// Reads the untyped Cron and Kanban JSON. Each reader accepts a bare value or
// the common wrapper (for example {jobs: []}), and skips anything it cannot
// read, so one odd field shows as a blank instead of crashing the screen.

type Raw = Record<string, unknown>;

export function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function listOf(raw: unknown, key: string): Raw[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) ? raw[key] : undefined;
  return Array.isArray(list) ? list.filter(isRecord) : [];
}

export function itemOf(raw: unknown, key: string): Raw {
  if (isRecord(raw) && isRecord(raw[key])) return raw[key];
  return isRecord(raw) ? raw : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// The gateway's own forms: "every 2h", "every 30m", "every 1d", "0 9 * * *",
// or a one-time "YYYY-MM-DDTHH:MM". Saving sends the expression back as text.
function everyExpr(minutes: number): string {
  if (minutes % 1440 === 0) return `every ${minutes / 1440}d`;
  if (minutes % 60 === 0) return `every ${minutes / 60}h`;
  return `every ${minutes}m`;
}

function scheduleParts(value: unknown): { expr: string; display: string } {
  if (typeof value === 'string') return { expr: value, display: value };
  if (!isRecord(value)) return { expr: '', display: '' };
  const kind = text(value.kind);
  const display = text(value.display) ?? '';
  let expr = text(value.expr) ?? '';
  if (!expr && kind === 'interval' && typeof value.minutes === 'number') expr = everyExpr(value.minutes);
  if (!expr && kind === 'once') expr = (text(value.run_at) ?? '').slice(0, 16);
  if (!expr) expr = display;
  return { expr, display: display || expr };
}

// Same fallback order as the dashboard: name, then the prompt, then the script, then the ID.
function jobName(raw: Raw, id: string): string {
  const name = text(raw.name)?.trim();
  if (name) return name;
  const prompt = text(raw.prompt)?.trim();
  if (prompt) return prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt;
  const script = text(raw.script)?.trim();
  if (script) return script;
  return id || 'Cron job';
}

export function toCronJob(raw: Raw): CronJob {
  const id = text(raw.id) ?? text(raw.job_id) ?? '';
  const schedule = scheduleParts(raw.schedule);
  const state = text(raw.state);
  return {
    id,
    profile: text(raw.profile) || text(raw.profile_name) || 'default',
    name: jobName(raw, id),
    prompt: text(raw.prompt) ?? '',
    schedule: schedule.expr,
    scheduleLabel: text(raw.schedule_display) ?? schedule.display,
    deliver: text(raw.deliver) ?? 'local',
    enabled: raw.enabled !== false && state !== 'paused' && state !== 'disabled',
    nextRunAt: text(raw.next_run_at),
    lastRunAt: text(raw.last_run_at),
    lastStatus: text(raw.last_status),
    lastError: text(raw.last_error),
  };
}

export function toCronRun(raw: Raw, index: number): CronRun {
  return {
    id: text(raw.id) ?? text(raw.run_id) ?? String(index),
    startedAt: text(raw.started_at) ?? text(raw.run_at),
    finishedAt: text(raw.finished_at) ?? text(raw.ended_at),
    status: text(raw.status) ?? text(raw.outcome),
    error: text(raw.error) ?? text(raw.last_error),
  };
}

export function toDeliveryTargets(raw: unknown): DeliveryTarget[] {
  return listOf(raw, 'targets').flatMap((item) => {
    const value = text(item.value) ?? text(item.id) ?? text(item.target);
    if (!value) return [];
    return [
      {
        value,
        label: text(item.label) ?? text(item.name) ?? value,
        homeTargetSet: flag(item.home_target_set, true),
      },
    ];
  });
}

export function toBlueprints(raw: unknown): Blueprint[] {
  return listOf(raw, 'blueprints').flatMap((item) => {
    const id = text(item.id) ?? text(item.key) ?? text(item.name);
    if (!id) return [];
    const source = isRecord(item.defaults) ? item.defaults : isRecord(item.prefill) ? item.prefill : {};
    return [
      {
        id,
        name: text(item.name) ?? text(item.title) ?? id,
        description: text(item.description),
        prefill: {
          name: text(source.name),
          prompt: text(source.prompt),
          schedule: text(source.schedule),
          deliver: text(source.deliver),
        },
      },
    ];
  });
}

export function toKanbanTask(raw: Raw): KanbanTask {
  return {
    id: text(raw.id) ?? text(raw.task_id) ?? '',
    title: text(raw.title) ?? 'Untitled task',
    body: text(raw.body),
    status: text(raw.status) ?? '',
    assignee: text(raw.assignee) || null,
    priority: count(raw.priority) ?? 0,
    commentCount: count(raw.comment_count) ?? 0,
  };
}

// The board is either a list of {name, tasks} or a map of status to tasks.
export function toColumns(raw: unknown): KanbanColumn[] {
  const root = isRecord(raw) && raw.columns !== undefined ? raw.columns : raw;
  if (Array.isArray(root)) {
    return root.filter(isRecord).map((column) => ({
      name: text(column.name) ?? text(column.status) ?? '',
      tasks: listOf(column.tasks, 'tasks').map(toKanbanTask),
    }));
  }
  if (isRecord(root)) {
    return Object.entries(root)
      .filter(([, tasks]) => Array.isArray(tasks))
      .map(([name, tasks]) => ({ name, tasks: listOf(tasks, 'tasks').map(toKanbanTask) }));
  }
  return [];
}

export function toBoards(raw: unknown): KanbanBoardInfo[] {
  const current = isRecord(raw) ? text(raw.current) : null;
  return listOf(raw, 'boards').flatMap((item) => {
    const slug = text(item.slug) ?? text(item.id) ?? '';
    if (!slug) return [];
    return [{ slug, name: text(item.name) ?? slug, current: flag(item.is_current, slug === current) }];
  });
}

function refsOf(value: unknown): KanbanRef[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).flatMap((item: unknown) => {
    if (typeof item === 'string') return [{ id: item, title: null }];
    if (isRecord(item)) {
      const id = text(item.id) ?? text(item.task_id) ?? text(item.parent_id) ?? text(item.child_id);
      return id ? [{ id, title: text(item.title) }] : [];
    }
    return [];
  });
}

function toComment(raw: Raw, index: number): KanbanComment {
  return {
    id: text(raw.id) ?? String(index),
    author: text(raw.author),
    body: text(raw.body) ?? '',
    createdAt: text(raw.created_at),
  };
}

export function toTaskDetail(raw: unknown): KanbanTaskDetail {
  const task = itemOf(raw, 'task');
  const root = isRecord(raw) ? raw : {};
  // The dashboard reads links as {parents: [ids], children: [ids]} under "links".
  const links = isRecord(root.links) ? root.links : {};
  return {
    ...toKanbanTask(task),
    blockReason: text(task.block_reason),
    result: text(task.result),
    createdAt: text(task.created_at),
    completedAt: text(task.completed_at),
    comments: listOf(root.comments ?? task.comments, 'comments').map(toComment),
    parents: refsOf(links.parents),
    children: refsOf(links.children),
  };
}

export function toAttachments(raw: unknown): KanbanAttachment[] {
  return listOf(raw, 'attachments').map((item, index) => ({
    id: text(item.id) ?? String(index),
    name: text(item.filename) ?? text(item.name) ?? 'Attachment',
    size: count(item.size) ?? count(item.size_bytes),
  }));
}

export function toAssignees(raw: unknown): Assignee[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) ? (raw.assignees ?? raw.profiles) : undefined;
  if (!Array.isArray(list)) return [];
  return (list as unknown[]).flatMap((item: unknown) => {
    if (typeof item === 'string') return item ? [{ name: item, taskCount: null }] : [];
    if (isRecord(item)) {
      // The id is the profile name that tasks are assigned to.
      const name = text(item.id) ?? text(item.profile) ?? text(item.name);
      return name ? [{ name, taskCount: count(item.task_count) ?? count(item.count) }] : [];
    }
    return [];
  });
}

// GET .../log returns {content, size_bytes, truncated, path}. A missing log
// comes back without content, which reads as an empty log.
export function toWorkerLog(raw: unknown): WorkerLog {
  const root = isRecord(raw) ? raw : {};
  return {
    text: text(root.content) ?? text(root.log) ?? '',
    sizeBytes: count(root.size_bytes),
    truncated: flag(root.truncated, false),
  };
}
