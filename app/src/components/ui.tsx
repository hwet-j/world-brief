import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useBrief } from '../store';
import { R, makeFs, useTheme } from '../theme';

/** 현재 테마 색과 글자 크기 함수 */
export function useUi() {
  const { prefs } = useBrief();
  const t = useTheme(prefs.theme);
  const fs = useMemo(() => makeFs(prefs.fontScale), [prefs.fontScale]);
  return { t, fs, prefs };
}

export function Card({ children, style, onPress, onLongPress, label }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void; label?: string }) {
  const { t } = useUi();
  const base: ViewStyle = { backgroundColor: t.card, borderRadius: R.lg, padding: 16, boxShadow: t.shadow, borderWidth: t.dark ? 1 : 0, borderColor: t.line };
  if (onPress || onLongPress) return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} style={[base, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

export function Txt({ children, size = 15, color, bold, style, lines, onPress }: { children: React.ReactNode; size?: number; color?: string; bold?: boolean; style?: StyleProp<ViewStyle>; lines?: number; onPress?: () => void }) {
  const { t, fs } = useUi();
  return <Text numberOfLines={lines} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={[{ fontSize: fs(size), lineHeight: fs(size) * 1.45, color: color ?? t.text, fontWeight: bold ? '700' : '400' }, style as never]}>{children}</Text>;
}

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: string }) {
  const { t, fs } = useUi();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} hitSlop={4}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: on ? t.primary : t.card, borderWidth: 1, borderColor: on ? t.primary : t.line }}>
      {icon ? <Text style={{ fontSize: fs(14) }}>{icon}</Text> : null}
      <Text style={{ fontSize: fs(14), fontWeight: '700', color: on ? t.onPrimary : t.text }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'warn' | 'ok' | 'primary' }) {
  const { t, fs } = useUi();
  const bg = tone === 'warn' ? t.warnSoft : tone === 'ok' ? t.okSoft : tone === 'primary' ? t.primarySoft : t.input;
  const fg = tone === 'warn' ? t.warn : tone === 'ok' ? t.ok : tone === 'primary' ? t.primary : t.sub;
  return <View style={{ backgroundColor: bg, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: fg, fontSize: fs(12), fontWeight: '700' }}>{label}</Text></View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
      <Txt size={17} bold>{children}</Txt>
      {right}
    </View>
  );
}

export function Empty({ icon = 'newspaper-outline', title, hint, action }: { icon?: keyof typeof Ionicons.glyphMap; title: string; hint?: string; action?: React.ReactNode }) {
  const { t } = useUi();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 }}>
      <Ionicons name={icon} size={44} color={t.faint} />
      <Txt size={17} bold style={{ textAlign: 'center' } as never}>{title}</Txt>
      {hint ? <Txt color={t.sub} style={{ textAlign: 'center' } as never}>{hint}</Txt> : null}
      {action}
    </View>
  );
}

export function Banner({ text, tone = 'warn', onPress }: { text: string; tone?: 'warn' | 'info'; onPress?: () => void }) {
  const { t, fs } = useUi();
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : 'text'} style={{ backgroundColor: tone === 'warn' ? t.warnSoft : t.primarySoft, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text style={{ color: tone === 'warn' ? t.warn : t.primary, fontSize: fs(13), fontWeight: '600', lineHeight: fs(13) * 1.45 }}>{text}</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, busy }: { title: string; onPress: () => void; kind?: 'primary' | 'soft' | 'danger'; disabled?: boolean; busy?: boolean }) {
  const { t, fs } = useUi();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? 'transparent' : t.primarySoft;
  const fg = kind === 'primary' ? t.onPrimary : kind === 'danger' ? t.danger : t.primary;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || busy} style={{ minHeight: 48, borderRadius: R.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, flexDirection: 'row', gap: 8 }}>
      {busy ? <ActivityIndicator color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '800', fontSize: fs(15) }}>{title}</Text>
    </Pressable>
  );
}

/** 로딩 중 자리표시 (깜박이는 막대) */
export function Skeleton({ lines = 3, height = 16 }: { lines?: number; height?: number }) {
  const { t } = useUi();
  const [v] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, gap: 10 }} accessibilityLabel="불러오는 중">
      {Array.from({ length: lines }, (_, i) => <View key={i} style={{ height, borderRadius: 6, backgroundColor: t.line, width: i === lines - 1 ? '60%' : '100%' }} />)}
    </Animated.View>
  );
}

export const gap = StyleSheet.create({ col: { gap: 12 }, pad: { padding: 16, gap: 12 } });
