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

import { currentScheme, lift, tokens } from '@/constants/tokens';
import { themed } from '@/lib/theme';

// Shared building blocks for every screen. Keeping them in one place keeps the
// feature screens consistent with the approved design.
// Colours are read from tokens while a component renders, or inside a themed() builder, so the
// screens follow the scheme in use. Nothing here freezes a palette at import time.

// Adds an alpha channel to a #RRGGBB token, for fills and edges derived from a token.
function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Small controls keep a 44px touch area by reaching past their visual edge.
const TALL_SLOP = { top: 6, bottom: 6 };
const SHORT_SLOP = { top: 4, bottom: 4 };

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
    tone === 'accent' ? tokens.accent : tone === 'warning' ? tokens.warn : tone === 'danger' ? tokens.danger : tokens.line;
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

type ButtonVariant = NonNullable<ButtonProps['variant']>;

// Read while the button renders, so it follows the scheme in use.
function buttonPalette(): Record<ButtonVariant, { bg: string; fg: string; border: string }> {
  return {
    primary: { bg: tokens.accent, fg: tokens.accentText, border: tokens.accent },
    secondary: { bg: tokens.surface, fg: tokens.text, border: tokens.line },
    danger: { bg: 'transparent', fg: tokens.danger, border: tokens.danger },
    ghost: { bg: 'transparent', fg: tokens.atext, border: 'transparent' },
  };
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, compact, style, testID }: ButtonProps) {
  const palette = buttonPalette()[variant];
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
            hitSlop={TALL_SLOP}
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
            hitSlop={SHORT_SLOP}
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
      trackColor={{ false: tokens.well, true: tokens.accent }}
      thumbColor={currentScheme() === 'dark' ? tokens.text : tokens.surface}
      ios_backgroundColor={tokens.well}
    />
  );
}

type Tone = 'neutral' | 'accent' | 'running' | 'done' | 'warn' | 'danger' | 'info';

// Read while the component renders, so the tones follow the scheme in use.
function toneColors(): Record<Tone, string> {
  return {
    neutral: tokens.textMuted,
    accent: tokens.accent,
    running: tokens.running,
    done: tokens.done,
    warn: tokens.warn,
    danger: tokens.danger,
    info: tokens.info,
  };
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const color = toneColors()[tone];
  return (
    <View style={[styles.badge, { borderColor: withAlpha(color, 0.45), backgroundColor: withAlpha(color, 0.12) }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <View style={[styles.dot, { backgroundColor: toneColors()[tone] }]} />;
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
    <Card tone="danger" style={{ gap: 10, alignItems: 'center' }}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" compact onPress={onRetry} /> : null}
    </Card>
  );
}

export function InlineNotice({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const color = tone === 'danger' ? tokens.danger : tone === 'info' ? tokens.info : tokens.warn;
  const textColor = tone === 'danger' ? tokens.danger : tone === 'info' ? tokens.info : tokens.warnText;
  return (
    <View style={[styles.notice, { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.35) }]}>
      <Text style={[styles.noticeText, { color: textColor }]}>{children}</Text>
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
  sectionLabel: { color: tokens.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  card: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 22,
    padding: 16,
    gap: 10,
    ...lift('card'),
  },
  section: { gap: 8 },
  sectionCard: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 22,
    ...lift('card'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.line },
  rowTitle: { color: tokens.text, fontSize: 15, fontWeight: '500' },
  rowSubtitle: { color: tokens.textMuted, fontSize: 13 },
  rowValue: { color: tokens.textMuted, fontSize: 13 },
  chevron: { color: tokens.textMuted, fontSize: 20 },
  button: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonCompact: { paddingHorizontal: 14 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  buttonLabelCompact: { fontSize: 13 },
  segmented: {
    flexDirection: 'row',
    height: 40,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 14,
    padding: 3,
    gap: 2,
  },
  segment: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { color: tokens.textMuted, fontSize: 13 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: tokens.line,
    borderRadius: 14,
    backgroundColor: tokens.surface,
    color: tokens.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  stateText: { color: tokens.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  emptyTitle: { color: tokens.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { color: tokens.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  notice: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  noticeText: { fontSize: 15, lineHeight: 21 },
  scrim: {
    flex: 1,
    backgroundColor: currentScheme() === 'dark' ? withAlpha(tokens.bg, 0.72) : withAlpha(tokens.text, 0.35),
  },
  sheet: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: tokens.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.line, marginBottom: 12 },
  sheetTitle: { color: tokens.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
}));
