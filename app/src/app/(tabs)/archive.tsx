import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ItemCard } from '../../components/ItemCard';
import { Screen } from '../../components/Screen';
import { Badge, Card, Empty, Txt, useUi } from '../../components/ui';
import { searchEditions } from '../../lib/search';
import { dateLabel, slotLabel } from '../../lib/time';
import type { IndexEntry } from '../../lib/types';
import { useBrief } from '../../store';
import { R } from '../../theme';

export default function Archive() {
  const { t, fs } = useUi();
  const { index, editions, status, refresh } = useBrief();
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchEditions(editions, q), [editions, q]);
  const days = useMemo(() => {
    const m = new Map<string, IndexEntry[]>();
    for (const e of index?.editions ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [index]);
  const edById = useMemo(() => new Map(editions.map((e) => [e.id, e])), [editions]);

  return (
    <Screen title="보관함" subtitle={`저장된 회차 ${editions.length}개로 검색해요`} onRefresh={() => refresh({ force: true })} refreshing={status.refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: R.md, paddingHorizontal: 12, borderWidth: 1, borderColor: t.line }}>
        <Ionicons name="search" size={18} color={t.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder="제목·요약·태그·출처 검색 (예: 반도체)" placeholderTextColor={t.faint} accessibilityLabel="브리핑 검색"
          style={{ flex: 1, minHeight: 46, fontSize: fs(15), color: t.text }} returnKeyType="search" autoCorrect={false} />
        {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="검색어 지우기" hitSlop={10}><Ionicons name="close-circle" size={18} color={t.faint} /></Pressable> : null}
      </View>

      {q.trim() ? (
        hits.length ? (
          <>
            <Txt size={13} color={t.sub}>{hits.length}건{hits.length >= 80 ? '+' : ''} 찾았어요</Txt>
            {hits.map((h) => {
              const ed = edById.get(h.editionId);
              return ed ? (
                <View key={`${h.editionId}/${h.item.id}`} style={{ gap: 4 }}>
                  <Txt size={12} color={t.faint}>{dateLabel(h.editionDate)} · {h.flag} {h.regionName}</Txt>
                  <ItemCard edition={ed} region={{ code: h.regionCode, name: h.regionName, flag: h.flag }} item={h.item} query={q} compact />
                </View>
              ) : null;
            })}
          </>
        ) : <Empty icon="search-outline" title="검색 결과가 없어요" hint="다른 낱말로 찾아보세요. 앱에 저장된 회차에서만 검색해요." />
      ) : days.length ? (
        days.map(([date, list]) => (
          <View key={date} style={{ gap: 8 }}>
            <Txt bold>{dateLabel(date)}</Txt>
            {list.map((e) => (
              <Card key={e.id} onPress={() => router.push({ pathname: '/edition/[id]', params: { id: e.id } })} label={`${e.title} 열기`} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge label={slotLabel(e.slot)} tone="primary" />
                  <Txt bold style={{ flex: 1 } as never} lines={1}>{e.title}</Txt>
                  <Txt size={12} color={t.faint}>{e.itemCount}건</Txt>
                </View>
                {e.headline.map((h, i) => <Txt key={i} size={14} color={t.sub} lines={1}>• {h}</Txt>)}
              </Card>
            ))}
          </View>
        ))
      ) : <Empty title="아직 보관된 브리핑이 없어요" hint="새 브리핑이 올라오면 날짜별로 쌓여요." />}
    </Screen>
  );
}
