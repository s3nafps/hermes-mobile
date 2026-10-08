import { unwrap, type GatewayHttp } from '@/lib/gateway';

import type { GitLayout, RepoStatus, ReviewList, ReviewScope } from './types';

// Shared message for a screen that renders before the gateway is online.
export const NOT_CONNECTED = 'The gateway is not connected.';

type RawResult = { data?: unknown; error?: unknown; response: Response };

// schema.ts types these responses as `unknown`. The caller names the shape it expects,
// and unwrap still throws GatewayHttpError on a non-2xx reply.
export function readResult<T>(result: RawResult): T {
  return unwrap(result as { data?: T; error?: unknown; response: Response });
}

export async function fetchRepoStatus(http: GatewayHttp, cwd: string): Promise<RepoStatus | null> {
  return readResult<RepoStatus | null>(await http.GET('/api/git/status', { params: { query: { path: cwd } } }));
}

export async function fetchReviewList(http: GatewayHttp, cwd: string, scope: ReviewScope): Promise<ReviewList> {
  return readResult<ReviewList>(
    await http.GET('/api/git/review/list', { params: { query: { path: cwd, scope } } }),
  );
}

// Uncommitted changes use the HEAD diff, which covers staged, unstaged and new files.
// Branch changes diff against the base branch.
export async function fetchFileDiff(
  http: GatewayHttp,
  cwd: string,
  file: string,
  scope: ReviewScope,
): Promise<string> {
  if (scope === 'branch') {
    const result = readResult<{ diff?: string }>(
      await http.GET('/api/git/review/diff', { params: { query: { path: cwd, file, scope } } }),
    );
    return result.diff ?? '';
  }
  const result = readResult<{ diff?: string }>(
    await http.GET('/api/git/file-diff', { params: { query: { path: cwd, file } } }),
  );
  return result.diff ?? '';
}

export async function fetchLayout(http: GatewayHttp, cwd: string): Promise<GitLayout> {
  const [trees, branches] = await Promise.all([
    http.GET('/api/git/worktrees', { params: { query: { path: cwd } } }),
    http.GET('/api/git/branches', { params: { query: { path: cwd } } }),
  ]);
  return {
    worktrees: readResult<{ worktrees?: GitLayout['worktrees'] }>(trees).worktrees ?? [],
    branches: readResult<{ branches?: GitLayout['branches'] }>(branches).branches ?? [],
  };
}
