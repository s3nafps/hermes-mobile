import type { Href } from 'expo-router';

// Route builders for the Tasks screens. The board travels as a query so each
// Kanban screen reads the same board the user was looking at.

function withBoard(path: string, board: string | null): Href {
  const query = board ? `?board=${encodeURIComponent(board)}` : '';
  return `${path}${query}` as Href;
}

export function cronJobHref(id: string): Href {
  return `/tasks/cron/${encodeURIComponent(id)}` as Href;
}

export function cronNewHref(): Href {
  return '/tasks/cron/new' as Href;
}

export function kanbanTaskHref(id: string, board: string | null): Href {
  return withBoard(`/tasks/kanban/${encodeURIComponent(id)}`, board);
}

export function kanbanNewHref(board: string | null): Href {
  return withBoard('/tasks/kanban/new', board);
}
