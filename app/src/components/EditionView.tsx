import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { dateLabel, relative, slotLabel } from '../lib/time';
import { orderRegions, sortItems, TOPIC_ICON, TOPIC_LABEL } from '../lib/group';
import type { Edition, IndexEntry, Item, Region, Topic } from '../lib/types';
import { dateOnly } from '../lib/misc';
import { useBrief } from '../store';
import { ItemCard } from './ItemCard';
import { Badge, Banner, Button, Card, Chip, SectionTitle, Txt, useUi } from './ui';

const FIRST_PAGE = 10;

/** 이 회차보다 앞선 날짜의 마지막 회차들 (날짜마다 하나, 최근 2일) — "어제·그제는 어땠지?" */
export function previousDays(index: { editions: IndexEntry[] } | null | undefined, edition: { id: string; date: string }, days = 2): IndexEntry[] {
  if (!index) return [];
  const byDate = new Map<string, IndexEntry>();
  for (const e of [...index.editions].sort((a, b) => b.id.localeCompare(a.id))) {
    if (e.date >= edition.date || byDate.has(e.date)) continue;
    byDate.set(e.date, e);
  }
  return [...byDate.values()].slice(0, days);
}

interface Row { item: Item; region: Pick<Region, 'code' | 'name' | 'flag'> }

/** 한 회차의 화면: 오늘의 핵심 → 어제와 이어서 → 분야별로 보기(쉬운 설명·용어 풀이) → 이번 주 주목 */
export function EditionView({ edition, showNew }: { edition: Edition; showNew?: boolean }) {
  const { t, prefs } = useUi();
  const { index } = useBrief();
  const [region, setRegion] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [all, setAll] = useState(false);
  const regions = orderRegions(edition.regions, prefs);
  const rows: Row[] = useMemo(() => {
    const picked = regions.filter((r) => !region || r.code === region);
    const flat = picked.flatMap((r) => r.items.map((item) => ({ item, region: { code: r.code, name: r.name, flag: r.flag } })));
    const order = sortItems(flat.map((x) => x.item));
    return order.map((it) => flat.find((x) => x.item === it) as Row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition, region, prefs.hiddenRegions, prefs.regionOrder]);
  const topics = useMemo(() => {
    const m = new Map<Topic, number>();
    for (const r of rows) m.set(r.item.topic, (m.get(r.item.topic) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const filtered = topic ? rows.filter((r) => r.item.topic === topic) : rows;
  const shown = all ? filtered : filtered.slice(0, FIRST_PAGE);
  const upcoming = edition.watchlist.filter((w) => w.date >= dateOnly(edition.generatedAt, edition.date)).sort((a, b) => a.date.localeCompare(b.date));
  const before = previousDays(index, edition);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={22} bold lines={2} style={{ flexShrink: 1 } as never}>{edition.title}</Txt>
          {showNew ? <Badge label="NEW" tone="primary" /> : null}
        </View>
        <Txt size={13} color={t.sub}>{dateLabel(edition.date)} {slotLabel(edition.slot)} · {relative(edition.generatedAt)} 정리됨</Txt>
      </View>

      {edition.headline.length ? (
        <Card style={{ gap: 10, backgroundColor: t.primarySoft, borderWidth: 0 }}>
          <Txt size={13} bold color={t.primary}>오늘의 핵심</Txt>
          {edition.headline.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <Txt bold color={t.primary}>{i + 1}</Txt>
              <Txt style={{ flex: 1 } as never}>{h}</Txt>
            </View>
          ))}
        </Card>
      ) : null}

      {edition.recap || before.length ? (
        <Card style={{ gap: 10 }}>
          <Txt size={13} bold color={t.primary}>어제와 이어서 보면</Txt>
          {edition.recap ? <Txt>{edition.recap}</Txt> : null}
          {before.map((e) => (
            <View key={e.id} style={{ gap: 4 }}>
              <Txt size={13} bold color={t.sub} onPress={() => router.push({ pathname: '/edition/[id]', params: { id: e.id } })}>{dateLabel(e.date)} {slotLabel(e.slot)} ›</Txt>
              {e.headline.slice(0, 3).map((h, i) => <Txt key={i} size={14} color={t.text} lines={2}>• {h}</Txt>)}
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionTitle>분야별로 보기</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label={`전체 ${rows.length}`} on={topic === null} onPress={() => { setTopic(null); setAll(false); }} />
          {topics.map(([tp, n]) => <Chip key={tp} icon={TOPIC_ICON[tp]} label={`${TOPIC_LABEL[tp]} ${n}`} on={topic === tp} onPress={() => { setTopic(topic === tp ? null : tp); setAll(false); }} />)}
        </ScrollView>
        {regions.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="모든 나라" on={region === null} onPress={() => { setRegion(null); setAll(false); }} />
            {regions.map((r) => <Chip key={r.code} icon={r.flag} label={r.name} on={region === r.code} onPress={() => { setRegion(region === r.code ? null : r.code); setAll(false); }} />)}
          </ScrollView>
        ) : null}
        <Txt size={12} color={t.faint}>카드를 눌러 펼치고 접어요. 핵심 소식은 펼쳐져 있어요.</Txt>
      </View>

      {regions.length === 0 ? <Banner text="표시할 지역이 없어요. 설정 → 관심 지역에서 지역을 켜 주세요." tone="info" onPress={() => router.push('/settings')} /> : null}
      {shown.map((r) => <ItemCard key={`${r.region.code}-${r.item.id}`} edition={edition} region={r.region} item={r.item} collapsible />)}
      {filtered.length > FIRST_PAGE && !all ? <Button title={`나머지 ${filtered.length - FIRST_PAGE}건 더 보기`} kind="soft" onPress={() => setAll(true)} /> : null}

      {upcoming.length ? (
        <>
          <SectionTitle>이번 주 주목</SectionTitle>
          <Card style={{ gap: 8 }}>
            {upcoming.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <Txt bold color={t.primary} style={{ width: 70 } as never}>{dateLabel(w.date)}</Txt>
                <Txt style={{ flex: 1 } as never}>{w.region ? `[${w.region}] ` : ''}{w.title}</Txt>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      {edition.notes ? <Txt size={12} color={t.faint}>※ {edition.notes}</Txt> : null}
    </View>
  );
}
