// Hand-typed shapes for the git endpoints. schema.ts types every git response as
// `unknown`, so these follow the server source (hermes_cli/web_git.py in hermes-agent 0.19.0).
// Not checked against a running gateway.

export type ReviewScope = 'uncommitted' | 'branch';

// GET /api/git/status. The server returns null when the folder is not a git repository.
export type RepoStatus = {
  branch: string | null;
  defaultBranch: string | null;
  detached: boolean;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
  changed: number;
  added: number;
  removed: number;
};

export type ReviewFile = {
  path: string;
  added: number;
  removed: number;
  // Porcelain letter: M modified, A added, D deleted, R renamed, ? untracked, U conflicted.
  status: string;
  staged: boolean;
};

// GET /api/git/review/list
export type ReviewList = {
  files: ReviewFile[];
  base: string | null;
};

export type Worktree = {
  path: string;
  branch: string | null;
  isMain: boolean;
  detached: boolean;
  locked: boolean;
};

export type GitBranch = {
  name: string;
  checkedOut: boolean;
  isDefault: boolean;
  worktreePath: string | null;
};

export type GitLayout = {
  worktrees: Worktree[];
  branches: GitBranch[];
};
