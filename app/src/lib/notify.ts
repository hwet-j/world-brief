import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Prefs } from './types';

const KEY_ID = 'daily-brief';

/** 하루 한 번 정한 시각에 "오늘의 브리핑" 로컬 알림. 끄면 취소. 권한이 없으면 { ok:false } */
export async function applyDailyReminder(p: Pick<Prefs, 'notify' | 'notifyHour' | 'notifyMinute'>): Promise<{ ok: boolean; reason?: string }> {
  await Notifications.cancelScheduledNotificationAsync(KEY_ID).catch(() => {});
  if (!p.notify) return { ok: true };
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: '알림 권한이 허용되지 않았어요. 설정에서 허용해 주세요.' };
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('brief', { name: '오늘의 브리핑', importance: AndroidImportance.DEFAULT });
  await Notifications.scheduleNotificationAsync({
    identifier: KEY_ID,
    content: { title: '오늘의 브리핑', body: '새 세계 브리핑을 확인해 보세요.', data: { type: 'brief' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: p.notifyHour, minute: p.notifyMinute, channelId: 'brief' },
  });
  return { ok: true };
}
