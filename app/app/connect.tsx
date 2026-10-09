import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useGateway } from '@/lib/gateway';
import { isPlainHttpRisky } from '@/lib/gateway/http';
import { useAction } from '@/lib/gateway/hooks';
import { tokens } from '@/constants/tokens';
import { Button, Card, Field, InlineNotice, Row, Screen, Section } from '@/components/ui';

// Entry point when no gateway is connected or the gateway needs a sign-in.
export default function ConnectScreen() {
  const gateway = useGateway();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const add = useAction(gateway.addGateway);
  const signIn = useAction(gateway.signIn);

  // Once the gateway is online, the root gate moves the user into the app.
  useEffect(() => {
    if (gateway.phase === 'online') router.replace('/(tabs)');
  }, [gateway.phase]);

  const passwordProvider = gateway.authProviders.find((p) => p.supports_password);
  const needsSignIn = gateway.phase === 'signed_out';
  const plainHttp = gateway.activeProfile ? isPlainHttpRisky(gateway.activeProfile.baseUrl) : false;
  const busy = gateway.phase === 'connecting' || add.pending || signIn.pending;

  const onAdd = async () => {
    if (!address.trim()) {
      Alert.alert('Gateway address', 'Enter the address of your Hermes gateway.');
      return;
    }
    await add.run(name, address);
  };

  const sendSignIn = async (provider: string) => {
    await signIn.run(provider, username.trim(), password);
    setPassword('');
  };

  const onSignIn = async () => {
    if (!passwordProvider) return;
    if (!username.trim() || !password) {
      Alert.alert('Sign in', 'Enter your username and password.');
      return;
    }
    if (plainHttp) {
      // A password over plain http can be read by other devices on the network, so ask first.
      Alert.alert(
        'Send password unencrypted?',
        'This address uses plain http. Other devices on the same network could read your password. Use an https address or Tailscale instead.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send anyway', style: 'destructive', onPress: () => void sendSignIn(passwordProvider.name) },
        ],
      );
      return;
    }
    await sendSignIn(passwordProvider.name);
  };

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 24 }}>
        <Text style={{ color: tokens.text, fontSize: 30, fontWeight: '600' }}>Hermes</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 15 }}>Your agents, in your pocket.</Text>
      </View>

      {gateway.phase === 'connecting' ? (
        <InlineNotice tone="info">Connecting to {gateway.activeProfile?.name ?? 'the gateway'}…</InlineNotice>
      ) : null}

      {gateway.phase === 'error' && gateway.error ? (
        <Card tone="danger" style={{ gap: 10 }}>
          <Text style={{ color: tokens.text, fontSize: 14, lineHeight: 20 }}>{gateway.error}</Text>
          <Button label="Try again" variant="secondary" compact onPress={() => void gateway.connect()} />
        </Card>
      ) : null}

      {needsSignIn ? (
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.text, fontSize: 17, fontWeight: '600' }}>Sign in to {gateway.activeProfile?.name}</Text>
          {passwordProvider ? (
            <>
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoComplete="username"
                textContentType="username"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
              {signIn.error ? <InlineNotice tone="danger">{signIn.error}</InlineNotice> : null}
              {plainHttp ? (
                <InlineNotice tone="warning">
                  This address is not encrypted. Anything typed here can be read on the network. Use Tailscale or an https address.
                </InlineNotice>
              ) : null}
              <Button label="Sign in" onPress={onSignIn} loading={signIn.pending} disabled={busy} />
            </>
          ) : (
            <InlineNotice tone="warning">
              This gateway only accepts browser sign-in. Sign in from a browser on the gateway&apos;s address, then try again.
            </InlineNotice>
          )}
        </Card>
      ) : null}

      {!needsSignIn && gateway.phase !== 'connecting' ? (
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.text, fontSize: 17, fontWeight: '600' }}>
            {gateway.profiles.length ? 'Add another gateway' : 'Connect to a gateway'}
          </Text>
          <Text style={{ color: tokens.textMuted, fontSize: 13, lineHeight: 19 }}>
            Enter the address of the machine running Hermes. Use a trusted network or VPN such as Tailscale.
          </Text>
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
          <Button label="Connect" onPress={onAdd} loading={add.pending} disabled={busy} />
        </Card>
      ) : null}

      {gateway.profiles.length > 0 && gateway.phase !== 'connecting' ? (
        <Section label="Saved gateways">
          {gateway.profiles.map((profile, index) => (
            <Row
              key={profile.id}
              title={profile.name}
              subtitle={profile.baseUrl}
              last={index === gateway.profiles.length - 1}
              onPress={() => void gateway.selectGateway(profile.id)}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
