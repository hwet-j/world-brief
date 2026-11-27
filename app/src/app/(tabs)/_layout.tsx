import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { useUi } from '../../components/ui';
import { useBrief } from '../../store';

type Icon = keyof typeof Ionicons.glyphMap;
const tab = (title: string, on: Icon, off: Icon, badge?: boolean) => ({
  title,
  tabBarBadge: badge ? '' : undefined,
  tabBarBadgeStyle: badge ? { minWidth: 10, height: 10, borderRadius: 5, fontSize: 1 } : undefined,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => <Ionicons name={focused ? on : off} size={size} color={color as string} />,
});

export default function TabsLayout() {
  const { t } = useUi();
  const { hasNew } = useBrief();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.faint, tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line }, tabBarLabelStyle: { fontWeight: '700', fontSize: 11 } }}>
      <Tabs.Screen name="index" options={tab('오늘', 'globe', 'globe-outline', hasNew)} />
      <Tabs.Screen name="archive" options={tab('보관함', 'albums', 'albums-outline')} />
      <Tabs.Screen name="explore" options={tab('모아보기', 'compass', 'compass-outline')} />
      <Tabs.Screen name="saved" options={tab('저장', 'bookmark', 'bookmark-outline')} />
      <Tabs.Screen name="settings" options={tab('설정', 'settings', 'settings-outline')} />
    </Tabs>
  );
}
