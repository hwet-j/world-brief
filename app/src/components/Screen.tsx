import React from 'react';
import { RefreshControl, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUi } from './ui';

/** 탭 화면 공통 틀: 배경, 상단 여백, 스크롤, 당겨서 새로고침 */
export function Screen({ title, subtitle, right, children, onRefresh, refreshing, topInset = true, contentStyle }: {
  title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; topInset?: boolean; contentStyle?: StyleProp<ViewStyle>;
}) {
  const { t, fs } = useUi();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset ? insets.top : 0 }}>
      <ScrollView
        contentContainerStyle={[{ padding: 16, gap: 14, paddingBottom: 32 }, contentStyle]} keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} /> : undefined}>
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt2 size={fs(28)} color={t.text}>{title}</Txt2>
              {subtitle ? <Txt2 size={fs(13)} color={t.sub} weight="400">{subtitle}</Txt2> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

function Txt2({ children, size, color, weight = '800' }: { children: React.ReactNode; size: number; color: string; weight?: '400' | '800' }) {
  return <Text style={{ fontSize: size, color, fontWeight: weight, lineHeight: size * 1.3 }}>{children}</Text>;
}
