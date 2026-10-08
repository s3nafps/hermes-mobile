import { Stack } from 'expo-router';
import { useState } from 'react';

import { McpPanel } from '@/components/tools/McpPanel';
import { ToolsetsPanel } from '@/components/tools/ToolsetsPanel';
import { Screen, ScreenTitle, Segmented } from '@/components/ui';

type Tab = 'mcp' | 'toolsets';

const TABS: { value: Tab; label: string }[] = [
  { value: 'mcp', label: 'MCP' },
  { value: 'toolsets', label: 'Toolsets' },
];

// MCP servers add tools from outside. Toolsets switch the built-in tools on and off.
export default function ToolsScreen() {
  const [tab, setTab] = useState<Tab>('mcp');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Tools and MCP' }} />
      <ScreenTitle title="Tools and MCP" subtitle="MCP servers add tools. Toolsets switch built-in tools on or off." />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'mcp' ? <McpPanel /> : <ToolsetsPanel />}
    </Screen>
  );
}
