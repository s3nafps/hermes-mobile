import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { MONO, tokens } from '@/constants/tokens';

import { pluralize } from './format';
import type { RepoStatus } from './types';

// The branch the working folder is on, with its ahead/behind state and working tree counts.
export function BranchCard({ repo, cwd }: { repo: RepoStatus; cwd: string }) {
  const branch = repo.detached ? 'Detached HEAD' : (repo.branch ?? 'No branch');
  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.label}>Branch</Text>
      <Text style={styles.branch} numberOfLines={1}>
        {branch}
      </Text>
      <View style={styles.badges}>
        {repo.ahead > 0 ? <Badge label={`${repo.ahead} ahead`} tone="info" /> : null}
        {repo.behind > 0 ? <Badge label={`${repo.behind} behind`} tone="accent" /> : null}
        {repo.conflicted > 0 ? <Badge label={pluralize(repo.conflicted, 'conflict')} tone="danger" /> : null}
        {repo.defaultBranch ? <Badge label={`Default: ${repo.defaultBranch}`} /> : null}
      </View>
      <Text style={styles.meta}>
        {pluralize(repo.changed, 'changed file')} · {repo.staged} staged · {repo.unstaged} unstaged ·{' '}
        {repo.untracked} untracked
      </Text>
      <Text style={styles.meta}>
        +{repo.added} -{repo.removed} against the last commit
      </Text>
      <Text style={styles.folder} numberOfLines={1} ellipsizeMode="head">
        {cwd}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { color: tokens.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  branch: { color: tokens.text, fontFamily: MONO, fontSize: 18, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { color: tokens.textMuted, fontSize: 13 },
  folder: { color: tokens.textMuted, fontFamily: MONO, fontSize: 12 },
});
