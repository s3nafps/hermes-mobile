import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Screen, ScreenTitle, StatusDot } from '@/components/ui';
import { tokens } from '@/constants/tokens';
import { initialSteps, runDiagnosis, type DiagnosisStep, type StepState } from '@/lib/gateway/diagnose';

// Test connection: runs each check in turn and shows what passed, what needs a change,
// and what to change. Opened from the connect screen with the address already filled in.
export default function DiagnoseScreen() {
  const { address = '' } = useLocalSearchParams<{ address?: string }>();
  const [steps, setSteps] = useState<DiagnosisStep[]>(initialSteps);
  const [runId, setRunId] = useState(0);
  const running = steps.some((step) => step.state === 'running');

  useEffect(() => {
    let active = true;
    void runDiagnosis(address, (next) => {
      if (active) setSteps(next);
    });
    return () => {
      active = false;
    };
  }, [address, runId]);

  return (
    <Screen>
      <ScreenTitle
        title="Test connection"
        subtitle={address || 'No address given'}
        action={<Button label="Back" variant="ghost" compact onPress={() => router.back()} />}
      />

      {steps.map((step) => (
        <StepCard key={step.id} step={step} />
      ))}

      <Button
        label={running ? 'Testing…' : 'Test again'}
        onPress={() => setRunId((value) => value + 1)}
        loading={running}
        disabled={running || !address.trim()}
      />
    </Screen>
  );
}

const LABEL: Record<StepState, string> = {
  pending: 'Waiting',
  running: 'Checking…',
  ok: 'OK',
  warn: 'Check this',
  fail: 'Failed',
  skipped: 'Skipped',
};

const TONE = {
  pending: 'neutral',
  running: 'running',
  ok: 'done',
  warn: 'accent',
  fail: 'danger',
  skipped: 'neutral',
} as const;

function StepCard({ step }: { step: DiagnosisStep }) {
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <StatusDot tone={TONE[step.state]} />
        <Text style={{ flex: 1, color: tokens.text, fontSize: 16, fontWeight: '600' }}>{step.title}</Text>
        <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{LABEL[step.state]}</Text>
      </View>
      {step.detail ? (
        <Text selectable style={{ color: tokens.textMuted, fontSize: 13, lineHeight: 19 }}>
          {step.detail}
        </Text>
      ) : null}
      {step.hint ? (
        <Text selectable style={{ color: tokens.text, fontSize: 13, lineHeight: 19 }}>
          {step.hint}
        </Text>
      ) : null}
    </Card>
  );
}
