// Shapes the Tasks screens read. The cron and Kanban endpoints return untyped
// JSON (their response is {} in the generated schema), so these types describe
// what the screens need. normalize.ts fills them from whatever the server sends.

export type CronJob = {
  id: string;
  // Jobs belong to a profile. Every call on a job must name that profile.
  profile: string;
  name: string;
  prompt: string;
  // The expression sent back on save.
  schedule: string;
  // The human form shown on the card.
  scheduleLabel: string;
  deliver: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};

export type CronValues = {
  name: string;
  prompt: string;
  schedule: string;
  deliver: string;
};

export type CronRun = {
  id: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string | null;
  error: string | null;
};

export type DeliveryTarget = {
  value: string;
  label: string;
  homeTargetSet: boolean;
};

export type Blueprint = {
  id: string;
  name: string;
  description: string | null;
  prefill: Partial<{ [K in keyof CronValues]: string | null }>;
};

export type KanbanTask = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  assignee: string | null;
  priority: number;
  commentCount: number;
};

export type KanbanColumn = {
  name: string;
  tasks: KanbanTask[];
};

export type KanbanBoardInfo = {
  slug: string;
  name: string;
  current: boolean;
};

export type KanbanComment = {
  id: string;
  author: string | null;
  body: string;
  createdAt: string | null;
};

export type KanbanRef = {
  id: string;
  title: string | null;
};

export type KanbanTaskDetail = KanbanTask & {
  blockReason: string | null;
  result: string | null;
  createdAt: string | null;
  completedAt: string | null;
  comments: KanbanComment[];
  parents: KanbanRef[];
  children: KanbanRef[];
};

// GET .../log returns the worker's log file, not an event list.
export type WorkerLog = {
  text: string;
  sizeBytes: number | null;
  truncated: boolean;
};

export type KanbanAttachment = {
  id: string;
  name: string;
  size: number | null;
};

export type Assignee = {
  name: string;
  taskCount: number | null;
};

export type TaskPatch = {
  status?: string;
  assignee?: string | null;
  priority?: number;
  title?: string;
  body?: string | null;
  // Marking a task done stores its completion summary as the result.
  result?: string | null;
  summary?: string | null;
};
