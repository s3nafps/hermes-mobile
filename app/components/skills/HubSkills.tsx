import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireHttp } from '@/components/bots/shared';
import { confirmAction } from '@/components/control/confirm';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  LoadingState,
  Row,
  Section,
} from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { installHubSkill, searchHub, updateHubSkills } from './api';
import type { HubSkill } from './types';

// Search the skill hub, install from it, and update the skills already installed from it.
export function HubSkills() {
  const { http } = useGateway();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const results = useGatewayQuery<HubSkill[]>(
    query ? async () => searchHub(requireHttp(http), query) : null,
    [http, query],
  );

  const install = useAction(async (skill: HubSkill) => {
    await installHubSkill(requireHttp(http), skill.identifier);
    return skill.name;
  });
  const update = useAction(async () => {
    await updateHubSkills(requireHttp(http));
    return true;
  });

  const submit = () => setQuery(text.trim());

  const onInstall = (skill: HubSkill) =>
    confirmAction({
      title: `Install ${skill.name}?`,
      body: 'Hub skills are written by others. Check the source before you install one.',
      action: 'Install',
      onConfirm: async () => {
        if (await install.run(skill)) results.refetch();
      },
    });

  const onUpdate = async () => {
    if (await update.run()) results.refetch();
  };

  const data = results.data;

  return (
    <>
      <View style={styles.search}>
        <Field
          label="Search the hub"
          value={text}
          onChangeText={setText}
          placeholder="For example, git or deploy"
          returnKeyType="search"
          onSubmitEditing={submit}
        />
        <Button label="Search" compact onPress={submit} disabled={!text.trim()} />
      </View>

      {!query ? (
        <EmptyState title="Search the hub" body="Find skills from the hub sources this gateway uses." />
      ) : null}
      {results.loading && !data ? <LoadingState label="Searching…" /> : null}
      {results.error ? <ErrorState message={results.error} onRetry={results.refetch} /> : null}
      {install.error ? <InlineNotice tone="danger">{install.error}</InlineNotice> : null}
      {data && data.length === 0 ? <EmptyState title="No skills found" body="Try a different word." /> : null}

      {data && data.length > 0 ? (
        <Section label={`Results (${data.length})`}>
          {data.map((skill, index) => (
            <Row
              key={skill.identifier}
              title={skill.name}
              subtitle={[skill.description, skill.source].filter(Boolean).join(' · ') || undefined}
              value={skill.trust ?? undefined}
              last={index === data.length - 1}
              right={
                skill.installed ? (
                  <Badge label="Installed" tone="done" />
                ) : (
                  <Button
                    label="Install"
                    variant="secondary"
                    compact
                    loading={install.pending}
                    onPress={() => onInstall(skill)}
                  />
                )
              }
            />
          ))}
        </Section>
      ) : null}

      <Section label="Updates">
        <View style={styles.updateRow}>
          {update.error ? <InlineNotice tone="danger">{update.error}</InlineNotice> : null}
          <Button
            label="Update hub skills"
            variant="secondary"
            onPress={() => void onUpdate()}
            loading={update.pending}
          />
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  search: { gap: 10 },
  updateRow: { padding: 14, gap: 10 },
});
