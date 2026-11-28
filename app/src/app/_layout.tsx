import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useUi } from '../components/ui';
import { BriefProvider } from '../store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

function Shell() {
  const { t } = useUi();
  // 알림을 누르면 오늘 화면으로
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.navigate('/'));
    return () => sub.remove();
  }, []);
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edition/[id]" options={{ title: '브리핑' }} />
        <Stack.Screen name="region/[editionId]/[code]" options={{ title: '지역 브리핑' }} />
        <Stack.Screen name="tag/[tag]" options={{ title: '이슈 추적' }} />
      </Stack>
    </>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <BriefProvider>
        <Shell />
      </BriefProvider>
    </SafeAreaProvider>
  );
}
