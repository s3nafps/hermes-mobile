import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';

import { Badge, Button, Card, EmptyState, Field, InlineNotice, Row, Screen, ScreenTitle, Section } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { useAction, useGateway } from '@/lib/gateway';

// Saved gateways. Switching reconnects the app, so the root gate may move the user to the connect screen.
export default function GatewaysScreen() {
  const { profiles, activeProfile, addGateway, selectGateway, removeGateway } = useGateway();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const add = useAction(addGateway);
  const select = useAction(selectGateway);
  const remove = useAction(removeGateway);

  const onAdd = async () => {
    if (!address.trim()) {
      Alert.alert('Gateway address', 'Enter the address of your Hermes gateway.');
      return;
    }
    // A successful add makes the new gateway active, so the root gate moves the user on.
    await add.run(name, address);
  };

  const confirmRemove = (id: string, label: string, isActive: boolean) => {
    Alert.alert(
      `Remove ${label}?`,
      isActive
        ? 'This is the active gateway. The phone disconnects from it. The gateway itself is not changed.'
        : 'The gateway is removed from this phone only. The gateway itself is not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void remove.run(id);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Gateways' }} />
      <ScreenTitle title="Gateways" subtitle="Switch between saved Hermes gateways." />

      {select.error ? <InlineNotice tone="danger">{select.error}</InlineNotice> : null}
      {remove.error ? <InlineNotice tone="danger">{remove.error}</InlineNotice> : null}

      {profiles.length === 0 ? (
        <EmptyState title="No gateways saved" body="Add a gateway below to connect." />
      ) : (
        <Section label="Saved">
          {profiles.map((profile, index) => {
            const isActive = profile.id === activeProfile?.id;
            return (
              <Row
                key={profile.id}
                title={profile.name}
                subtitle={profile.baseUrl}
                last={index === profiles.length - 1}
                onPress={isActive ? undefined : () => void select.run(profile.id)}
                right={
                  <>
                    {isActive ? <Badge label="Active" tone="running" /> : null}
                    <Button
                      label="Remove"
                      variant="danger"
                      compact
                      disabled={select.pending || remove.pending}
                      onPress={() => confirmRemove(profile.id, profile.name, isActive)}
                    />
                  </>
                }
              />
            );
          })}
        </Section>
      )}

      <Card style={{ gap: 14 }}>
        <Text style={styles.cardTitle}>Add a gateway</Text>
        <Field label="Name (optional)" value={name} onChangeText={setName} placeholder="Home server" />
        <Field
          label="Gateway address"
          value={address}
          onChangeText={setAddress}
          placeholder="https://hermes.your-tailnet.ts.net"
          keyboardType="url"
          autoComplete="off"
        />
        {add.error ? <InlineNotice tone="danger">{add.error}</InlineNotice> : null}
        <Button label="Connect" onPress={onAdd} loading={add.pending} disabled={add.pending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: tokens.text, fontSize: 17, fontWeight: '600' },
});
