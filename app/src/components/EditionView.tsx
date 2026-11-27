import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { dateLabel, relative, slotLabel } from '../lib/time';
import { maxImportance, orderRegions } from '../lib/group';
import { Ionicons } from '@expo/vector-icons';
import type { Edition } from '../lib/types';
import { dateOnly } from '../lib/misc';
import { Badge, Banner, Card, Chip, SectionTitle, Txt, useUi } from './ui';

/** 한 회차의 화면: 헤드라인, 지역 칩, 지역 요약 카드, 이번 주 주목 */
export function EditionView({ edition, showNew }: { edition: Edition; showNew?: boolean }) {
  const { t, prefs } = useUi();
  const [filter, setFilter] = useState<string | null>(null);
  const regions = orderRegions(edition.regions, prefs);
  const shown = filter ? regions.filter((r) => r.code === filter) : regions;
  const open = (code: string) => router.push({ pathname: '/region/[editionId]/[code]', params: { editionId: edition.id, code } });
  const upcoming = edition.watchlist.filter((w) => w.date >= dateOnly(edition.generatedAt, edition.date)).sort((a, b) => a.date.localeCompare(b.date));
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="전체" on={filter === null} onPress={() => setFilter(null)} />
        {regions.map((r) => <Chip key={r.code} icon={r.flag} label={r.name} on={filter === r.code} onPress={() => setFilter(filter === r.code ? null : r.code)} />)}
      </ScrollView>

      {shown.length === 0 ? <Banner text="표시할 지역이 없어요. 설정 → 관심 지역에서 지역을 켜 주세요." tone="info" onPress={() => router.push('/settings')} /> : null}
      {shown.map((r) => (
        <Card key={r.code} onPress={() => open(r.code)} label={`${r.name} 브리핑 열기`} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={22}>{r.flag}</Txt>
            <Txt size={17} bold style={{ flex: 1 } as never}>{r.name}</Txt>
            {maxImportance(r) === 3 ? <Badge label="핵심" tone="primary" /> : null}
            <Badge label={`${r.items.length}건`} />
            <Ionicons name="chevron-forward" size={18} color={t.faint} />
          </View>
          {r.summary ? <Txt color={t.sub}>{r.summary}</Txt> : null}
          {r.items.slice(0, 2).map((it) => <Txt key={it.id} size={14} lines={1}>• {it.title}</Txt>)}
        </Card>
      ))}

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
