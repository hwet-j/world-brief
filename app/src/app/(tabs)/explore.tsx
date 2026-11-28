import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ItemCard } from '../../components/ItemCard';
import { Screen } from '../../components/Screen';
import { Card, Chip, Empty, Txt, useUi } from '../../components/ui';
import { compareRegions, byTopic, tagCounts, topicCounts } from '../../lib/explore';
import { TOPIC_ICON, TOPIC_LABEL, orderRegions } from '../../lib/group';
import { useBrief } from '../../store';

type Mode = 'topic' | 'tag' | 'compare';

export default function Explore() {
  const { t, prefs } = useUi();
  const { latest, editions, status, refresh } = useBrief();
  const [mode, setMode] = useState<Mode>('topic');
  const counts = useMemo(() => topicCounts(latest), [latest]);
  const [topic, setTopic] = useState<string | null>(null);
  const activeTopic = (topic && counts.some((c) => c.topic === topic) ? topic : counts[0]?.topic) as keyof typeof TOPIC_LABEL | undefined;
  const tags = useMemo(() => tagCounts(editions).slice(0, 60), [editions]);
  const regions = useMemo(() => (latest ? orderRegions(latest.regions, prefs, true) : []), [latest, prefs]);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const ra = a && regions.some((r) => r.code === a) ? a : regions[0]?.code ?? null;
  const rb = b && regions.some((r) => r.code === b) ? b : regions[1]?.code ?? null;
  const cmp = useMemo(() => (ra && rb ? compareRegions(latest, ra, rb) : []), [latest, ra, rb]);

  return (
    <Screen title="모아보기" subtitle="주제·이슈·지역을 가로질러 봐요" onRefresh={() => refresh({ force: true })} refreshing={status.refreshing}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="주제별" on={mode === 'topic'} onPress={() => setMode('topic')} />
        <Chip label="이슈 추적" on={mode === 'tag'} onPress={() => setMode('tag')} />
        <Chip label="지역 비교" on={mode === 'compare'} onPress={() => setMode('compare')} />
      </ScrollView>

      {!latest ? <Empty title="아직 볼 브리핑이 없어요" hint="브리핑이 올라오면 주제·이슈별로 모아 볼 수 있어요." /> : null}

      {latest && mode === 'topic' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {counts.map((c) => <Chip key={c.topic} icon={TOPIC_ICON[c.topic]} label={`${TOPIC_LABEL[c.topic]} ${c.count}`} on={activeTopic === c.topic} onPress={() => setTopic(c.topic)} />)}
          </ScrollView>
          {activeTopic ? byTopic(latest, activeTopic).map((x) => (
            <View key={`${x.regionCode}/${x.item.id}`} style={{ gap: 4 }}>
              <Txt size={12} color={t.faint}>{x.flag} {x.regionName}</Txt>
              <ItemCard edition={latest} region={{ code: x.regionCode, name: x.regionName, flag: x.flag }} item={x.item} compact />
            </View>
          )) : null}
        </>
      ) : null}

      {latest && mode === 'tag' ? (
        tags.length ? (
          <>
            <Txt size={13} color={t.sub}>태그를 누르면 같은 이슈가 날짜별로 어떻게 이어졌는지 볼 수 있어요.</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tags.map((x) => <Chip key={x.tag} label={`#${x.tag} ${x.count}`} onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag: x.tag } })} />)}
            </View>
          </>
        ) : <Empty title="태그가 아직 없어요" />
      ) : null}

      {latest && mode === 'compare' ? (
        regions.length < 2 ? <Empty title="비교할 지역이 부족해요" /> : (
          <>
            <Txt size={13} color={t.sub}>같은 주제에서 두 지역이 어떻게 다른지 나란히 봐요 (최신 회차).</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {regions.map((r) => <Chip key={`a${r.code}`} icon={r.flag} label={r.name} on={ra === r.code} onPress={() => setA(r.code)} />)}
            </ScrollView>
            <Txt size={12} color={t.faint}>vs</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {regions.map((r) => <Chip key={`b${r.code}`} icon={r.flag} label={r.name} on={rb === r.code} onPress={() => setB(r.code)} />)}
            </ScrollView>
            {cmp.length === 0 ? <Empty title="같은 주제가 없어요" /> : cmp.map((row) => (
              <Card key={row.topic} style={{ gap: 8 }}>
                <Txt bold>{TOPIC_ICON[row.topic]} {TOPIC_LABEL[row.topic]}</Txt>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[row.left, row.right].map((list, i) => (
                    <View key={i} style={{ flex: 1, gap: 8 }}>
                      <Txt size={12} bold color={t.primary}>{regions.find((r) => r.code === (i === 0 ? ra : rb))?.flag} {regions.find((r) => r.code === (i === 0 ? ra : rb))?.name}</Txt>
                      {list.length ? list.map((it) => (
                        <Txt key={it.id} size={13} onPress={() => router.push({ pathname: '/region/[editionId]/[code]', params: { editionId: latest.id, code: i === 0 ? ra! : rb! } })}>• {it.title}</Txt>
                      )) : <Txt size={13} color={t.faint}>해당 소식 없음</Txt>}
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </>
        )
      ) : null}
    </Screen>
  );
}
