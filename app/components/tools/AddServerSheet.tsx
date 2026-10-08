import { useState } from 'react';
import { View } from 'react-native';

import { requireHttp } from '@/components/bots/shared';
import { Button, Field, InlineNotice, Segmented, Sheet } from '@/components/ui';
import { useAction, useGateway } from '@/lib/gateway';

import { addServer } from './api';

type Transport = 'url' | 'command';

const TRANSPORTS: { value: Transport; label: string }[] = [
  { value: 'url', label: 'Web address' },
  { value: 'command', label: 'Command' },
];

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
};

// Adds an MCP server by web address (with an optional bearer token) or by a local command.
export function AddServerSheet({ visible, onClose, onAdded }: Props) {
  const { http } = useGateway();
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<Transport>('url');
  const [address, setAddress] = useState('');
  const [args, setArgs] = useState('');
  const [token, setToken] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = useAction(async () => {
    const trimmed = name.trim();
    const target = address.trim();
    await addServer(requireHttp(http), {
      name: trimmed,
      url: transport === 'url' ? target : null,
      command: transport === 'command' ? target : null,
      args: transport === 'command' ? args.trim().split(/\s+/).filter(Boolean) : [],
      bearerToken: transport === 'url' && token.trim() ? token.trim() : null,
    });
    return trimmed;
  });

  const reset = () => {
    setName('');
    setAddress('');
    setArgs('');
    setToken('');
    setProblem(null);
    setTransport('url');
  };

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async () => {
    if (!NAME_PATTERN.test(name.trim())) {
      setProblem('Use letters, numbers, dashes or underscores for the name.');
      return;
    }
    setProblem(null);
    const added = await add.run();
    if (added === undefined) return;
    reset();
    onAdded();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Add MCP server">
      <View style={{ gap: 12 }}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="For example, docs"
          maxLength={64}
        />
        <Segmented options={TRANSPORTS} value={transport} onChange={setTransport} />
        <Field
          label={transport === 'url' ? 'Web address' : 'Command'}
          value={address}
          onChangeText={setAddress}
          placeholder={transport === 'url' ? 'https://' : 'npx'}
          keyboardType={transport === 'url' ? 'url' : 'default'}
        />
        {transport === 'command' ? (
          <Field
            label="Arguments (space separated)"
            value={args}
            onChangeText={setArgs}
            placeholder="-y some-mcp-server"
          />
        ) : (
          <Field
            label="Bearer token (optional)"
            value={token}
            onChangeText={setToken}
            secureTextEntry
            placeholder="Leave blank if the server needs none"
          />
        )}
        {problem ? <InlineNotice tone="danger">{problem}</InlineNotice> : null}
        {add.error ? <InlineNotice tone="danger">{add.error}</InlineNotice> : null}
        <Button
          label="Add server"
          onPress={() => void onSubmit()}
          disabled={!name.trim() || !address.trim()}
          loading={add.pending}
        />
      </View>
    </Sheet>
  );
}
