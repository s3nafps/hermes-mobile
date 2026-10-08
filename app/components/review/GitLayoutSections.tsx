import { Badge, Row, Section } from '@/components/ui';

import type { GitLayout } from './types';

// Worktrees and local branches of the repository. Read only.
export function GitLayoutSections({ layout }: { layout: GitLayout }) {
  const { worktrees, branches } = layout;
  return (
    <>
      <Section label="Worktrees">
        {worktrees.length === 0 ? <Row title="No worktrees found" last /> : null}
        {worktrees.map((tree, index) => (
          <Row
            key={tree.path}
            title={tree.branch ?? (tree.detached ? 'Detached HEAD' : 'No branch')}
            subtitle={tree.path}
            right={
              tree.isMain ? (
                <Badge label="Main" tone="accent" />
              ) : tree.locked ? (
                <Badge label="Locked" />
              ) : undefined
            }
            last={index === worktrees.length - 1}
          />
        ))}
      </Section>
      <Section label="Branches">
        {branches.length === 0 ? <Row title="No local branches found" last /> : null}
        {branches.map((branch, index) => (
          <Row
            key={branch.name}
            title={branch.name}
            subtitle={branch.worktreePath ?? undefined}
            right={
              branch.checkedOut ? (
                <Badge label="Checked out" tone="done" />
              ) : branch.isDefault ? (
                <Badge label="Default" tone="info" />
              ) : undefined
            }
            last={index === branches.length - 1}
          />
        ))}
      </Section>
    </>
  );
}
