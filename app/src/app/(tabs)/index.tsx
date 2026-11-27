import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable } from 'react-native';

import { EditionView } from '../../components/EditionView';
import { Screen } from '../../components/Screen';
import { Banner, Empty, Skeleton, Txt, useUi } from '../../components/ui';
import { relative } from '../../lib/time';
import { useBrief } from '../../store';

export default function Today() {
  const { t } = useUi();
  const { ready, latest, index, status, hasNew, refresh, markSeen } = useBrief();
  // 오늘 화면을 보면 "새 브리핑" 표시를 지운다 (잠깐 보여 준 뒤)
  useFocusEffect(useCallback(() => {
    if (!hasNew || !latest) return;
    const id = setTimeout(markSeen, 4000);
    return () => clearTimeout(id);
  }, [hasNew, latest, markSeen]));

  return (
    <Screen
      title="World Brief" subtitle={status.fetchedAt ? `마지막 확인 ${relative(status.fetchedAt)}` : '세계 뉴스 브리핑'}
      onRefresh={() => refresh({ force: true })} refreshing={status.refreshing}
      right={<Pressable accessibilityRole="button" accessibilityLabel="새로고침" onPress={() => refresh({ force: true })} hitSlop={10}><Ionicons name="refresh" size={24} color={t.primary} /></Pressable>}>
      {status.futureSchema ? <Banner text="데이터 형식이 새로워졌어요. 앱 업데이트가 필요할 수 있어요." /> : null}
      {status.offline ? <Banner text={`${status.error ?? '오프라인이에요'} — 저장된 브리핑을 보여 드려요.`} tone="info" onPress={() => refresh({ force: true })} /> : null}
      {status.warnings.length ? <Banner text={`일부 항목은 형식 오류로 건너뛰었어요 (${status.warnings.length}건)`} tone="info" /> : null}
      {!ready || (status.refreshing && !latest) ? <Skeleton lines={6} height={18} /> : null}
      {ready && latest ? <EditionView edition={latest} showNew={hasNew} /> : null}
      {ready && !latest && !status.refreshing ? (
        status.error && !index
          ? <Empty icon="cloud-offline-outline" title="브리핑을 불러오지 못했어요" hint={status.error} />
          : <Empty title="아직 올라온 브리핑이 없어요" hint="예약 작업이 첫 브리핑을 올리면 여기에 나타나요. 아래로 당겨 새로고침해 보세요." />
      ) : null}
      {ready && latest && index && index.latest && latest.id !== index.latest ? <Txt size={12} color={t.faint}>최신 회차({index.latest})를 불러오는 중이에요.</Txt> : null}
    </Screen>
  );
}
