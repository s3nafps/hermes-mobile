import { requireHttp } from '@/components/bots/shared';
import { EmptyState, ErrorState, InlineNotice, LoadingState, Row, Section, Toggle } from '@/components/ui';
import { useAction, useGateway, useGatewayQuery } from '@/lib/gateway';

import { listToolsets, setToolsetEnabled } from './api';
import type { Toolset } from './types';

// Built-in toolsets. The switch turns a whole toolset on or off for the agent.
export function ToolsetsPanel() {
  const { http } = useGateway();
  const toolsets = useGatewayQuery<Toolset[]>(async () => listToolsets(requireHttp(http)), [http]);

  const toggle = useAction(async (name: string, enabled: boolean) => {
    await setToolsetEnabled(requireHttp(http), name, enabled);
    return true;
  });

  const onToggle = async (toolset: Toolset, enabled: boolean) => {
    if (toolsets.data) {
      toolsets.setData(toolsets.data.map((item) => (item.name === toolset.name ? { ...item, enabled } : item)));
    }
    await toggle.run(toolset.name, enabled);
    // Reload either way, so a failed change shows the server's real state.
    toolsets.refetch();
  };

  const data = toolsets.data;

  return (
    <>
      {toolsets.loading && !data ? <LoadingState label="Loading toolsets…" /> : null}
      {toolsets.error && !data ? <ErrorState message={toolsets.error} onRetry={toolsets.refetch} /> : null}
      {toolsets.error && data ? <InlineNotice tone="danger">{toolsets.error}</InlineNotice> : null}
      {toggle.error ? <InlineNotice tone="danger">{toggle.error}</InlineNotice> : null}

      {data && data.length === 0 ? (
        <EmptyState title="No toolsets" body="The gateway did not list any toolsets." />
      ) : null}

      {data && data.length > 0 ? (
        <Section label={`Toolsets (${data.length})`}>
          {data.map((toolset, index) => (
            <Row
              key={toolset.name}
              title={toolset.label}
              subtitle={toolset.description ?? undefined}
              last={index === data.length - 1}
              right={
                <Toggle
                  label={`Turn ${toolset.label} ${toolset.enabled ? 'off' : 'on'}`}
                  value={toolset.enabled}
                  onValueChange={(next) => void onToggle(toolset, next)}
                />
              }
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}
