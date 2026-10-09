import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

// Shared building blocks for every screen. Keeping them in one place keeps the
// feature screens consistent with the approved design.

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomPadding?: number;
};

export function Screen({ children, scroll = true, refreshing, onRefresh, bottomPadding = 32 }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.body, { paddingBottom: bottomPadding }]}>{children}</View>
  );
  if (!scroll) {
    return <View style={[styles.fill, { paddingTop: insets.top }]}>{content}</View>;
  }
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ paddingTop: insets.top + 8 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={tokens.textMuted} />
        ) : undefined
      }>
      {content}
    </ScrollView>
  );
}

export function ScreenTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: 'default' | 'accent' | 'warning' | 'danger' }) {
  const borderColor =
    tone === 'accent' ? tokens.accent : tone === 'warning' ? tokens.accent : tone === 'danger' ? tokens.danger : tokens.line;
  return <View style={[styles.card, { borderColor }, style]}>{children}</View>;
}

export function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  last?: boolean;
  testID?: string;
};

export function Row({ title, subtitle, value, right, onPress, destructive, disabled, last, testID }: RowProps) {
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, destructive && { color: tokens.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, compact, style, testID }: ButtonProps) {
  const palette = BUTTON_PALETTE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        { opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const BUTTON_PALETTE = {
  primary: { bg: tokens.accent, fg: tokens.accentText, border: tokens.accent },
  secondary: { bg: tokens.surfaceRaised, fg: tokens.text, border: tokens.line },
  danger: { bg: 'transparent', fg: tokens.danger, border: tokens.danger },
  ghost: { bg: 'transparent', fg: tokens.accent, border: 'transparent' },
} as const;

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: tokens.accent }]}>
            <Text style={[styles.segmentLabel, { color: active ? tokens.accentText : tokens.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(active ? null : option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && { backgroundColor: tokens.accent, borderColor: tokens.accent }]}>
            <Text style={[styles.chipLabel, { color: active ? tokens.accentText : tokens.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={tokens.textMuted}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
      />
    </View>
  );
}

export function Toggle({
  value,
  onValueChange,
  disabled,
  label,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: tokens.line, true: tokens.accent }}
      thumbColor={tokens.text}
      ios_backgroundColor={tokens.line}
    />
  );
}

type Tone = 'neutral' | 'accent' | 'running' | 'done' | 'danger' | 'info';

const TONE_COLOR: Record<Tone, string> = {
  neutral: tokens.textMuted,
  accent: tokens.accent,
  running: tokens.running,
  done: tokens.done,
  danger: tokens.danger,
  info: tokens.info,
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const color = TONE_COLOR[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <View style={[styles.dot, { backgroundColor: TONE_COLOR[tone] }]} />;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={tokens.textMuted} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.state}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.stateText}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="danger" style={{ gap: 10 }}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" compact onPress={onRetry} /> : null}
    </Card>
  );
}

export function InlineNotice({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const color = tone === 'danger' ? tokens.danger : tone === 'info' ? tokens.info : tokens.accent;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

// Bottom sheet built on Modal. Used for approvals, pickers, and quick forms.
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: tokens.bg },
  body: { paddingHorizontal: 20, gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: tokens.text, fontSize: 26, fontWeight: '600' },
  subtitle: { color: tokens.textMuted, fontSize: 13 },
  sectionLabel: { color: tokens.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  card: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  section: { gap: 8 },
  sectionCard: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  rowTitle: { color: tokens.text, fontSize: 15 },
  rowSubtitle: { color: tokens.textMuted, fontSize: 13 },
  rowValue: { color: tokens.textMuted, fontSize: 13 },
  chevron: { color: tokens.textMuted, fontSize: 20 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  buttonLabelCompact: { fontSize: 13 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: tokens.bg,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { color: tokens.textMuted, fontSize: 13 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#3A4150',
    borderRadius: 12,
    backgroundColor: tokens.bg,
    color: tokens.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeLabel: { fontSize: 11, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  stateText: { color: tokens.textMuted, fontSize: 14, textAlign: 'center' },
  emptyTitle: { color: tokens.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { color: tokens.text, fontSize: 14, lineHeight: 20 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: tokens.surface },
  noticeText: { color: tokens.text, fontSize: 13, lineHeight: 19 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: tokens.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A4150', marginBottom: 12 },
  sheetTitle: { color: tokens.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
}));
