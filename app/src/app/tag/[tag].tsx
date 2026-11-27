import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { ItemCard } from '../../components/ItemCard';
import { Screen } from '../../components/Screen';
import { Empty, Txt, useUi } from '../../components/ui';
import { tagTimeline } from '../../lib/explore';
import { dateLabel, slotLabel } from '../../lib/time';
import { useBrief } from '../../store';

/** 같은 태그가 달린 항목을 날짜순으로 이어 본다 */
export default function TagScreen() {
  const { t } = useUi();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { editions } = useBrief();
  const name = String(tag ?? '');
  const days = useMemo(() => tagTimeline(editions, name), [editions, name]);
  const byId = useMemo(() => new Map(editions.map((e) => [e.id, e])), [editions]);
  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: `#${name}` }} />
      <Txt size={13} color={t.sub}>저장된 {editions.length}개 회차에서 찾은 흐름이에요 (오래된 날짜부터).</Txt>
      {days.length === 0 ? <Empty icon="search-outline" title="이 태그가 달린 소식이 없어요" /> : days.map((d) => (
        <View key={d.date} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary }} />
            <Txt bold>{dateLabel(d.date)}</Txt>
          </View>
          {d.refs.map((x) => {
            const ed = byId.get(x.editionId);
            return ed ? (
              <View key={`${x.editionId}/${x.item.id}`} style={{ marginLeft: 18, gap: 4 }}>
                <Txt size={12} color={t.faint}>{x.flag} {x.regionName} · {slotLabel(x.slot)}</Txt>
                <ItemCard edition={ed} region={{ code: x.regionCode, name: x.regionName, flag: x.flag }} item={x.item} compact />
              </View>
            ) : null;
          })}
        </View>
      ))}
    </Screen>
  );
}
